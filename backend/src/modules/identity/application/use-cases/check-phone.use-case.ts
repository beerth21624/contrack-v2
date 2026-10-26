// ─── Check phone: does this phone already have an account (the sign-in form asks for a name only when not) ───
import { Injectable } from '@nestjs/common';
import { ModuleFlags } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { IdentityErrors } from '../../domain/identity-errors';
import { Phone } from '../../domain/value-objects/phone.value-object';
import { OTP_RATE_LIMITS, PHONE_SIGN_IN_MODULE } from '../ports/otp-settings.port';
import { RateLimiter } from '../ports/rate-limiter.port';
import { UserRepository } from '../ports/user.repository';

export interface CheckPhoneInput {
    phone: string;
    /** Caller's IP address (rate limit). */
    ip: string;
}

@Injectable()
export class CheckPhoneUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly limiter: RateLimiter,
        private readonly flags: ModuleFlags,
    ) {}

    async execute(input: CheckPhoneInput): Promise<Result<{ exists: boolean }, DomainError>> {
        if (!this.flags.platformEnabled(PHONE_SIGN_IN_MODULE)) return err(IdentityErrors.phoneSignInDisabled());
        const phone = Phone.create(input.phone);
        if (!phone.ok) return phone;
        const { limit, windowMs } = OTP_RATE_LIMITS.checkPerIpHour;
        if (!(await this.limiter.tryHit([{ key: `otp-check:ip:${input.ip}`, limit, windowMs }]))) {
            return err(IdentityErrors.rateLimited());
        }
        return ok({ exists: (await this.users.findByPhone(phone.value)) !== undefined });
    }
}
