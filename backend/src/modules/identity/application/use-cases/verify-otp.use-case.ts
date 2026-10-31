// ─── Verify a sign-in code: consume it, find or create the phone user, tell the business modules, new session ───
import { Injectable } from '@nestjs/common';
import {
    Clock, IdGenerator, ModuleFlags, PersonalWorkspaceProvisioner, PhoneSignInHook, type PhoneSignInEvent, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type WorkspaceId, asUserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { newOpaqueToken } from '../../../../shared/infrastructure/crypto';
import { OTP_MAX_ATTEMPTS } from '../../domain/entities/otp-code.entity';
import { User } from '../../domain/entities/user.entity';
import { IdentityErrors } from '../../domain/identity-errors';
import { DisplayName } from '../../domain/value-objects/display-name.value-object';
import { Email } from '../../domain/value-objects/email.value-object';
import { Phone } from '../../domain/value-objects/phone.value-object';
import { PlainPassword } from '../../domain/value-objects/plain-password.value-object';
import { OtpCodeRepository } from '../ports/otp-code.repository';
import { OtpHasher } from '../ports/otp-code.port';
import { OTP_RATE_LIMITS, PHONE_SIGN_IN_MODULE } from '../ports/otp-settings.port';
import { PasswordHasher } from '../ports/password-hasher.port';
import { RateLimiter, type RateLimitRule } from '../ports/rate-limiter.port';
import { RefreshTokenRepository } from '../ports/refresh-token.repository';
import { UserRepository } from '../ports/user.repository';
import { type AuthSession, SessionIssuer } from '../services/session-issuer.service';

const CODE_FORMAT = /^\d{6}$/;

export interface VerifyOtpInput {
    phone: string;
    code: string;
    /** Caller's IP address (rate limit). */
    ip: string;
    /** Required the first time (new phone). */
    displayName?: string;
    teamName?: string;
    invitationToken?: string;
}

export interface PhoneSignIn {
    session: AuthSession;
    isNewUser: boolean;
    /** Workspace that carries the vendor profile (null when the user has none). */
    vendorWorkspaceId: WorkspaceId | null;
}

interface SignedIn {
    user: User;
    isNewUser: boolean;
    vendorWorkspaceId: WorkspaceId | null;
}

@Injectable()
export class VerifyOtpUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly codes: OtpCodeRepository,
        private readonly otpHasher: OtpHasher,
        private readonly passwordHasher: PasswordHasher,
        private readonly refreshTokens: RefreshTokenRepository,
        private readonly provisioner: PersonalWorkspaceProvisioner,
        private readonly hook: PhoneSignInHook,
        private readonly uow: UnitOfWork,
        private readonly sessions: SessionIssuer,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
        private readonly limiter: RateLimiter,
        private readonly flags: ModuleFlags,
    ) {}

    /**
     * Never reveals whether a phone has an account to someone without the code: a wrong / expired code answers
     * otp_invalid for every phone; only the right code of an unknown phone without a name answers 422 name_required
     * (the code is checked but not consumed, so the same code then signs up with a name).
     */
    async execute(input: VerifyOtpInput): Promise<Result<PhoneSignIn, DomainError>> {
        if (!this.flags.platformEnabled(PHONE_SIGN_IN_MODULE)) return err(IdentityErrors.phoneSignInDisabled());
        const phone = Phone.create(input.phone);
        if (!phone.ok) return phone;
        let displayName: DisplayName | undefined;
        if (input.displayName !== undefined) {
            const parsed = DisplayName.create(input.displayName);
            if (!parsed.ok) return parsed;
            displayName = parsed.value;
        }

        const limits = OTP_RATE_LIMITS;
        const failures: RateLimitRule = {
            key: `otp-verify:phone-failures-day:${phone.value.value}`, ...limits.verifyFailuresPerPhoneDay,
        };
        if (!(await this.limiter.tryHit([{ key: `otp-verify:ip-hour:${input.ip}`, ...limits.verifyPerIpHour }]))) {
            return err(IdentityErrors.rateLimited());
        }
        if (!(await this.limiter.allows([failures]))) return err(IdentityErrors.rateLimited());

        const now = this.clock.now();
        if (!CODE_FORMAT.test(input.code)) return err(IdentityErrors.otpInvalid());
        const code = await this.codes.findLatestActive(phone.value, now);
        if (code === undefined) return err(IdentityErrors.otpInvalid());
        // Every check counts (the right code included), atomically: concurrent guesses never exceed the maximum.
        if (!(await this.codes.tryAttempt(code.id, now, OTP_MAX_ATTEMPTS))) return err(IdentityErrors.otpInvalid());
        if (!this.otpHasher.matches(code.codeHash, phone.value.value, input.code)) {
            await this.limiter.hit([failures]);
            return err(IdentityErrors.otpInvalid());
        }

        // Only now (right code): a new phone without a name. The code stays unconsumed for the retry with the name.
        const known = await this.users.findByPhone(phone.value);
        if (known === undefined && displayName === undefined) return err(displayNameRequired());

        // Slow (scrypt): outside the transaction. Random and never revealed, so it can never match a password.
        const unusableHash = known === undefined ? await this.unusablePasswordHash() : undefined;

        const signedIn = await this.uow.run(async (): Promise<Result<SignedIn, DomainError>> => {
            // Exactly one concurrent verify of the same code gets past this.
            if (!(await this.codes.consumeIfUnused(code.id, now))) return err(IdentityErrors.otpInvalid());

            const existing = await this.users.findByPhone(phone.value);
            let user: User;
            let isNewUser: boolean;
            if (existing !== undefined) {
                await this.users.markPhoneVerified(existing.id, phone.value, now);
                user = existing.withVerifiedPhone(phone.value, now);
                isNewUser = false;
            } else {
                if (displayName === undefined || unusableHash === undefined) return err(displayNameRequired());
                user = User.create({
                    id: asUserId(this.ids.newId()),
                    email: Email.rehydrate(phone.value.placeholderEmail),
                    displayName,
                    passwordHash: unusableHash,
                    createdAt: now,
                    phone: phone.value,
                    phoneVerifiedAt: now,
                });
                // A concurrent sign-in of the same phone won (its phone or placeholder e-mail is taken).
                const inserted = await this.users.insert(user);
                if (!inserted.ok) return err(IdentityErrors.phoneTaken());
                await this.provisioner.provision(user.id, user.displayName.value);
                isNewUser = true;
            }

            const event: PhoneSignInEvent = {
                userId: user.id,
                phone: phone.value.value,
                isNewUser,
                displayName: user.displayName.value,
                teamName: input.teamName,
                invitationToken: input.invitationToken,
            };
            const { vendorWorkspaceId } = await this.hook.afterSignIn(event);
            return ok({ user, isNewUser, vendorWorkspaceId });
        });
        if (!signedIn.ok) return signedIn;

        const refresh = this.sessions.newFamily(signedIn.value.user);
        await this.refreshTokens.insert(refresh.token);
        return ok({
            session: await this.sessions.session(signedIn.value.user, refresh),
            isNewUser: signedIn.value.isNewUser,
            vendorWorkspaceId: signedIn.value.vendorWorkspaceId,
        });
    }

    private async unusablePasswordHash(): Promise<string> {
        const random = PlainPassword.create(newOpaqueToken());
        if (!random.ok) throw new Error('VerifyOtpUseCase: random password rejected');
        return this.passwordHasher.hash(random.value);
    }
}

function displayNameRequired(): DomainError {
    return DomainError.unprocessable('A name is required for a new phone number', { reason: 'name_required', field: 'displayName' });
}
