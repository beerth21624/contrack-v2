// ─── Test kit for identity unit specs: fakes of the outbound ports and a wired set of use cases ───
// Not a spec file itself; only imported by *.spec.ts.
import {
    MembershipDirectory, type MembershipSummary, PersonalWorkspaceProvisioner, PhoneSignInHook, type PhoneSignInEvent,
} from '../../../shared/application/ports';
import { type UserId, type WorkspaceId, asUserId, asWorkspaceId } from '../../../shared/domain/ids';
import { InMemoryUnitOfWork } from '../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../shared/infrastructure/system';
import { FakeModuleFlags } from '../../../shared/testing/platform-fakes';
import { AccessTokenSigner, type SignedAccessToken } from '../application/ports/access-token-signer.port';
import { AuthSettings, REFRESH_REUSE_GRACE_MS } from '../application/ports/auth-settings.port';
import { OtpGenerator } from '../application/ports/otp-code.port';
import { OtpSettings } from '../application/ports/otp-settings.port';
import { PasswordHasher } from '../application/ports/password-hasher.port';
import { SmsSender } from '../../platform/application/ports/sms-sender.port';
import { SessionIssuer } from '../application/services/session-issuer.service';
import { CheckPhoneUseCase } from '../application/use-cases/check-phone.use-case';
import { GetMeUseCase } from '../application/use-cases/get-me.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { RequestOtpUseCase } from '../application/use-cases/request-otp.use-case';
import { UpdatePreferencesUseCase } from '../application/use-cases/update-preferences.use-case';
import { VerifyOtpUseCase } from '../application/use-cases/verify-otp.use-case';
import { RefreshToken } from '../domain/entities/refresh-token.entity';
import type { PlainPassword } from '../domain/value-objects/plain-password.value-object';
import { InMemoryOtpCodeRepository } from '../infrastructure/adapters/in-memory-otp-code.repository';
import { InMemoryRateLimiter } from '../infrastructure/adapters/in-memory-rate-limiter.adapter';
import { InMemoryRefreshTokenRepository } from '../infrastructure/adapters/in-memory-refresh-token.repository';
import { InMemoryUserRepository } from '../infrastructure/adapters/in-memory-user.repository';
import { HmacOtpHasher } from '../infrastructure/adapters/otp-code.adapter';

/** Fast, transparent hasher: `hashed:<password>`. Counts dummy verifications. */
export class FakePasswordHasher extends PasswordHasher {
    dummyVerifications = 0;

    hash(password: PlainPassword): Promise<string> {
        return Promise.resolve(`hashed:${password.value}`);
    }

    verify(password: string, hash: string): Promise<boolean> {
        return Promise.resolve(hash === `hashed:${password}`);
    }

    dummyVerify(): Promise<void> {
        this.dummyVerifications += 1;
        return Promise.resolve();
    }
}

export class FakeAccessTokenSigner extends AccessTokenSigner {
    signed: UserId[] = [];

    sign(userId: UserId): Promise<SignedAccessToken> {
        this.signed.push(userId);
        return Promise.resolve({ token: `access:${userId}:${this.signed.length}`, expiresIn: 900 });
    }
}

export class FakePersonalWorkspaceProvisioner extends PersonalWorkspaceProvisioner {
    calls: { userId: UserId; displayName: string }[] = [];
    /** Set to make provisioning fail (simulates a bug / database error inside the transaction). */
    failWith: Error | undefined;

    provision(userId: UserId, displayName: string): Promise<WorkspaceId> {
        if (this.failWith !== undefined) return Promise.reject(this.failWith);
        this.calls.push({ userId, displayName });
        return Promise.resolve(asWorkspaceId(`ffffffff-0000-4000-8000-${this.calls.length.toString(16).padStart(12, '0')}`));
    }
}

export class FakeMembershipDirectory extends MembershipDirectory {
    readonly byUser = new Map<UserId, MembershipSummary[]>();

    listForUser(userId: UserId): Promise<MembershipSummary[]> {
        return Promise.resolve(this.byUser.get(userId) ?? []);
    }
}

/** Counts transactions so specs can assert that multi-row writes ran inside `run`. */
export class CountingUnitOfWork extends InMemoryUnitOfWork {
    runs = 0;

    override run<T>(work: () => Promise<T>): Promise<T> {
        this.runs += 1;
        return super.run(work);
    }
}

/**
 * Returns a stale (pre-rotation) copy of one token on the next lookup of its hash: reproduces "both tabs read the
 * token before either rotated it" deterministically, so the second caller loses the conditional revoke.
 */
export class StaleReadRefreshTokenRepository extends InMemoryRefreshTokenRepository {
    private stale: RefreshToken | undefined;

    serveStaleOnce(token: RefreshToken): void {
        this.stale = token;
    }

    override findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
        const stale = this.stale;
        if (stale?.tokenHash === tokenHash) {
            this.stale = undefined;
            return Promise.resolve(RefreshToken.rehydrate(stale.toSnapshot()));
        }
        return super.findByHash(tokenHash);
    }
}

/** Records every SMS; set `failWith` to make sending fail. */
export class FakeSmsSender extends SmsSender {
    sent: { phone: string; text: string }[] = [];
    failWith: Error | undefined;

    send(phone: string, text: string): Promise<void> {
        if (this.failWith !== undefined) return Promise.reject(this.failWith);
        this.sent.push({ phone, text });
        return Promise.resolve();
    }

    /** The 6-digit code of the last SMS to `phone`. */
    lastCode(phone: string): string {
        const text = [...this.sent].reverse().find(m => m.phone === phone)?.text;
        const code = text?.match(/\d{6}/)?.[0];
        if (code === undefined) throw new Error(`FakeSmsSender: no code sent to ${phone}`);
        return code;
    }
}

/** Codes 100001, 100002, … (predictable, never all equal). */
export class SequentialOtpGenerator extends OtpGenerator {
    private n = 100_000;

    newCode(): string {
        this.n += 1;
        return this.n.toString();
    }
}

/** Records events; answers `vendorWorkspaceId` (null by default). Set `failWith` to make the hook fail. */
export class FakePhoneSignInHook extends PhoneSignInHook {
    events: PhoneSignInEvent[] = [];
    vendorWorkspaceId: WorkspaceId | null = null;
    failWith: Error | undefined;

    afterSignIn(event: PhoneSignInEvent): Promise<{ vendorWorkspaceId: WorkspaceId | null }> {
        if (this.failWith !== undefined) return Promise.reject(this.failWith);
        this.events.push(event);
        return Promise.resolve({ vendorWorkspaceId: this.vendorWorkspaceId });
    }
}

export const OTP_TTL_SECONDS = 300;
export const OTP_TEST_KEY = 'otp-code:test-key-of-at-least-32-characters';

export const REFRESH_TTL_DAYS = 30;
export const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
export const UNKNOWN_USER_ID = asUserId('99999999-0000-4000-8000-000000000000');

export interface IdentityKitOptions {
    users?: InMemoryUserRepository;
    refreshTokens?: InMemoryRefreshTokenRepository;
    otpCodes?: InMemoryOtpCodeRepository;
    /** Grace window for a token rotated by a concurrent tab (defaults to the production constant). */
    refreshReuseGraceMs?: number;
}

export function identityKit(options: IdentityKitOptions = {}) {
    const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));
    const ids = new SequentialIdGenerator();
    const users = options.users ?? new InMemoryUserRepository();
    const refreshTokens = options.refreshTokens ?? new InMemoryRefreshTokenRepository();
    const hasher = new FakePasswordHasher();
    const signer = new FakeAccessTokenSigner();
    const provisioner = new FakePersonalWorkspaceProvisioner();
    const memberships = new FakeMembershipDirectory();
    const uow = new CountingUnitOfWork();
    const settings = new AuthSettings(REFRESH_TTL_DAYS, options.refreshReuseGraceMs ?? REFRESH_REUSE_GRACE_MS);
    const sessions = new SessionIssuer(signer, settings, clock, ids);
    const otpCodes = options.otpCodes ?? new InMemoryOtpCodeRepository();
    const otpGenerator = new SequentialOtpGenerator();
    const otpHasher = new HmacOtpHasher(OTP_TEST_KEY);
    const limiter = new InMemoryRateLimiter(clock);
    const sms = new FakeSmsSender();
    const hook = new FakePhoneSignInHook();
    const otpSettings = new OtpSettings(OTP_TTL_SECONDS);
    /** Platform offers every module; `flags.platform.delete('subcontracting')` switches phone sign-in off. */
    const flags = new FakeModuleFlags();
    return {
        clock, ids, users, refreshTokens, hasher, signer, provisioner, memberships, uow, settings, sessions,
        otpCodes, otpGenerator, otpHasher, limiter, sms, hook, otpSettings, flags,
        checkPhone: new CheckPhoneUseCase(users, limiter, flags),
        requestOtp: new RequestOtpUseCase(otpCodes, otpGenerator, otpHasher, limiter, sms, otpSettings, uow, clock, ids, flags),
        verifyOtp: new VerifyOtpUseCase(
            users, otpCodes, otpHasher, hasher, refreshTokens, provisioner, hook, uow, sessions, clock, ids, limiter, flags),
        register: new RegisterUserUseCase(users, refreshTokens, hasher, provisioner, uow, sessions, clock, ids),
        login: new LoginUseCase(users, refreshTokens, hasher, sessions),
        refresh: new RefreshSessionUseCase(users, refreshTokens, sessions, settings, uow, clock),
        logout: new LogoutUseCase(refreshTokens, clock),
        getMe: new GetMeUseCase(users, memberships),
        updatePreferences: new UpdatePreferencesUseCase(users),
    };
}

export type IdentityKit = ReturnType<typeof identityKit>;

export const ALICE = { email: 'Alice@Example.com', password: 'correct horse battery', displayName: 'Alice' } as const;
export const BOB = { email: 'bob@example.com', password: 'another password', displayName: 'Bob' } as const;

/** A subcontractor signing in with a phone (E.164 +66812345678). */
export const SOMCHAI = { phone: '081-234-5678', e164: '+66812345678', displayName: 'สมชาย ช่างไฟ', ip: '203.0.113.7' } as const;

/** Requests a code for `phone` and returns the code from the SMS. */
export async function requestCode(kit: IdentityKit, phone: string = SOMCHAI.phone, ip: string = SOMCHAI.ip): Promise<string> {
    const result = await kit.requestOtp.execute({ phone, ip });
    if (!result.ok) throw new Error(`requestOtp failed: ${result.error.code}`);
    return kit.sms.lastCode(kit.sms.sent[kit.sms.sent.length - 1]?.phone ?? '');
}
