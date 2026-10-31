// ─── Shared API contract: business modules that can be switched on and off ───
// A module is `active` for a workspace when all four layers agree (docs/erp/01-architecture.md §4.3):
//  1. release: env MODULES_ENABLED on the server lists it (empty = ConTrack is plain BOQ estimation)
//  2. entitlement: the module needs none (legacy modules), ENTITLEMENTS=open, or the workspace holds an unexpired
//     purchased / trial / beta grant (workspace_entitlements)
//  3. toggle: owner/admin switched it on for the workspace (workspace_modules)
//  4. dependencies: every module it depends on (./module-registry.ts) is active too
// Role permissions (`can(role, perm)`) come on top, per request. Switching off never deletes data; the module's routes
// answer 404 `module_disabled` and its UI disappears.
import { z } from 'zod';
import { isoDateTimeSchema } from './common';

/** Append only (never reorder): lists and the web app follow this order. */
export const MODULE_IDS = [
    'subcontracting', 'materials', 'owner-leads', 'ai-assist', 'workforce',
    'project-hub', 'portal', 'boq-control', 'quotations', 'contracts', 'billing', 'variations',
    'procurement', 'site-diary', 'labour', 'job-cost', 'payables', 'handover',
] as const;
export const moduleIdSchema = z.enum(MODULE_IDS);
export type ModuleId = z.infer<typeof moduleIdSchema>;

/** Thai names (kept for the existing screens and the backend; new screens use the `modules` message namespace). */
export const MODULE_LABEL: Record<ModuleId, string> = {
    subcontracting: 'จ้างช่วง (หาผู้รับเหมาช่วง)',
    materials: 'ขอราคาวัสดุ',
    'owner-leads': 'เจ้าของงานหาผู้รับเหมา',
    /** Decision-model assistance (./ai-assist.ts): BOQ review flags and pick-list item matching. */
    'ai-assist': 'ผู้ช่วย AI (ตรวจ BOQ, จับคู่รายการ)',
    /** Crews, people, assignments and the company crew board (./workforce.ts). */
    workforce: 'ทีมช่างและการจัดคน',
    'project-hub': 'ศูนย์รวมโครงการ',
    portal: 'หน้าหลักตามบทบาท',
    'boq-control': 'ประวัติ BOQ และฉบับฐาน',
    quotations: 'ใบเสนอราคา',
    contracts: 'สัญญาหลักและงวดงาน',
    billing: 'วางบิลและรับเงิน',
    variations: 'งานเพิ่ม-ลด',
    procurement: 'จัดซื้อ',
    'site-diary': 'รายงานประจำวัน',
    labour: 'ค่าแรงรายวัน',
    'job-cost': 'ต้นทุนโครงการ',
    payables: 'เจ้าหนี้และจ่ายเงิน',
    handover: 'ส่งมอบงานและรับประกัน',
};

/** GET /platform/modules (public): what this server offers at all (layer 1). */
export const platformModulesDtoSchema = z.object({ modules: z.array(moduleIdSchema) });
export type PlatformModulesDto = z.infer<typeof platformModulesDtoSchema>;

/** Stored grant statuses of workspace_entitlements (layer 2, set by the platform admin or a self-started trial). */
export const ENTITLEMENT_GRANT_STATUSES = ['purchased', 'trial', 'beta', 'revoked'] as const;
export type EntitlementGrantStatus = (typeof ENTITLEMENT_GRANT_STATUSES)[number];

/**
 * Entitlement as a workspace sees it: `not_required` (legacy module, or the server runs with ENTITLEMENTS=open),
 * `none` (never granted), a live grant (`purchased` / `trial` / `beta`), `expired` (grant past `expiresAt`) or `revoked`.
 */
export const ENTITLEMENT_STATUSES = ['not_required', 'none', 'purchased', 'trial', 'beta', 'expired', 'revoked'] as const;
export const entitlementStatusSchema = z.enum(ENTITLEMENT_STATUSES);
export type EntitlementStatus = z.infer<typeof entitlementStatusSchema>;

export const moduleEntitlementDtoSchema = z.object({
    status: entitlementStatusSchema,
    expiresAt: isoDateTimeSchema.nullable(),
});
export type ModuleEntitlementDto = z.infer<typeof moduleEntitlementDtoSchema>;

/** One module as seen by a workspace. */
export const workspaceModuleDtoSchema = z.object({
    module: moduleIdSchema,
    /** Layer 1: the platform offers it (if false, `enabled` is always false and it cannot be switched on). */
    available: z.boolean(),
    /** Layer 3: the workspace's own switch (false when not available). */
    enabled: z.boolean(),
    enabledAt: isoDateTimeSchema.nullable(),
    /** Layer 2. */
    entitlement: moduleEntitlementDtoSchema,
    /** All four layers (role permissions not included): menus, routes and buttons of the module follow this. */
    active: z.boolean(),
    /** Modules of the dependency closure (roots first) that are not active yet. */
    missingDependencies: z.array(moduleIdSchema),
    /** A 30-day trial can be started (POST …/trial): the module offers one, it was never used and no live grant exists. */
    trialAvailable: z.boolean(),
});
export type WorkspaceModuleDto = z.infer<typeof workspaceModuleDtoSchema>;

/** GET /workspaces/:workspaceId/modules → every module id, in MODULE_IDS order. */
export const workspaceModulesDtoSchema = z.array(workspaceModuleDtoSchema);

/** PUT /workspaces/:workspaceId/modules/:module (permission `modules.manage`). */
export const putWorkspaceModuleRequestSchema = z.object({
    enabled: z.boolean(),
    /**
     * Switching off while modules that depend on it are on, or while it still has running work, needs an explicit
     * confirmation (else 409 conflict with ModuleOffBlockers details). Confirmed: the dependents are switched off too.
     */
    confirm: z.boolean().optional(),
});
export type PutWorkspaceModuleRequest = z.infer<typeof putWorkspaceModuleRequestSchema>;

/** 409 details when switching off would hide running work or switch off modules that depend on this one. */
export const moduleOffBlockersSchema = z.object({
    /** Always `has_dependents` (errors.reasons.has_dependents). */
    reason: z.string(),
    /** Switched-on modules that depend on this one (transitively): confirm switches them off too. */
    dependents: z.array(moduleIdSchema),
    /** Running work per counter name of this module (e.g. `{ activeSubcontracts: 2 }`). */
    work: z.record(z.string(), z.number().int().nonnegative()),
    /** Kept for the existing modules page (subcontracting only). */
    activeSubcontracts: z.number().int().nonnegative().optional(),
});
export type ModuleOffBlockers = z.infer<typeof moduleOffBlockersSchema>;

/** 422 details when switching on a module whose dependencies are not active (`reason: 'missing_dependencies'`). */
export const moduleMissingDependenciesSchema = z.object({
    reason: z.literal('missing_dependencies'),
    missing: z.array(moduleIdSchema),
});
export type ModuleMissingDependencies = z.infer<typeof moduleMissingDependenciesSchema>;

/**
 * POST /workspaces/:workspaceId/modules/:module/trial (permission `modules.manage`): starts the trial of the module and
 * of every dependency the workspace holds no live grant for, and switches them all on. Once per module per workspace
 * (409 `reason: 'trial_used'`); a module the server does not offer, or one without a trial, is 422.
 */
export const startTrialResponseSchema = z.object({
    /** The module asked for. */
    module: workspaceModuleDtoSchema,
    /** Every module whose trial started in this call (the module and dependencies), in MODULE_IDS order. */
    started: z.array(moduleIdSchema),
    /** Every module of the workspace after the call (MODULE_IDS order), so the page needs no reload. */
    modules: workspaceModulesDtoSchema,
});
export type StartTrialResponse = z.infer<typeof startTrialResponseSchema>;
