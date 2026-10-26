// ─── Expected failures of the workspaces context (codes come from the shared contract) ───
import { DomainError } from '../../../shared/domain/domain-error';

export const WorkspaceErrors = {
    /** Also returned to non-members (never reveal that another tenant's workspace exists). */
    workspaceNotFound: (): DomainError => DomainError.notFound('Workspace'),
    memberNotFound: (): DomainError => DomainError.notFound('Member'),
    invitationNotFound: (): DomainError => DomainError.notFound('Invitation'),
    personalWorkspace: (action: string): DomainError =>
        new DomainError('personal_workspace', `A personal workspace cannot ${action}`),
    lastOwner: (): DomainError => new DomainError('last_owner', 'A workspace must keep at least one owner'),
    /** Same answer for unknown, used, revoked, expired and someone else's invitation. */
    invitationInvalid: (): DomainError => new DomainError('invitation_invalid', 'This invitation is no longer valid'),
};
