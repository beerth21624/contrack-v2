import { MODULE_IDS, MODULE_REGISTRY, type EntitlementStatus, type ModuleId } from '@contrack/contract';
import type { WorkspaceEntitlement } from '../../domain/entities/workspace-entitlement.entity';
import { grantStatus } from '../../domain/module-activation';

export interface AdminEntitlementView {
    module: ModuleId;
    status: EntitlementStatus;
    expiresAt: Date | null;
    note: string;
    trialUsedAt: Date | null;
    updatedAt: Date | null;
}

/** Modules that need an entitlement (MODULE_IDS order): the ones a platform admin can grant. */
export const ENTITLEMENT_MODULES: readonly ModuleId[] = MODULE_IDS.filter(m => MODULE_REGISTRY[m].entitlement === 'required');

export function toAdminEntitlementView(module: ModuleId, grant: WorkspaceEntitlement | undefined, now: Date): AdminEntitlementView {
    if (grant === undefined) return { module, status: 'none', expiresAt: null, note: '', trialUsedAt: null, updatedAt: null };
    return {
        module,
        status: grantStatus({ status: grant.status, expiresAt: grant.expiresAt, trialUsedAt: grant.trialUsedAt }, now),
        expiresAt: grant.expiresAt,
        note: grant.note,
        trialUsedAt: grant.trialUsedAt,
        updatedAt: grant.updatedAt,
    };
}
