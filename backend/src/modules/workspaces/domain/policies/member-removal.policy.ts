// ─── Who may remove whom (removing yourself = leaving) ───
import type { WorkspaceKind } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import { can, roleRank } from '../../../../shared/domain/permissions';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { WorkspaceErrors } from '../workspace.errors';
import { wouldLeaveNoOwner } from './owners.policy';
import type { MemberRef } from './role-change.policy';

export interface MemberRemovalInput {
    kind: WorkspaceKind;
    actor: MemberRef;
    target: MemberRef;
    /** Owners in the workspace right now (read under the membership lock). */
    ownerCount: number;
}

/**
 * - personal workspace → `personal_workspace`
 * - anyone may leave, except the last owner (`last_owner`)
 * - removing someone else needs `members.remove` and a rank ≥ the target's rank
 */
export function checkMemberRemoval(input: MemberRemovalInput): Result<undefined, DomainError> {
    const { kind, actor, target, ownerCount } = input;
    if (kind === 'personal') return err(WorkspaceErrors.personalWorkspace('remove members'));
    const leaving = actor.userId === target.userId;
    if (!leaving) {
        if (!can(actor.role, 'members.remove')) return err(DomainError.forbidden());
        if (roleRank(actor.role) < roleRank(target.role)) return err(DomainError.forbidden('You cannot remove a stronger member'));
    }
    if (wouldLeaveNoOwner(target.role, null, ownerCount)) return err(WorkspaceErrors.lastOwner());
    return okVoid();
}
