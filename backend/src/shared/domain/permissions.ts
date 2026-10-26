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
    | 'levels.assign';

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
    owner: new Set<Permission>([
        'workspace.read', 'workspace.rename', 'workspace.delete',
        'members.read', 'members.invite', 'members.changeRole', 'members.remove',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
        'revisions.create', 'levels.assign',
    ]),
    admin: new Set<Permission>([
        'workspace.read', 'workspace.rename',
        'members.read', 'members.invite', 'members.changeRole', 'members.remove',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
        'revisions.create', 'levels.assign',
    ]),
    estimator: new Set<Permission>([
        'workspace.read', 'members.read',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive',
        'revisions.create',
    ]),
    viewer: new Set<Permission>(['workspace.read', 'members.read', 'projects.read']),
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
