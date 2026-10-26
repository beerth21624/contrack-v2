// ─── MemberAssignmentCleanup (shared port) → RemoveMemberAssignmentsUseCase ───
// The caller (workspaces) runs this inside its own transaction, so the removal commits or rolls back with the
// membership change. Realtime must wait for that COMMIT, which only the caller sees, so the after-commit step
// (publishing the cleared assignments) is handed back and the caller runs it once its transaction committed.
import { Injectable } from '@nestjs/common';
import { MemberAssignmentCleanup } from '../../../../shared/application/ports';
import type { UserId, WorkspaceId } from '../../../../shared/domain';
import { RemoveMemberAssignmentsUseCase } from '../../application/use-cases/remove-member-assignments.use-case';

@Injectable()
export class ProjectsMemberAssignmentCleanup extends MemberAssignmentCleanup {
    constructor(private readonly removeAssignments: RemoveMemberAssignmentsUseCase) {
        super();
    }

    async removeUser(workspaceId: WorkspaceId, userId: UserId): Promise<() => Promise<void>> {
        return (await this.removeAssignments.execute(workspaceId, userId)).publish;
    }
}
