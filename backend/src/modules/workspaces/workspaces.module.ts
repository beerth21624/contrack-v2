import { Global, Module } from '@nestjs/common';
import { MembershipDirectory, PersonalWorkspaceProvisioner, WorkspaceAccess, WorkspaceDirectory } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { InvitationRepository } from './application/ports/invitation.repository';
import { MembershipRepository } from './application/ports/membership.repository';
import { WorkspaceRepository } from './application/ports/workspace.repository';
import { AcceptInvitationUseCase } from './application/use-cases/accept-invitation.use-case';
import { ChangeMemberRoleUseCase } from './application/use-cases/change-member-role.use-case';
import { CreateCompanyWorkspaceUseCase } from './application/use-cases/create-company-workspace.use-case';
import { CreateInvitationUseCase } from './application/use-cases/create-invitation.use-case';
import { DeleteWorkspaceUseCase } from './application/use-cases/delete-workspace.use-case';
import { GetWorkspaceUseCase } from './application/use-cases/get-workspace.use-case';
import { ListMembersUseCase } from './application/use-cases/list-members.use-case';
import { ListMyWorkspacesUseCase } from './application/use-cases/list-my-workspaces.use-case';
import { ListPendingInvitationsUseCase } from './application/use-cases/list-pending-invitations.use-case';
import { ProvisionPersonalWorkspaceUseCase } from './application/use-cases/provision-personal-workspace.use-case';
import { RemoveMemberUseCase } from './application/use-cases/remove-member.use-case';
import { RenameWorkspaceUseCase } from './application/use-cases/rename-workspace.use-case';
import { RevokeInvitationUseCase } from './application/use-cases/revoke-invitation.use-case';
import { DrizzleInvitationRepository } from './infrastructure/adapters/drizzle-invitation.repository';
import { DrizzleMembershipRepository } from './infrastructure/adapters/drizzle-membership.repository';
import { DrizzleWorkspaceRepository } from './infrastructure/adapters/drizzle-workspace.repository';
import { InMemoryInvitationRepository } from './infrastructure/adapters/in-memory-invitation.repository';
import { InMemoryMembershipRepository } from './infrastructure/adapters/in-memory-membership.repository';
import { InMemoryWorkspaceRepository } from './infrastructure/adapters/in-memory-workspace.repository';
import { RepositoryMembershipDirectory } from './infrastructure/adapters/membership-directory.adapter';
import { RepositoryWorkspaceDirectory } from './infrastructure/adapters/workspace-directory.adapter';
import { UseCasePersonalWorkspaceProvisioner } from './infrastructure/adapters/personal-workspace-provisioner.adapter';
import { RepositoryWorkspaceAccess } from './infrastructure/adapters/workspace-access.adapter';
import { InvitationsController } from './presentation/invitations.controller';
import { MembersController } from './presentation/members.controller';
import { WorkspacesController } from './presentation/workspaces.controller';

/**
 * Workspaces (tenants), members, roles, invitations. Exports the shared ports WorkspaceAccess,
 * PersonalWorkspaceProvisioner and MembershipDirectory. Needs UserDirectory (provided by identity).
 */
@Global()
@Module({
    controllers: [WorkspacesController, MembersController, InvitationsController],
    providers: [
        persistence(WorkspaceRepository, () => new InMemoryWorkspaceRepository(), ctx => new DrizzleWorkspaceRepository(ctx)),
        persistence(MembershipRepository, () => new InMemoryMembershipRepository(), ctx => new DrizzleMembershipRepository(ctx)),
        persistence(InvitationRepository, () => new InMemoryInvitationRepository(), ctx => new DrizzleInvitationRepository(ctx)),
        CreateCompanyWorkspaceUseCase,
        ListMyWorkspacesUseCase,
        GetWorkspaceUseCase,
        RenameWorkspaceUseCase,
        DeleteWorkspaceUseCase,
        ListMembersUseCase,
        ChangeMemberRoleUseCase,
        RemoveMemberUseCase,
        CreateInvitationUseCase,
        ListPendingInvitationsUseCase,
        RevokeInvitationUseCase,
        AcceptInvitationUseCase,
        ProvisionPersonalWorkspaceUseCase,
        { provide: WorkspaceAccess, useClass: RepositoryWorkspaceAccess },
        { provide: MembershipDirectory, useClass: RepositoryMembershipDirectory },
        { provide: PersonalWorkspaceProvisioner, useClass: UseCasePersonalWorkspaceProvisioner },
        { provide: WorkspaceDirectory, useClass: RepositoryWorkspaceDirectory },
    ],
    exports: [WorkspaceAccess, MembershipDirectory, PersonalWorkspaceProvisioner, WorkspaceDirectory],
})
export class WorkspacesModule {}
