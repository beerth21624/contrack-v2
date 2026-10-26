// ─── Deleting a workspace: company only, owner only ───
import type { Role, WorkspaceKind } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { WorkspaceErrors } from '../workspace.errors';

export interface WorkspaceDeletionInput {
    kind: WorkspaceKind;
    role: Role;
}

export function checkWorkspaceDeletion(input: WorkspaceDeletionInput): Result<undefined, DomainError> {
    if (input.kind === 'personal') return err(WorkspaceErrors.personalWorkspace('be deleted'));
    if (!can(input.role, 'workspace.delete')) return err(DomainError.forbidden());
    return okVoid();
}
