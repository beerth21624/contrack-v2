// ─── Shared API contract: sign-in with a phone number + one-time code (subcontractors) ───
// POST /auth/otp/request (public) → 204; POST /auth/otp/verify (public) → PhoneAuthResponse (sets the refresh cookie
// exactly like login). A new phone creates the user, a personal workspace and (with `teamName`) a vendor profile.
// Users created this way have no e-mail: their `email` in UserDto is a placeholder ending in PHONE_EMAIL_DOMAIN.
import { z } from 'zod';
import { authResponseSchema, displayNameSchema } from './auth';
import { uuidSchema } from './common';

/** Domain of the placeholder e-mail of phone-only users (never shown: show the phone instead). */
export const PHONE_EMAIL_DOMAIN = 'phone.contrack.invalid';

/**
 * Thai mobile/landline in any common form ("081-234-5678", "0812345678", "+66812345678", "66812345678")
 * normalised to E.164 ("+66812345678").
 */
export const phoneSchema = z.string().trim()
    .transform(v => v.replace(/[\s\-().]/g, ''))
    .transform(v => (v.startsWith('+66') ? v : v.startsWith('66') ? `+${v}` : v.startsWith('0') ? `+66${v.slice(1)}` : v))
    .refine(v => /^\+66[1-9]\d{7,8}$/.test(v), { message: 'เบอร์โทรไม่ถูกต้อง' });

/** "+66812345678" → "081-234-5678" (display). */
export function formatThaiPhone(e164: string): string {
    if (!e164.startsWith('+66')) return e164;
    const local = `0${e164.slice(3)}`;
    return local.length === 10 ? `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}` : `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
}

export const OTP_LENGTH = 6;
export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/);

export const requestOtpRequestSchema = z.object({ phone: phoneSchema });
export type RequestOtpRequest = z.infer<typeof requestOtpRequestSchema>;

export const verifyOtpRequestSchema = z.object({
    phone: phoneSchema,
    code: otpCodeSchema,
    /** Required the first time (new phone). */
    displayName: displayNameSchema.optional(),
    /** Name of the crew/company; creates the vendor profile when the user has none yet. */
    teamName: z.string().trim().min(1).max(120).optional(),
    /** Raw token of the subcontracting invitation the user came from: links that invitation to the new vendor. */
    invitationToken: z.string().min(16).max(256).optional(),
});
export type VerifyOtpRequest = z.infer<typeof verifyOtpRequestSchema>;

export const phoneAuthResponseSchema = authResponseSchema.extend({
    isNewUser: z.boolean(),
    /** Workspace that carries the vendor profile (null when the user has none). */
    vendorWorkspaceId: uuidSchema.nullable(),
});
export type PhoneAuthResponse = z.infer<typeof phoneAuthResponseSchema>;

/** POST /auth/otp/check (public): does this phone already have an account (to know whether to ask for a name). */
export const phoneStatusResponseSchema = z.object({ exists: z.boolean() });
export type PhoneStatusResponse = z.infer<typeof phoneStatusResponseSchema>;
