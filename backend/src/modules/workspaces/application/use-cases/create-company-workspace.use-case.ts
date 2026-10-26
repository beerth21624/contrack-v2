import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, asWorkspaceId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import { Membership } from '../../domain/entities/membership.entity';
import { Workspace } from '../../domain/entities/workspace.entity';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.value-object';
import { MembershipRepository } from '../ports/membership.repository';
import { WorkspaceRepository } from '../ports/workspace.repository';
import type { WorkspaceView } from './get-workspace.use-case';

export interface CreateCompanyWorkspaceInput {
    actorId: UserId;
    name: string;
}

/** Any signed-in user may create a company workspace; they become its (only) owner. */
@Injectable()
export class CreateCompanyWorkspaceUseCase {
    constructor(
        private readonly workspaces: WorkspaceRepository,
        private readonly memberships: MembershipRepository,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: CreateCompanyWorkspaceInput): Promise<Result<WorkspaceView, DomainError>> {
        const name = WorkspaceName.create(input.name);
        if (!name.ok) return name;
        const now = this.clock.now();
        const workspace = Workspace.create({ id: asWorkspaceId(this.ids.newId()), name: name.value, kind: 'company', createdAt: now });
        const owner = Membership.create({ workspaceId: workspace.id, userId: input.actorId, role: 'owner', joinedAt: now });
        await this.uow.run(async () => {
            await this.workspaces.insert(workspace);
            await this.memberships.insert(owner);
        });
        return ok({ workspace, role: 'owner', memberCount: 1 });
    }
}
