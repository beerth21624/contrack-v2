// ─── What a role may do (the server's own matrix from the contract; the server always decides, the UI only hides what would fail) ───
import { can, roleRank, type Role } from '@/shared/contract';

export { PERMISSIONS, can, roleRank, type Permission } from '@/shared/contract';

/** The ERP working roles: offered only while the ERP (`project-hub`) is active for the workspace. */
export const ERP_ROLES: readonly Role[] = ['pm', 'purchasing', 'accounting', 'foreman'];

/**
 * Roles `actor` may give to someone (an invitation or a role change). Only an owner hands out ownership.
 * `includeErp` adds the ERP roles (between estimator and viewer); without it the list is release 1's.
 */
export function grantableRoles(actor: Role, includeOwner: boolean, includeErp = false): Role[] {
    const all: Role[] = [
        ...(includeOwner ? ['owner' as const] : []),
        'admin', 'estimator',
        ...(includeErp ? ERP_ROLES : []),
        'viewer',
    ];
    return all.filter(r => (r === 'owner' ? actor === 'owner' : roleRank(r) <= roleRank(actor)));
}

/** Whether `actor` may change or remove a member with role `target` (an admin never touches an owner). */
export function canManage(actor: Role, target: Role): boolean {
    if (!can(actor, 'members.changeRole')) return false;
    return actor === 'owner' || roleRank(target) < roleRank('owner');
}
