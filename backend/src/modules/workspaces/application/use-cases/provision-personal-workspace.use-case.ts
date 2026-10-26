import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, asWorkspaceId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import { Membership } from '../../domain/entities/membership.entity';
import { Workspace } from '../../domain/entities/workspace.entity';
import { WORKSPACE_NAME_MAX_LENGTH, WorkspaceName } from '../../domain/value-objects/workspace-name.value-object';
import { MembershipRepository } from '../ports/membership.repository';
import { WorkspaceRepository } from '../ports/workspace.repository';

export const PERSONAL_SUFFIX = ' (ส่วนตัว)';
const FALLBACK_OWNER_NAME = 'พื้นที่';

/** `"<displayName> (ส่วนตัว)"`, cut so it always fits a workspace name. */
export function personalWorkspaceName(displayName: string): string {
    const base = displayName.trim() === '' ? FALLBACK_OWNER_NAME : displayName.trim();
    return `${base.slice(0, WORKSPACE_NAME_MAX_LENGTH - PERSONAL_SUFFIX.length).trimEnd()}${PERSONAL_SUFFIX}`;
}

export interface ProvisionPersonalWorkspaceInput {
    userId: UserId;
    displayName: string;
}

/**
 * Creates the personal workspace of a newly registered user (the user is its only owner).
 * Called by identity inside the registration transaction; `uow.run` joins that transaction.
 */
@Injectable()
export class ProvisionPersonalWorkspaceUseCase {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: ProvisionPersonalWorkspaceInput): Promise<Result<Workspace, DomainError>> {
        const name = WorkspaceName.create(personalWorkspaceName(input.displayName));
        if (!name.ok) return name;
        const now = this.clock.now();
        const workspace = Workspace.create({ id: asWorkspaceId(this.ids.newId()), name: name.value, kind: 'personal', createdAt: now });
        const owner = Membership.create({ workspaceId: workspace.id, userId: input.userId, role: 'owner', joinedAt: now });
        await this.uow.run(async () => {
            await this.workspaces.insert(workspace);
            await this.memberships.insert(owner);
        });
        return ok(workspace);
    }
}
