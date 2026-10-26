import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { checkMemberRemoval } from '../../domain/policies/member-removal.policy';
import { countOwners } from '../../domain/policies/owners.policy';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { MembershipRepository } from '../ports/membership.repository';
import { WorkspaceRepository } from '../ports/workspace.repository';

export interface RemoveMemberInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    /** Equal to `actorId` = leave the workspace. */
    targetUserId: UserId;
}

/** Remove a member or leave; rules in `member-removal.policy.ts`, checked under the membership lock. */
@Injectable()
export class RemoveMemberUseCase {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
        private readonly uow: UnitOfWork,
    ) {}

    async execute(input: RemoveMemberInput): Promise<Result<undefined, DomainError>> {
        // Outsiders are turned away before any lock is taken on another tenant's rows.
        if (await this.memberships.find(input.workspaceId, input.actorId) === undefined) return err(WorkspaceErrors.workspaceNotFound());
        const workspace = await this.workspaces.findById(input.workspaceId);
        if (workspace === undefined) return err(WorkspaceErrors.workspaceNotFound());

        return this.uow.run(() => this.memberships.withLockedMembers(workspace.id, async (members): Promise<Result<undefined, DomainError>> => {
            const actor = members.find(m => m.userId === input.actorId);
            if (actor === undefined) return err(WorkspaceErrors.workspaceNotFound());
            const target = members.find(m => m.userId === input.targetUserId);
            if (target === undefined) return err(WorkspaceErrors.memberNotFound());
            const allowed = checkMemberRemoval({
                kind: workspace.kind,
                actor: { userId: actor.userId, role: actor.role },
                target: { userId: target.userId, role: target.role },
                ownerCount: countOwners(members),
            });
            if (!allowed.ok) return allowed;
            await this.memberships.delete(workspace.id, target.userId);
            return okVoid();
        }));
    }
}
