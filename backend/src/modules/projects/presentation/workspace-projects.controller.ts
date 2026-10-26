import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { z } from 'zod';
import {
    type CreateProjectRequest, type ProjectDetailDto, type ProjectDto, createProjectRequestSchema, listProjectsQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { projectDetailToDto, projectToDto } from '../application/project-dto.mapper';
import { CreateProjectUseCase } from '../application/use-cases/create-project.use-case';
import { ListProjectsUseCase } from '../application/use-cases/list-projects.use-case';
import { workspaceIdParam } from './route-params';

type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

@Controller('workspaces/:workspaceId/projects')
export class WorkspaceProjectsController {
    constructor(private readonly listProjects: ListProjectsUseCase, private readonly createProject: CreateProjectUseCase) {}

    @Get()
    async list(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(listProjectsQuerySchema)) query: ListProjectsQuery,
    ): Promise<ProjectDto[]> {
        const projects = unwrap(await this.listProjects.execute({
            userId: user.userId,
            workspaceId: workspaceIdParam(workspaceId),
            archived: query.archived === 'true',
        }));
        return projects.map(projectToDto);
    }

    @Post()
    @HttpCode(201)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createProjectRequestSchema)) body: CreateProjectRequest,
    ): Promise<ProjectDetailDto> {
        const created = unwrap(await this.createProject.execute({
            userId: user.userId,
            workspaceId: workspaceIdParam(workspaceId),
            name: body.name,
            start: body.start,
            docs: body.docs,
        }));
        return projectDetailToDto(created.project, created.docs);
    }
}
