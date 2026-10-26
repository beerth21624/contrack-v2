import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { type ChangeRoleRequest, type MemberDto, changeRoleRequestSchema } from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type UserId, parseId } from '../../../shared/domain/ids';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { ChangeMemberRoleUseCase } from '../application/use-cases/change-member-role.use-case';
import { ListMembersUseCase } from '../application/use-cases/list-members.use-case';
import { RemoveMemberUseCase } from '../application/use-cases/remove-member.use-case';
import { toMemberDto } from './workspaces.mapper';
import { parseWorkspaceId } from './workspaces.controller';

const parseUserId = (raw: string): UserId => unwrap(parseId<'UserId'>(raw, 'Member'));

@Controller('workspaces/:workspaceId/members')
export class MembersController {
    constructor(
        private readonly listMembers: ListMembersUseCase,
        private readonly changeRole: ChangeMemberRoleUseCase,
        private readonly removeMember: RemoveMemberUseCase,
    ) {}

    @Get()
    async list(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<MemberDto[]> {
        return unwrap(await this.listMembers.execute({ actorId: user.userId, workspaceId: parseWorkspaceId(workspaceId) }))
            .map(toMemberDto);
    }

    @Patch(':userId')
    async patch(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('userId') userId: string,
        @Body(new ZodPipe(changeRoleRequestSchema)) body: ChangeRoleRequest,
    ): Promise<MemberDto> {
        const input = {
            actorId: user.userId,
            workspaceId: parseWorkspaceId(workspaceId),
            targetUserId: parseUserId(userId),
            role: body.role,
        };
        return toMemberDto(unwrap(await this.changeRole.execute(input)));
    }

    /** Removing yourself = leaving the workspace. */
    @Delete(':userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('userId') userId: string,
    ): Promise<void> {
        const input = { actorId: user.userId, workspaceId: parseWorkspaceId(workspaceId), targetUserId: parseUserId(userId) };
        unwrap(await this.removeMember.execute(input));
    }
}
