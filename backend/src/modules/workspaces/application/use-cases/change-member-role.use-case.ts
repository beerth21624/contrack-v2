import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { UnitOfWork, UserDirectory } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import type { Membership } from '../../domain/entities/membership.entity';
import { countOwners } from '../../domain/policies/owners.policy';
import { checkRoleChange } from '../../domain/policies/role-change.policy';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { MembershipRepository } from '../ports/membership.repository';
import { WorkspaceRepository } from '../ports/workspace.repository';
import type { MemberView } from './list-members.use-case';

export interface ChangeMemberRoleInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    targetUserId: UserId;
    role: Role;
}

/**
 * Needs `members.changeRole`; rules in `role-change.policy.ts`. The members are read under the membership lock,
 * so two owners demoting each other at the same time cannot leave the workspace without an owner.
 */
@Injectable()
export class ChangeMemberRoleUseCase {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
        private readonly users: UserDirectory,
        private readonly uow: UnitOfWork,
    ) {}

    async execute(input: ChangeMemberRoleInput): Promise<Result<MemberView, DomainError>> {
        // Outsiders are turned away before any lock is taken on another tenant's rows.
        if (await this.memberships.find(input.workspaceId, input.actorId) === undefined) return err(WorkspaceErrors.workspaceNotFound());
        const workspace = await this.workspaces.findById(input.workspaceId);
        if (workspace === undefined) return err(WorkspaceErrors.workspaceNotFound());

        const changed = await this.uow.run(() => this.memberships.withLockedMembers(workspace.id, async (members): Promise<Result<Membership, DomainError>> => {
            const actor = members.find(m => m.userId === input.actorId);
            if (actor === undefined) return err(WorkspaceErrors.workspaceNotFound());
            const target = members.find(m => m.userId === input.targetUserId);
            if (target === undefined) return err(WorkspaceErrors.memberNotFound());
            const allowed = checkRoleChange({
                kind: workspace.kind,
                actor: { userId: actor.userId, role: actor.role },
                target: { userId: target.userId, role: target.role },
                newRole: input.role,
                ownerCount: countOwners(members),
            });
            if (!allowed.ok) return allowed;
            if (target.role !== input.role) {
                target.changeRole(input.role);
                await this.memberships.update(target);
            }
            return ok(target);
        }));
        if (!changed.ok) return changed;

        const profile = (await this.users.findMany([changed.value.userId])).get(changed.value.userId);
        if (profile === undefined) return err(WorkspaceErrors.memberNotFound());
        return ok({ membership: changed.value, profile });
    }
}
