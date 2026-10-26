// ─── Shared API contract: crews and people (W1, docs/workforce/00-crew-management-design.md) ───
// A workspace keeps its people (บุคลากร) and crews (ทีมช่าง), assigns crews to the planned tasks of its projects
// (32 S-Curve tasks, ids "1.1" … "8.6") and names the site supervisors (ผู้คุมงาน) of each project.
// Business module `workforce`: off unless the platform offers it (env MODULES_ENABLED), and then its routes answer
// 404 `module_disabled` and the UI hides it. Switching off never deletes data.
//
// Wages: a person's daily wage is visible to owner/admin only; a crew's daily cost to owner/admin/estimator.
// For everyone else the field is null and `wagesHidden` is true.
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';

/** Same trade ids as the subcontracting module (ประเภทงานช่าง), so a subcontractor crew can join the same board later. */
export const WORKFORCE_TRADE_IDS = [
    'site-prep', 'temp-utilities', 'piling', 'structure', 'roof-structure', 'roofing', 'masonry',
    'electrical', 'plumbing', 'ceiling', 'tiling', 'painting', 'doors-windows', 'misc',
] as const;
export const workforceTradeIdSchema = z.enum(WORKFORCE_TRADE_IDS);
export type WorkforceTradeId = z.infer<typeof workforceTradeIdSchema>;

export const WORKFORCE_TRADE_LABEL: Record<WorkforceTradeId, string> = {
    'site-prep': 'เตรียมพื้นที่ / ถมดิน / วางผัง',
    'temp-utilities': 'น้ำ-ไฟชั่วคราว',
    piling: 'เสาเข็ม',
    structure: 'โครงสร้าง ค.ส.ล.',
    'roof-structure': 'โครงหลังคา',
    roofing: 'มุงหลังคา',
    masonry: 'ก่ออิฐ-ฉาบปูน',
    electrical: 'ไฟฟ้า',
    plumbing: 'ประปา-สุขาภิบาล',
    ceiling: 'ฝ้าเพดาน',
    tiling: 'ปูกระเบื้อง / ตกแต่งผนัง',
    painting: 'ทาสี',
    'doors-windows': 'ประตู-หน้าต่าง',
    misc: 'เบ็ดเตล็ด',
};

export const PERSON_ROLES = ['foreman', 'supervisor', 'engineer', 'skilled', 'labourer'] as const;
export const personRoleSchema = z.enum(PERSON_ROLES);
export type PersonRole = z.infer<typeof personRoleSchema>;
export const PERSON_ROLE_LABEL: Record<PersonRole, string> = {
    foreman: 'หัวหน้างาน / โฟร์แมน',
    supervisor: 'ผู้คุมงาน',
    engineer: 'วิศวกร',
    skilled: 'ช่าง',
    labourer: 'คนงาน',
};

export const EMPLOYMENT_TYPES = ['permanent', 'daily', 'subcontractor'] as const;
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);
export type EmploymentType = z.infer<typeof employmentTypeSchema>;
export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
    permanent: 'พนักงานประจำ',
    daily: 'รายวัน',
    subcontractor: 'ผู้รับเหมาช่วง',
};

export const WORKFORCE_NAME_MAX = 80;
export const WORKFORCE_NOTE_MAX = 500;
export const WORKFORCE_WAGE_MAX = 100_000;
export const MAX_ACTIVE_PEOPLE = 500;
export const MAX_ACTIVE_CREWS = 100;
export const MAX_CREW_HEADCOUNT = 200;

/** 'YYYY-MM-DD' (a calendar day, no time zone), as the planning dates. */
export const isoDateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
/** Planned task id of the S-Curve plan ("1.1" … "8.6"). */
export const planTaskIdSchema = z.string().regex(/^[1-9]\.[1-9]\d?$/);

const nameSchema = z.string().trim().min(1).max(WORKFORCE_NAME_MAX);
const noteSchema = z.string().trim().max(WORKFORCE_NOTE_MAX);
const wageSchema = z.number().int().min(0).max(WORKFORCE_WAGE_MAX);
const headcountSchema = z.number().int().min(0).max(MAX_CREW_HEADCOUNT);
/** Thai phone as typed (digits, spaces, dashes, leading +); stored trimmed. */
const phoneSchema = z.string().trim().max(20).regex(/^\+?[\d\s-]*$/);

// ─── People ──────────────────────────────────────────────────────────────────

export const personDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    name: z.string(),
    nickname: z.string().nullable(),
    phone: z.string().nullable(),
    role: personRoleSchema,
    employment: employmentTypeSchema,
    trades: z.array(workforceTradeIdSchema),
    /** ฿/day; null when not set or hidden from the caller (see `wagesHidden`). */
    dailyWage: z.number().int().nonnegative().nullable(),
    wagesHidden: z.boolean(),
    note: z.string().nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    archivedAt: isoDateTimeSchema.nullable(),
});
export type PersonDto = z.infer<typeof personDtoSchema>;

export const createPersonRequestSchema = z.object({
    name: nameSchema,
    nickname: z.string().trim().max(40).nullish(),
    phone: phoneSchema.nullish(),
    role: personRoleSchema,
    employment: employmentTypeSchema,
    trades: z.array(workforceTradeIdSchema).max(WORKFORCE_TRADE_IDS.length).default([]),
    dailyWage: wageSchema.nullish(),
    note: noteSchema.nullish(),
});
export type CreatePersonRequest = z.input<typeof createPersonRequestSchema>;

export const updatePersonRequestSchema = z.object({
    name: nameSchema.optional(),
    nickname: z.string().trim().max(40).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    role: personRoleSchema.optional(),
    employment: employmentTypeSchema.optional(),
    trades: z.array(workforceTradeIdSchema).max(WORKFORCE_TRADE_IDS.length).optional(),
    dailyWage: wageSchema.nullable().optional(),
    note: noteSchema.nullable().optional(),
}).refine(v => (Object.values(v) as unknown[]).some(x => x !== undefined), { message: 'nothing to update' });
export type UpdatePersonRequest = z.infer<typeof updatePersonRequestSchema>;

// ─── Crews ───────────────────────────────────────────────────────────────────

export const crewDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    name: z.string(),
    trade: workforceTradeIdSchema,
    leaderId: uuidSchema.nullable(),
    /** Named members (people of the workspace); a crew may also be headcount only. */
    memberIds: z.array(uuidSchema),
    /** ช่าง / คนงาน in the crew (typed; used when members are not listed one by one). */
    skilledCount: z.number().int().nonnegative(),
    labourerCount: z.number().int().nonnegative(),
    /** Company rate card its daily cost comes from (skilled × card skilled + labourers × card labourer). */
    rateCardId: uuidSchema.nullable(),
    /** A typed lump-sum ฿/day that overrides the rate card. */
    dailyCostOverride: z.number().int().nonnegative().nullable(),
    /** The crew's ฿/day as used for planning: override, else from the rate card, else null. Null when hidden. */
    dailyCost: z.number().int().nonnegative().nullable(),
    wagesHidden: z.boolean(),
    note: z.string().nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    archivedAt: isoDateTimeSchema.nullable(),
});
export type CrewDto = z.infer<typeof crewDtoSchema>;

export const createCrewRequestSchema = z.object({
    name: nameSchema,
    trade: workforceTradeIdSchema,
    leaderId: uuidSchema.nullish(),
    memberIds: z.array(uuidSchema).max(MAX_CREW_HEADCOUNT).default([]),
    skilledCount: headcountSchema,
    labourerCount: headcountSchema,
    rateCardId: uuidSchema.nullish(),
    dailyCostOverride: wageSchema.nullish(),
    note: noteSchema.nullish(),
});
export type CreateCrewRequest = z.input<typeof createCrewRequestSchema>;

export const updateCrewRequestSchema = z.object({
    name: nameSchema.optional(),
    trade: workforceTradeIdSchema.optional(),
    leaderId: uuidSchema.nullable().optional(),
    memberIds: z.array(uuidSchema).max(MAX_CREW_HEADCOUNT).optional(),
    skilledCount: headcountSchema.optional(),
    labourerCount: headcountSchema.optional(),
    rateCardId: uuidSchema.nullable().optional(),
    dailyCostOverride: wageSchema.nullable().optional(),
    note: noteSchema.nullable().optional(),
}).refine(v => (Object.values(v) as unknown[]).some(x => x !== undefined), { message: 'nothing to update' });
export type UpdateCrewRequest = z.infer<typeof updateCrewRequestSchema>;

// ─── Crew assignments (a crew on a planned task of a project, for a date range) ───

export const crewAssignmentDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    projectId: uuidSchema,
    taskId: planTaskIdSchema,
    crewId: uuidSchema,
    /** First and last day on the task, inclusive. */
    start: isoDateSchema,
    end: isoDateSchema,
    note: z.string().nullable(),
    createdBy: uuidSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type CrewAssignmentDto = z.infer<typeof crewAssignmentDtoSchema>;

export const createCrewAssignmentRequestSchema = z.object({
    /** A project of the same workspace. */
    projectId: uuidSchema,
    taskId: planTaskIdSchema,
    crewId: uuidSchema,
    start: isoDateSchema,
    end: isoDateSchema,
    note: noteSchema.nullish(),
}).refine(v => v.start <= v.end, { message: 'start after end', path: ['end'] });
export type CreateCrewAssignmentRequest = z.infer<typeof createCrewAssignmentRequestSchema>;

export const updateCrewAssignmentRequestSchema = z.object({
    crewId: uuidSchema.optional(),
    start: isoDateSchema.optional(),
    end: isoDateSchema.optional(),
    note: noteSchema.nullable().optional(),
}).refine(v => (Object.values(v) as unknown[]).some(x => x !== undefined), { message: 'nothing to update' });
export type UpdateCrewAssignmentRequest = z.infer<typeof updateCrewAssignmentRequestSchema>;

/** GET /workspaces/:workspaceId/crew-assignments query: every filter optional; `from`/`to` keep ranges that overlap. */
export const crewAssignmentQuerySchema = z.object({
    projectId: uuidSchema.optional(),
    crewId: uuidSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
});
export type CrewAssignmentQuery = z.infer<typeof crewAssignmentQuerySchema>;

// ─── Site supervisors of a project ───────────────────────────────────────────

/** GET/PUT /projects/:projectId/supervisors → the people supervising the site (any role; usually ผู้คุมงาน). */
export const projectSupervisorsDtoSchema = z.object({ projectId: uuidSchema, personIds: z.array(uuidSchema) });
export type ProjectSupervisorsDto = z.infer<typeof projectSupervisorsDtoSchema>;
export const putProjectSupervisorsRequestSchema = z.object({ personIds: z.array(uuidSchema).max(20) });
export type PutProjectSupervisorsRequest = z.infer<typeof putProjectSupervisorsRequestSchema>;

/** 409 details. */
export const workforceConflictDetailsSchema = z.discriminatedUnion('reason', [
    z.object({ reason: z.literal('name_taken'), name: z.string() }),
    z.object({ reason: z.literal('limit_reached'), limit: z.number().int() }),
    /** Archiving a person or crew still used by assignments that end today or later. */
    z.object({ reason: z.literal('in_use'), assignments: z.number().int().positive() }),
]);
export type WorkforceConflictDetails = z.infer<typeof workforceConflictDetailsSchema>;
