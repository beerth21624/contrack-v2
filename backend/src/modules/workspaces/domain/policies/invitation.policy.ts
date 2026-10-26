// ─── Who may invite, and with which role ───
import type { AssignableRole, Role, WorkspaceKind } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import { can, roleRank } from '../../../../shared/domain/permissions';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { WorkspaceErrors } from '../workspace.errors';

export interface InvitationInput {
    kind: WorkspaceKind;
    inviterRole: Role;
    role: AssignableRole;
}

/**
 * - personal workspace → `personal_workspace` (it has exactly one member)
 * - needs `members.invite`
 * - the invited role cannot be stronger than the inviter's (an admin may invite admin / estimator / viewer)
 */
export function checkInvitation(input: InvitationInput): Result<undefined, DomainError> {
    if (input.kind === 'personal') return err(WorkspaceErrors.personalWorkspace('invite members'));
    if (!can(input.inviterRole, 'members.invite')) return err(DomainError.forbidden());
    if (roleRank(input.role) > roleRank(input.inviterRole)) {
        return err(DomainError.forbidden('You cannot invite with a role stronger than your own'));
    }
    return okVoid();
}
