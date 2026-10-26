import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
    type AcceptInvitationRequest, type AcceptInvitationResponse, type CreateInvitationRequest,
    type CreateInvitationResponse, type InvitationDto, acceptInvitationRequestSchema, createInvitationRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type InvitationId, parseId } from '../../../shared/domain/ids';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { AcceptInvitationUseCase } from '../application/use-cases/accept-invitation.use-case';
import { CreateInvitationUseCase } from '../application/use-cases/create-invitation.use-case';
import { ListPendingInvitationsUseCase } from '../application/use-cases/list-pending-invitations.use-case';
import { RevokeInvitationUseCase } from '../application/use-cases/revoke-invitation.use-case';
import {
    toAcceptInvitationResponse, toCreateInvitationResponse, toInvitationDto,
} from './workspaces.mapper';
import { parseWorkspaceId } from './workspaces.controller';

const parseInvitationId = (raw: string): InvitationId => unwrap(parseId<'InvitationId'>(raw, 'Invitation'));

@Controller()
export class InvitationsController {
    constructor(
        private readonly listPending: ListPendingInvitationsUseCase,
        private readonly createInvitation: CreateInvitationUseCase,
        private readonly revokeInvitation: RevokeInvitationUseCase,
        private readonly acceptInvitation: AcceptInvitationUseCase,
    ) {}

    @Get('workspaces/:workspaceId/invitations')
    async list(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<InvitationDto[]> {
        return unwrap(await this.listPending.execute({ actorId: user.userId, workspaceId: parseWorkspaceId(workspaceId) }))
            .map(toInvitationDto);
    }

    @Post('workspaces/:workspaceId/invitations')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createInvitationRequestSchema)) body: CreateInvitationRequest,
    ): Promise<CreateInvitationResponse> {
        const input = { actorId: user.userId, workspaceId: parseWorkspaceId(workspaceId), email: body.email, role: body.role };
        return toCreateInvitationResponse(unwrap(await this.createInvitation.execute(input)));
    }

    @Delete('workspaces/:workspaceId/invitations/:invitationId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async revoke(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('invitationId') invitationId: string,
    ): Promise<void> {
        const input = {
            actorId: user.userId,
            workspaceId: parseWorkspaceId(workspaceId),
            invitationId: parseInvitationId(invitationId),
        };
        unwrap(await this.revokeInvitation.execute(input));
    }

    @Post('invitations/accept')
    @HttpCode(HttpStatus.OK)
    async accept(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodPipe(acceptInvitationRequestSchema)) body: AcceptInvitationRequest,
    ): Promise<AcceptInvitationResponse> {
        return toAcceptInvitationResponse(unwrap(await this.acceptInvitation.execute({ userId: user.userId, token: body.token })));
    }
}
