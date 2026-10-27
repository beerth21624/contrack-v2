// ─── Waiting windows after planned tasks (W2, ช่วงรอ): per project, and every project of a workspace (crew board) ───
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
    type ProjectTaskLagsDto, type PutProjectTaskLagsRequest, type WorkspaceTaskLagsDto, putProjectTaskLagsRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    GetProjectTaskLagsUseCase, ListWorkspaceTaskLagsUseCase, PutProjectTaskLagsUseCase,
} from '../application/use-cases/project-task-lags.use-case';
import { projectIdParam, workspaceIdParam } from './route-params';
import { taskLagsToDto } from './workforce.mapper';

@RequiresModule('workforce')
@Controller()
export class TaskLagsController {
    constructor(
        private readonly getLags: GetProjectTaskLagsUseCase,
        private readonly putLags: PutProjectTaskLagsUseCase,
        private readonly listLags: ListWorkspaceTaskLagsUseCase,
    ) {}

    @Get('projects/:projectId/task-lags')
    async get(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<ProjectTaskLagsDto> {
        return taskLagsToDto(unwrap(await this.getLags.execute({ userId: user.userId, projectId: projectIdParam(projectId) })));
    }

    @Put('projects/:projectId/task-lags')
    async put(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(putProjectTaskLagsRequestSchema)) body: PutProjectTaskLagsRequest,
    ): Promise<ProjectTaskLagsDto> {
        return taskLagsToDto(unwrap(await this.putLags.execute({
            userId: user.userId, projectId: projectIdParam(projectId), lags: body.lags,
        })));
    }

    @Get('workspaces/:workspaceId/task-lags')
    async list(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<WorkspaceTaskLagsDto> {
        const list = unwrap(await this.listLags.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId) }));
        return list.map(taskLagsToDto);
    }
}
