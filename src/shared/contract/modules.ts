// ─── Shared API contract: business modules that can be switched on and off ───
// Platform layer: env MODULES_ENABLED on the server (comma-separated; empty = ConTrack is plain BOQ estimation).
// A module that is off answers 404 `module_disabled` on its routes and its UI disappears; its data is kept.
// (The per-workspace switch of the module system on the subcontracting branch plugs in on top of this.)
import { z } from 'zod';

export const MODULE_IDS = ['workforce'] as const;
export const moduleIdSchema = z.enum(MODULE_IDS);
export type ModuleId = z.infer<typeof moduleIdSchema>;

export const MODULE_LABEL: Record<ModuleId, string> = {
    workforce: 'ทีมช่างและการจัดคน',
};

/** GET /platform/modules (public): what this server offers. */
export const platformModulesDtoSchema = z.object({ modules: z.array(moduleIdSchema) });
export type PlatformModulesDto = z.infer<typeof platformModulesDtoSchema>;
