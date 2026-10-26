// ─── Shared API contract: workspaces (tenants), members, invitations ───
import { z } from 'zod';
import { emailSchema } from './auth';
import { assignableRoleSchema, isoDateTimeSchema, roleSchema, uuidSchema, workspaceKindSchema } from './common';

export const workspaceNameSchema = z.string().trim().min(1).max(120);

export const createWorkspaceRequestSchema = z.object({ name: workspaceNameSchema });
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

export const renameWorkspaceRequestSchema = z.object({ name: workspaceNameSchema });
export type RenameWorkspaceRequest = z.infer<typeof renameWorkspaceRequestSchema>;

export const workspaceDtoSchema = z.object({
    id: uuidSchema,
    name: z.string(),
    kind: workspaceKindSchema,
    role: roleSchema,
    memberCount: z.number().int().nonnegative(),
    createdAt: isoDateTimeSchema,
});
export type WorkspaceDto = z.infer<typeof workspaceDtoSchema>;

export const memberDtoSchema = z.object({
    userId: uuidSchema,
    email: z.string(),
    displayName: z.string(),
    role: roleSchema,
    joinedAt: isoDateTimeSchema,
});
export type MemberDto = z.infer<typeof memberDtoSchema>;

export const changeRoleRequestSchema = z.object({ role: roleSchema });
export type ChangeRoleRequest = z.infer<typeof changeRoleRequestSchema>;

export const createInvitationRequestSchema = z.object({ email: emailSchema, role: assignableRoleSchema });
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

export const invitationDtoSchema = z.object({
    id: uuidSchema,
    email: z.string(),
    role: assignableRoleSchema,
    invitedBy: uuidSchema,
    expiresAt: isoDateTimeSchema,
    createdAt: isoDateTimeSchema,
});
export type InvitationDto = z.infer<typeof invitationDtoSchema>;

/**
 * The raw token is returned once, to the inviter, so it can be shared as a link (no e-mail service yet).
 * Only its hash is stored.
 */
export const createInvitationResponseSchema = z.object({ invitation: invitationDtoSchema, token: z.string() });
export type CreateInvitationResponse = z.infer<typeof createInvitationResponseSchema>;

export const acceptInvitationRequestSchema = z.object({ token: z.string().min(16).max(256) });
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;

export const acceptInvitationResponseSchema = z.object({ workspaceId: uuidSchema, role: roleSchema });
export type AcceptInvitationResponse = z.infer<typeof acceptInvitationResponseSchema>;
