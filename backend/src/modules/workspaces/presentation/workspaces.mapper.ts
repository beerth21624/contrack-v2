// ─── Entities / views → contract DTOs (dates → ISO strings) ───
import type {
    AcceptInvitationResponse, CreateInvitationResponse, InvitationDto, MemberDto, WorkspaceDto,
} from '@contrack/contract';
import type { AcceptedInvitation } from '../application/use-cases/accept-invitation.use-case';
import type { CreatedInvitation } from '../application/use-cases/create-invitation.use-case';
import type { WorkspaceView } from '../application/use-cases/get-workspace.use-case';
import type { MemberView } from '../application/use-cases/list-members.use-case';
import type { Invitation } from '../domain/entities/invitation.entity';

export function toWorkspaceDto(view: WorkspaceView): WorkspaceDto {
    return {
        id: view.workspace.id,
        name: view.workspace.name.value,
        kind: view.workspace.kind,
        role: view.role,
        memberCount: view.memberCount,
        createdAt: view.workspace.createdAt.toISOString(),
    };
}

export function toMemberDto(view: MemberView): MemberDto {
    return {
        userId: view.membership.userId,
        email: view.profile.email,
        displayName: view.profile.displayName,
        role: view.membership.role,
        joinedAt: view.membership.joinedAt.toISOString(),
    };
}

export function toInvitationDto(invitation: Invitation): InvitationDto {
    return {
        id: invitation.id,
        email: invitation.email.value,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
    };
}

export function toCreateInvitationResponse(created: CreatedInvitation): CreateInvitationResponse {
    return { invitation: toInvitationDto(created.invitation), token: created.token };
}

export function toAcceptInvitationResponse(accepted: AcceptedInvitation): AcceptInvitationResponse {
    return { workspaceId: accepted.workspaceId, role: accepted.role };
}
