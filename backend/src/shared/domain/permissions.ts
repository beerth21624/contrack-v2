// ─── Who may do what inside a workspace (one matrix for every module) ───
import type { Role } from '@contrack/contract';

export type Permission =
    | 'workspace.read'
    | 'workspace.rename'
    | 'workspace.delete'
    | 'members.read'
    | 'members.invite'
    | 'members.changeRole'
    | 'members.remove'
    | 'projects.read'
    | 'projects.create'
    | 'projects.edit'
    | 'projects.archive'
    | 'projects.delete'
    | 'revisions.create'
    | 'levels.assign'
    // module switches
    | 'modules.manage'
    // subcontracting, buyer side (docs/marketplace/01 §10); some are widened by workspace settings in the use case
    | 'sc.read' | 'sc.readPrices' | 'sc.vendors.manage' | 'sc.packages.manage' | 'sc.award'
    | 'sc.claims.inspect' | 'sc.claims.approve' | 'sc.payments.record' | 'sc.settings'
    // subcontracting, vendor side (the crew's own workspace)
    | 'vendor.read' | 'vendor.bid.draft' | 'vendor.bid.submit' | 'vendor.contract.act' | 'vendor.profile.edit';

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
    owner: new Set<Permission>([
        'workspace.read', 'workspace.rename', 'workspace.delete',
        'members.read', 'members.invite', 'members.changeRole', 'members.remove',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
        'revisions.create', 'levels.assign',
        'modules.manage',
        'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.award',
        'sc.claims.inspect', 'sc.claims.approve', 'sc.payments.record', 'sc.settings',
        'vendor.read', 'vendor.bid.draft', 'vendor.bid.submit', 'vendor.contract.act', 'vendor.profile.edit',
    ]),
    admin: new Set<Permission>([
        'workspace.read', 'workspace.rename',
        'members.read', 'members.invite', 'members.changeRole', 'members.remove',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
        'revisions.create', 'levels.assign',
        'modules.manage',
        'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.award',
        'sc.claims.inspect', 'sc.claims.approve', 'sc.payments.record', 'sc.settings',
        'vendor.read', 'vendor.bid.draft', 'vendor.bid.submit', 'vendor.contract.act', 'vendor.profile.edit',
    ]),
    estimator: new Set<Permission>([
        'workspace.read', 'members.read',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive',
        'revisions.create',
        'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.claims.inspect',
        'vendor.read', 'vendor.bid.draft',
    ]),
    viewer: new Set<Permission>(['workspace.read', 'members.read', 'projects.read', 'sc.read', 'vendor.read']),
};

export function can(role: Role, permission: Permission): boolean {
    return MATRIX[role].has(permission);
}

/** Strength of a role (owner 3 … viewer 0): an admin may not change or remove someone stronger. */
export function roleRank(role: Role): number {
    switch (role) {
        case 'owner': return 3;
        case 'admin': return 2;
        case 'estimator': return 1;
        case 'viewer': return 0;
    }
}
