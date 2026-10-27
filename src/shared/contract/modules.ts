// ─── Shared API contract: business modules that can be switched on and off ───
// Two layers (docs/marketplace/README.md §1):
//  1. platform: env MODULES_ENABLED on the server (empty = ConTrack is plain BOQ estimation)
//  2. workspace: owner/admin turn a module on/off for their workspace (only modules the platform offers)
// Switching off never deletes data; the module's routes answer 404 `module_disabled` and its UI disappears.
import { z } from 'zod';
import { isoDateTimeSchema } from './common';

export const MODULE_IDS = ['subcontracting', 'materials', 'owner-leads', 'ai-assist', 'workforce'] as const;
export const moduleIdSchema = z.enum(MODULE_IDS);
export type ModuleId = z.infer<typeof moduleIdSchema>;

export const MODULE_LABEL: Record<ModuleId, string> = {
    subcontracting: 'จ้างช่วง (หาผู้รับเหมาช่วง)',
    materials: 'ขอราคาวัสดุ',
    'owner-leads': 'เจ้าของงานหาผู้รับเหมา',
    /** Decision-model assistance (./ai-assist.ts): BOQ review flags and pick-list item matching. */
    'ai-assist': 'ผู้ช่วย AI (ตรวจ BOQ, จับคู่รายการ)',
    /** Crews, people, assignments and the company crew board (./workforce.ts). */
    workforce: 'ทีมช่างและการจัดคน',
};

/** GET /platform/modules (public): what this server offers at all. */
export const platformModulesDtoSchema = z.object({ modules: z.array(moduleIdSchema) });
export type PlatformModulesDto = z.infer<typeof platformModulesDtoSchema>;

/** One module as seen by a workspace. */
export const workspaceModuleDtoSchema = z.object({
    module: moduleIdSchema,
    /** The platform offers it (if false, `enabled` is always false and it cannot be switched on). */
    available: z.boolean(),
    enabled: z.boolean(),
    enabledAt: isoDateTimeSchema.nullable(),
});
export type WorkspaceModuleDto = z.infer<typeof workspaceModuleDtoSchema>;

/** GET /workspaces/:workspaceId/modules → every module id, in MODULE_IDS order. */
export const workspaceModulesDtoSchema = z.array(workspaceModuleDtoSchema);

/** PUT /workspaces/:workspaceId/modules/:module (permission `modules.manage`). */
export const putWorkspaceModuleRequestSchema = z.object({
    enabled: z.boolean(),
    /** Switching off while contracts are still running needs an explicit confirmation (else 409 conflict with details). */
    confirm: z.boolean().optional(),
});
export type PutWorkspaceModuleRequest = z.infer<typeof putWorkspaceModuleRequestSchema>;

/** 409 details when switching off would hide running work. */
export const moduleOffBlockersSchema = z.object({ activeSubcontracts: z.number().int().nonnegative() });
export type ModuleOffBlockers = z.infer<typeof moduleOffBlockersSchema>;
