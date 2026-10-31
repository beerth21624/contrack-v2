// ─── Audit log (docs/erp/01-architecture.md §10, 02-domain-model.md §1.5): append-only record of money / status actions ───
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from '../common';
import { cursorQuerySchema } from './common';

export const auditEventDtoSchema = z.object({
    /** Increasing id (bigserial as a string). */
    id: z.string(),
    workspaceId: uuidSchema,
    projectId: uuidSchema.nullable(),
    actorUserId: uuidSchema.nullable(),
    actorName: z.string().nullable(),
    /** e.g. `approval_request`, `entitlement`, `quotation`. */
    entityType: z.string(),
    entityId: z.string(),
    /** e.g. `requested`, `approved`, `issue`, `set`. */
    action: z.string(),
    /** Changed fields as `{field: [before, after]}` or a numeric summary. */
    data: z.record(z.string(), z.unknown()),
    at: isoDateTimeSchema,
});
export type AuditEventDto = z.infer<typeof auditEventDtoSchema>;

/** GET /workspaces/:workspaceId/audit?entityType=&entityId=&limit=&before= (`audit.read`) — newest first. */
export const auditListQuerySchema = cursorQuerySchema.extend({
    entityType: z.string().trim().min(1).max(64).optional(),
    entityId: z.string().trim().min(1).max(128).optional(),
    before: z.string().regex(/^\d{1,19}$/).optional(),
});
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

export const auditListDtoSchema = z.object({
    items: z.array(auditEventDtoSchema),
    /** Pass as `before` for the next (older) page; null on the last page. */
    nextBefore: z.string().nullable(),
});
export type AuditListDto = z.infer<typeof auditListDtoSchema>;
