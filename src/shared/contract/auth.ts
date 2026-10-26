// ─── Shared API contract: identity (register / login / refresh / me) ───
import { z } from 'zod';
import { isoDateTimeSchema, roleSchema, uuidSchema, workspaceKindSchema } from './common';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
export const displayNameSchema = z.string().trim().min(1).max(80);

export const registerRequestSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
    email: emailSchema,
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const userDtoSchema = z.object({
    id: uuidSchema,
    email: z.string(),
    displayName: z.string(),
    createdAt: isoDateTimeSchema,
});
export type UserDto = z.infer<typeof userDtoSchema>;

/** Returned by register, login and refresh. The refresh token travels only in the httpOnly cookie. */
export const authResponseSchema = z.object({
    accessToken: z.string(),
    /** Seconds until the access token expires. */
    expiresIn: z.number().int().positive(),
    user: userDtoSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const workspaceSummaryDtoSchema = z.object({
    id: uuidSchema,
    name: z.string(),
    kind: workspaceKindSchema,
    role: roleSchema,
});
export type WorkspaceSummaryDto = z.infer<typeof workspaceSummaryDtoSchema>;

export const meResponseSchema = z.object({
    user: userDtoSchema,
    workspaces: z.array(workspaceSummaryDtoSchema),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** Name of the httpOnly cookie that carries the refresh token (path-scoped to the auth routes). */
export const REFRESH_COOKIE = 'contrack_rt';
