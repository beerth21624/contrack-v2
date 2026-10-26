// ─── Who may change whose role ───
import type { Role, WorkspaceKind } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { can, roleRank } from '../../../../shared/domain/permissions';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { WorkspaceErrors } from '../workspace.errors';
import { wouldLeaveNoOwner } from './owners.policy';

export interface MemberRef {
    userId: UserId;
    role: Role;
}

export interface RoleChangeInput {
    kind: WorkspaceKind;
    actor: MemberRef;
    target: MemberRef;
    newRole: Role;
    /** Owners in the workspace right now (read under the membership lock). */
    ownerCount: number;
}

/**
 * - personal workspace → `personal_workspace`
 * - needs `members.changeRole`
 * - only an owner grants or takes away `owner` (an admin cannot touch an owner)
 * - a non-owner cannot change someone stronger, nor grant a role stronger than their own
 * - never leave 0 owners (`last_owner`) — an owner may demote themselves only if another owner remains
 */
export function checkRoleChange(input: RoleChangeInput): Result<undefined, DomainError> {
    const { kind, actor, target, newRole, ownerCount } = input;
    if (kind === 'personal') return err(WorkspaceErrors.personalWorkspace('change member roles'));
    if (!can(actor.role, 'members.changeRole')) return err(DomainError.forbidden());
    const touchesOwner = target.role === 'owner' || newRole === 'owner';
    if (touchesOwner && actor.role !== 'owner') return err(DomainError.forbidden('Only an owner can grant or remove ownership'));
    if (roleRank(target.role) > roleRank(actor.role)) return err(DomainError.forbidden('You cannot change a stronger member'));
    if (roleRank(newRole) > roleRank(actor.role)) return err(DomainError.forbidden('You cannot grant a role stronger than your own'));
    if (wouldLeaveNoOwner(target.role, newRole, ownerCount)) return err(WorkspaceErrors.lastOwner());
    return okVoid();
}
