// ─── Shared API contract: primitives ───
// Used by the Next.js frontend and the NestJS backend (path alias @contrack/contract). Pure zod, no runtime deps.
import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** Workspace roles, strongest first. */
export const ROLES = ['owner', 'admin', 'estimator', 'viewer'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** Roles that can be given through an invitation or a role change (ownership is never handed out this way). */
export const assignableRoleSchema = z.enum(['admin', 'estimator', 'viewer']);
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export const workspaceKindSchema = z.enum(['personal', 'company']);
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

/** Every error response has this shape. `code` is stable and machine-readable; `message` is for people. */
export const ERROR_CODES = [
    'validation_failed',
    'unauthenticated',
    'forbidden',
    'not_found',
    'conflict',
    'version_conflict',
    'email_taken',
    'invalid_credentials',
    'invalid_token',
    'invitation_invalid',
    'last_owner',
    'personal_workspace',
    'unprocessable',
    'rate_limited',
    'internal',
    /** The business module (subcontracting, workforce, …) is switched off for the platform or the workspace. */
    'module_disabled',
    /** Wrong, expired or used-up one-time code (phone sign-in). */
    'otp_invalid',
    /** The decision model (module `ai-assist`) cannot answer right now: not configured, unreachable or broken. */
    'ai_unavailable',
    /** The decision model account has no credits left. */
    'ai_quota',
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
