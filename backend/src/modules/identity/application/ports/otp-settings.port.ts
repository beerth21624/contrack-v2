import type { ModuleId } from '@contrack/contract';

/** Phone sign-in settings (built from AppConfig in the module, literal in tests). */
export class OtpSettings {
    constructor(readonly ttlSeconds: number) {}

    get ttlMs(): number {
        return this.ttlSeconds * 1000;
    }

    /** For the SMS text ("ใช้ได้ 5 นาที"). */
    get ttlMinutes(): number {
        return Math.ceil(this.ttlSeconds / 60);
    }
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Phone sign-in exists only for subcontractors (vendors of the `subcontracting` module): when the platform does not
 * offer that module, /auth/otp/* answer 404 module_disabled.
 */
export const PHONE_SIGN_IN_MODULE: ModuleId = 'subcontracting';

/** Limits of the public phone sign-in endpoints. */
export const OTP_RATE_LIMITS = {
    requestPerPhoneMinute: { limit: 1, windowMs: MINUTE_MS },
    requestPerPhoneHour: { limit: 5, windowMs: HOUR_MS },
    requestPerIpHour: { limit: 30, windowMs: HOUR_MS },
    checkPerIpHour: { limit: 30, windowMs: HOUR_MS },
    /** Every verify (right or wrong) from one address. */
    verifyPerIpHour: { limit: 60, windowMs: HOUR_MS },
    /** Wrong codes per phone across all its codes (caps guessing at 20 tries a day however many codes are requested). */
    verifyFailuresPerPhoneDay: { limit: 20, windowMs: DAY_MS },
} as const;

/** The Thai SMS that carries the code. */
export function otpSmsText(code: string, ttlMinutes: number): string {
    return `รหัสยืนยัน ConTrack: ${code} (ใช้ได้ ${ttlMinutes} นาที) อย่าบอกรหัสนี้กับผู้อื่น`;
}
