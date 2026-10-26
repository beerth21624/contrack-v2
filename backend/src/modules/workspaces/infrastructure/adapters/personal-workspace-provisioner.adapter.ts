// ─── Shared port PersonalWorkspaceProvisioner (called by identity inside its registration transaction) ───
import { Injectable } from '@nestjs/common';
import { PersonalWorkspaceProvisioner } from '../../../../shared/application/ports';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { ProvisionPersonalWorkspaceUseCase } from '../../application/use-cases/provision-personal-workspace.use-case';

/** Throws on failure (a bug, e.g. an invalid name): the registration transaction must roll back. */
@Injectable()
export class UseCasePersonalWorkspaceProvisioner extends PersonalWorkspaceProvisioner {
    constructor(private readonly provisionUseCase: ProvisionPersonalWorkspaceUseCase) {
        super();
    }

    async provision(userId: UserId, displayName: string): Promise<WorkspaceId> {
        const result = await this.provisionUseCase.execute({ userId, displayName });
        if (!result.ok) throw new Error(`Could not provision the personal workspace: ${result.error.message}`);
        return result.value.id;
    }
}
