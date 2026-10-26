// ─── Shared API contract: projects, project documents, revisions, level assignments, activity ───
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';

/**
 * A project is stored as documents, one per sheet the user edits (see src/domain/sync/doc-keys.ts):
 * `meta`, `journey`, `calc:<calculatorId>`, `boq:<lineKey>`, `planning:<manday|schedule|cashflow>`.
 * The shape is checked here; whether the calculator / BOQ line exists is checked by the shared domain.
 */
export const DOC_KEY_PATTERN = /^(meta|journey|calc:[a-z0-9-]{1,64}|boq:[A-Za-z0-9:._-]{1,128}|planning:(manday|schedule|cashflow))$/;
export const docKeySchema = z.string().regex(DOC_KEY_PATTERN);

/** Largest accepted document (bytes of its JSON). */
export const MAX_DOC_BYTES = 256 * 1024;

export const projectStartSchema = z.enum(['blank', 'sample']);
export type ProjectStartDto = z.infer<typeof projectStartSchema>;

export const projectNameSchema = z.string().trim().min(1).max(160);

export const projectSummarySchema = z.object({
    constructionTotal: z.number(),
    preConstructionTotal: z.number(),
    levelsDone: z.number().int().nonnegative(),
    levelsTotal: z.number().int().nonnegative(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const projectDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    name: z.string(),
    start: projectStartSchema,
    engineVersion: z.string(),
    schemaVersion: z.number().int(),
    summary: projectSummarySchema,
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    archivedAt: isoDateTimeSchema.nullable(),
});
export type ProjectDto = z.infer<typeof projectDtoSchema>;

export const projectDocDtoSchema = z.object({
    docKey: docKeySchema,
    /** null = the document was reset to its default (the row stays so versions keep increasing). */
    data: z.unknown().nullable(),
    version: z.number().int().positive(),
    updatedBy: uuidSchema,
    updatedAt: isoDateTimeSchema,
});
export type ProjectDocDto = z.infer<typeof projectDocDtoSchema>;

export const projectDetailDtoSchema = z.object({
    project: projectDtoSchema,
    docs: z.array(projectDocDtoSchema),
});
export type ProjectDetailDto = z.infer<typeof projectDetailDtoSchema>;

export const initialDocSchema = z.object({ docKey: docKeySchema, data: z.unknown() });
export type InitialDoc = z.infer<typeof initialDocSchema>;

export const createProjectRequestSchema = z.object({
    name: projectNameSchema,
    start: projectStartSchema,
    /** Upload of a project made in guest mode: its documents (see projectToDocs). */
    docs: z.array(initialDocSchema).max(2000).optional(),
});
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const updateProjectRequestSchema = z.object({
    name: projectNameSchema.optional(),
    archived: z.boolean().optional(),
}).refine(v => v.name !== undefined || v.archived !== undefined, { message: 'nothing to update' });
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const listProjectsQuerySchema = z.object({
    archived: z.enum(['true', 'false']).optional(),
});

export const putDocRequestSchema = z.object({
    /** null = reset to default. */
    data: z.unknown().nullable(),
    /** Version the client edited (0 when the document does not exist yet). */
    baseVersion: z.number().int().nonnegative(),
});
export type PutDocRequest = z.infer<typeof putDocRequestSchema>;

export const putDocResponseSchema = z.object({ doc: projectDocDtoSchema, project: projectDtoSchema });
export type PutDocResponse = z.infer<typeof putDocResponseSchema>;

/** Body of a 409 `version_conflict`: the document as it is now on the server. */
export const versionConflictDetailsSchema = z.object({ current: projectDocDtoSchema.nullable() });
export type VersionConflictDetails = z.infer<typeof versionConflictDetailsSchema>;

export const revisionLabelSchema = z.string().trim().min(1).max(40);

export const createRevisionRequestSchema = z.object({
    label: revisionLabelSchema,
    note: z.string().trim().max(2000).optional(),
});
export type CreateRevisionRequest = z.infer<typeof createRevisionRequestSchema>;

export const revisionDtoSchema = z.object({
    id: uuidSchema,
    projectId: uuidSchema,
    label: z.string(),
    note: z.string().nullable(),
    totals: projectSummarySchema,
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
});
export type RevisionDto = z.infer<typeof revisionDtoSchema>;

export const revisionDetailDtoSchema = revisionDtoSchema.extend({
    /** The whole project as it was (the frontend Project shape). */
    snapshot: z.unknown(),
});
export type RevisionDetailDto = z.infer<typeof revisionDetailDtoSchema>;

export const levelIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

export const levelAssignmentDtoSchema = z.object({
    levelId: levelIdSchema,
    userId: uuidSchema,
    assignedBy: uuidSchema,
    assignedAt: isoDateTimeSchema,
});
export type LevelAssignmentDto = z.infer<typeof levelAssignmentDtoSchema>;

export const putAssignmentRequestSchema = z.object({ userId: uuidSchema.nullable() });
export type PutAssignmentRequest = z.infer<typeof putAssignmentRequestSchema>;

export const ACTIVITY_ACTIONS = [
    'project.created', 'project.renamed', 'project.archived', 'project.restored',
    'doc.updated', 'doc.reset', 'revision.created', 'level.assigned', 'level.unassigned',
] as const;
export const activityActionSchema = z.enum(ACTIVITY_ACTIONS);
export type ActivityAction = z.infer<typeof activityActionSchema>;

export const activityDtoSchema = z.object({
    id: z.string(),
    projectId: uuidSchema,
    userId: uuidSchema,
    action: activityActionSchema,
    docKey: docKeySchema.nullable(),
    at: isoDateTimeSchema,
});
export type ActivityDto = z.infer<typeof activityDtoSchema>;

export const activityQuerySchema = z.object({
    before: z.string().regex(/^\d+$/).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
});
