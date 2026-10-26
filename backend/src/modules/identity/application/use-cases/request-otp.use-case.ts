// ─── Request a sign-in code: rate limits, replace older codes, store the hash, send the code by SMS ───
import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator, ModuleFlags, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { SmsSender } from '../../../platform/application/ports/sms-sender.port';
import { OtpCode, asOtpCodeId } from '../../domain/entities/otp-code.entity';
import { IdentityErrors } from '../../domain/identity-errors';
import { Phone } from '../../domain/value-objects/phone.value-object';
import { OtpCodeRepository } from '../ports/otp-code.repository';
import { OtpGenerator, OtpHasher } from '../ports/otp-code.port';
import { OTP_RATE_LIMITS, OtpSettings, PHONE_SIGN_IN_MODULE, otpSmsText } from '../ports/otp-settings.port';
import { RateLimiter, type RateLimitRule } from '../ports/rate-limiter.port';

export interface RequestOtpInput {
    phone: string;
    /** Caller's IP address (rate limit, stored with the code). */
    ip: string;
}

@Injectable()
export class RequestOtpUseCase {
    constructor(
        private readonly codes: OtpCodeRepository,
        private readonly generator: OtpGenerator,
        private readonly hasher: OtpHasher,
        private readonly limiter: RateLimiter,
        private readonly sms: SmsSender,
        private readonly settings: OtpSettings,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
        private readonly flags: ModuleFlags,
    ) {}

    /** Answers the same for phones with and without an account (does not reveal which phones are registered). */
    async execute(input: RequestOtpInput): Promise<Result<void, DomainError>> {
        if (!this.flags.platformEnabled(PHONE_SIGN_IN_MODULE)) return err(IdentityErrors.phoneSignInDisabled());
        const phone = Phone.create(input.phone);
        if (!phone.ok) return phone;

        const l = OTP_RATE_LIMITS;
        const rules: RateLimitRule[] = [
            { key: `otp-request:phone-minute:${phone.value.value}`, ...l.requestPerPhoneMinute },
            { key: `otp-request:phone-hour:${phone.value.value}`, ...l.requestPerPhoneHour },
            { key: `otp-request:ip-hour:${input.ip}`, ...l.requestPerIpHour },
        ];
        if (!(await this.limiter.tryHit(rules))) return err(IdentityErrors.rateLimited());

        const now = this.clock.now();
        const raw = this.generator.newCode();
        const code = OtpCode.issue({
            id: asOtpCodeId(this.ids.newId()),
            phone: phone.value,
            codeHash: this.hasher.hash(phone.value.value, raw),
            now,
            ttlMs: this.settings.ttlMs,
            requestIp: input.ip,
        });
        await this.uow.run(async () => {
            await this.codes.invalidateActive(phone.value, now);
            await this.codes.insert(code);
        });

        // After commit: the code that arrives is always the one that is stored.
        await this.sms.send(phone.value.value, otpSmsText(raw, this.settings.ttlMinutes));
        return okVoid();
    }
}
