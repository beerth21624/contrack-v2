import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type HubProjectDetailDto, type HubProjectDto, type HubProjectListQuery, type HubSummaryDto, type UpdateHubProjectRequest,
    hubProjectListQuerySchema, updateHubProjectRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    AssignHubProjectCodeUseCase, GetHubProjectUseCase, HubSummaryUseCase, ListHubProjectsUseCase, UpdateHubProjectUseCase,
} from '../application/use-cases/hub.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));
const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));

@Controller()
@RequiresModule('project-hub')
export class HubController {
    constructor(
        private readonly list: ListHubProjectsUseCase,
        private readonly summary: HubSummaryUseCase,
        private readonly get: GetHubProjectUseCase,
        private readonly update: UpdateHubProjectUseCase,
        private readonly assignCode: AssignHubProjectCodeUseCase,
    ) {}

    @Get('workspaces/:workspaceId/hub/projects')
    async listProjects(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(hubProjectListQuerySchema)) query: HubProjectListQuery,
    ): Promise<HubProjectDto[]> {
        return unwrap(await this.list.execute(user.userId, workspaceIdParam(workspaceId), query));
    }

    @Get('workspaces/:workspaceId/hub/summary')
    async getSummary(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<HubSummaryDto> {
        return unwrap(await this.summary.execute(user.userId, workspaceIdParam(workspaceId)));
    }

    @Get('projects/:projectId/hub')
    async getProject(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<HubProjectDetailDto> {
        return unwrap(await this.get.execute(user.userId, projectIdParam(projectId)));
    }

    @Patch('projects/:projectId/hub')
    async patchProject(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(updateHubProjectRequestSchema)) body: UpdateHubProjectRequest,
    ): Promise<HubProjectDetailDto> {
        return unwrap(await this.update.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Post('projects/:projectId/hub/code')
    @HttpCode(200)
    async postCode(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<HubProjectDetailDto> {
        return unwrap(await this.assignCode.execute(user.userId, projectIdParam(projectId)));
    }
}
