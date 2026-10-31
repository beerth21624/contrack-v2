// ─── The four flag layers of a module for one workspace (docs/erp/01-architecture.md §4.3), pure ───
//   active(m) = released(m) && entitled(m, now) && toggled(m) && dependsOn(m).every(active)
import {
    type EntitlementGrantStatus, type EntitlementStatus, MODULE_IDS, MODULE_REGISTRY, type ModuleId, dependencyClosure,
} from '@contrack/contract';

/** What the activation needs of a workspace_entitlements row. */
export interface GrantState {
    status: EntitlementGrantStatus;
    expiresAt: Date | null;
    trialUsedAt: Date | null;
}

export type EntitlementMode = 'enforce' | 'open';

export interface ModuleFlagInputs {
    /** Layer 1 (env MODULES_ENABLED). */
    released: ReadonlySet<ModuleId>;
    /** env ENTITLEMENTS. */
    mode: EntitlementMode;
    now: Date;
    /** Layer 3: modules the workspace switched on. */
    toggled: ReadonlySet<ModuleId>;
    /** Layer 2: the workspace's grant rows. */
    grants: ReadonlyMap<ModuleId, GrantState>;
}

export interface ModuleState {
    module: ModuleId;
    available: boolean;
    /** The workspace switch, false when not available. */
    enabled: boolean;
    entitled: boolean;
    entitlementStatus: EntitlementStatus;
    entitlementExpiresAt: Date | null;
    active: boolean;
    /** Not-active modules of the dependency closure (roots first). */
    missingDependencies: ModuleId[];
    trialAvailable: boolean;
}

/** purchased / trial / beta with no end or an end after `now`. */
export function grantIsLive(grant: GrantState | undefined, now: Date): boolean {
    if (grant === undefined || grant.status === 'revoked') return false;
    return grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime();
}

export function isEntitled(inputs: ModuleFlagInputs, module: ModuleId): boolean {
    if (MODULE_REGISTRY[module].entitlement === 'none' || inputs.mode === 'open') return true;
    return grantIsLive(inputs.grants.get(module), inputs.now);
}

/** The workspace may start the module's one trial: it has one, the server offers it, and no trial / live grant / revoke. */
export function trialAvailable(inputs: ModuleFlagInputs, module: ModuleId): boolean {
    if (MODULE_REGISTRY[module].trialDays <= 0 || !inputs.released.has(module)) return false;
    const grant = inputs.grants.get(module);
    if (grant === undefined) return true;
    return grant.trialUsedAt === null && grant.status !== 'revoked' && !grantIsLive(grant, inputs.now);
}

/** All four layers, dependencies included. */
export function isActive(inputs: ModuleFlagInputs, module: ModuleId): boolean {
    if (!inputs.released.has(module) || !inputs.toggled.has(module) || !isEntitled(inputs, module)) return false;
    return MODULE_REGISTRY[module].dependsOn.every(d => isActive(inputs, d));
}

function entitlementStatus(inputs: ModuleFlagInputs, module: ModuleId): EntitlementStatus {
    if (MODULE_REGISTRY[module].entitlement === 'none') return 'not_required';
    const grant = inputs.grants.get(module);
    if (grant === undefined) return inputs.mode === 'open' ? 'not_required' : 'none';
    if (grant.status === 'revoked') return 'revoked';
    return grantIsLive(grant, inputs.now) ? grant.status : 'expired';
}

export function moduleState(inputs: ModuleFlagInputs, module: ModuleId): ModuleState {
    const available = inputs.released.has(module);
    const legacy = MODULE_REGISTRY[module].entitlement === 'none';
    return {
        module,
        available,
        enabled: available && inputs.toggled.has(module),
        entitled: isEntitled(inputs, module),
        entitlementStatus: entitlementStatus(inputs, module),
        entitlementExpiresAt: legacy ? null : (inputs.grants.get(module)?.expiresAt ?? null),
        active: isActive(inputs, module),
        missingDependencies: dependencyClosure(module).filter(d => !isActive(inputs, d)),
        trialAvailable: trialAvailable(inputs, module),
    };
}

/** Every module in MODULE_IDS order. */
export function moduleStates(inputs: ModuleFlagInputs): ModuleState[] {
    return MODULE_IDS.map(m => moduleState(inputs, m));
}
