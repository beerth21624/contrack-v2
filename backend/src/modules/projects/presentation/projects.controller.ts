import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import {
    type ActivityDto, type CreateRevisionRequest, type LevelAssignmentDto, type ProjectDetailDto, type ProjectDto,
    type PutAssignmentRequest, type PutDocRequest, type PutDocResponse, type RevisionDetailDto, type RevisionDto,
    type UpdateProjectRequest, activityQuerySchema, createRevisionRequestSchema, putAssignmentRequestSchema,
    putDocRequestSchema, updateProjectRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { asUserId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import {
    activityToDto, assignmentToDto, projectDetailToDto, projectDocToDto, projectToDto, revisionToDetailDto, revisionToDto,
} from '../application/project-dto.mapper';
import { CreateRevisionUseCase } from '../application/use-cases/create-revision.use-case';
import { DeleteProjectUseCase } from '../application/use-cases/delete-project.use-case';
import { GetProjectUseCase } from '../application/use-cases/get-project.use-case';
import { GetRevisionUseCase } from '../application/use-cases/get-revision.use-case';
import { ListActivityUseCase } from '../application/use-cases/list-activity.use-case';
import { ListAssignmentsUseCase } from '../application/use-cases/list-assignments.use-case';
import { ListRevisionsUseCase } from '../application/use-cases/list-revisions.use-case';
import { PutAssignmentUseCase } from '../application/use-cases/put-assignment.use-case';
import { PutDocUseCase } from '../application/use-cases/put-doc.use-case';
import { RenameOrArchiveProjectUseCase } from '../application/use-cases/rename-or-archive-project.use-case';
import { docKeyParam, levelIdParam, projectIdParam, revisionIdParam } from './route-params';

type ActivityQuery = z.infer<typeof activityQuerySchema>;

@Controller('projects')
export class ProjectsController {
    constructor(
        private readonly getProject: GetProjectUseCase,
        private readonly renameOrArchive: RenameOrArchiveProjectUseCase,
        private readonly deleteProject: DeleteProjectUseCase,
        private readonly putDoc: PutDocUseCase,
        private readonly listRevisions: ListRevisionsUseCase,
        private readonly createRevision: CreateRevisionUseCase,
        private readonly getRevision: GetRevisionUseCase,
        private readonly listAssignments: ListAssignmentsUseCase,
        private readonly putAssignment: PutAssignmentUseCase,
        private readonly listActivity: ListActivityUseCase,
    ) {}

    @Get(':projectId')
    async get(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<ProjectDetailDto> {
        const found = unwrap(await this.getProject.execute({ userId: user.userId, projectId: projectIdParam(projectId) }));
        return projectDetailToDto(found.project, found.docs);
    }

    @Patch(':projectId')
    async update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(updateProjectRequestSchema)) body: UpdateProjectRequest,
    ): Promise<ProjectDto> {
        const project = unwrap(await this.renameOrArchive.execute({
            userId: user.userId,
            projectId: projectIdParam(projectId),
            name: body.name,
            archived: body.archived,
        }));
        return projectToDto(project);
    }

    @Delete(':projectId')
    @HttpCode(204)
    async remove(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<void> {
        unwrap(await this.deleteProject.execute({ userId: user.userId, projectId: projectIdParam(projectId) }));
    }

    @Put(':projectId/docs/:docKey')
    async putDocument(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('docKey') docKey: string,
        @Body(new ZodPipe(putDocRequestSchema)) body: PutDocRequest,
    ): Promise<PutDocResponse> {
        const id = projectIdParam(projectId);
        const key = docKeyParam(docKey);
        const written = unwrap(await this.putDoc.execute({
            userId: user.userId,
            projectId: id,
            docKey: key,
            data: body.data,
            baseVersion: body.baseVersion,
        }));
        return { doc: projectDocToDto(written.doc), project: projectToDto(written.project) };
    }

    @Get(':projectId/revisions')
    async revisions(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<RevisionDto[]> {
        const list = unwrap(await this.listRevisions.execute({ userId: user.userId, projectId: projectIdParam(projectId) }));
        return list.map(revisionToDto);
    }

    @Post(':projectId/revisions')
    @HttpCode(201)
    async addRevision(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createRevisionRequestSchema)) body: CreateRevisionRequest,
    ): Promise<RevisionDto> {
        const revision = unwrap(await this.createRevision.execute({
            userId: user.userId,
            projectId: projectIdParam(projectId),
            label: body.label,
            note: body.note,
        }));
        return revisionToDto(revision);
    }

    @Get(':projectId/revisions/:revisionId')
    async revision(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('revisionId') revisionId: string,
    ): Promise<RevisionDetailDto> {
        const id = projectIdParam(projectId);
        const revision = unwrap(await this.getRevision.execute({
            userId: user.userId,
            projectId: id,
            revisionId: revisionIdParam(revisionId),
        }));
        return revisionToDetailDto(revision);
    }

    @Get(':projectId/assignments')
    async assignments(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
    ): Promise<LevelAssignmentDto[]> {
        const list = unwrap(await this.listAssignments.execute({ userId: user.userId, projectId: projectIdParam(projectId) }));
        return list.map(assignmentToDto);
    }

    /** Answers JSON `null` when the level is left unassigned (Nest would otherwise send an empty body). */
    @Put(':projectId/assignments/:levelId')
    async assign(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Param('levelId') levelId: string,
        @Body(new ZodPipe(putAssignmentRequestSchema)) body: PutAssignmentRequest,
        @Res() res: Response,
    ): Promise<void> {
        const id = projectIdParam(projectId);
        const level = levelIdParam(levelId);
        const assignment = unwrap(await this.putAssignment.execute({
            userId: user.userId,
            projectId: id,
            levelId: level,
            assigneeId: body.userId === null ? null : asUserId(body.userId.toLowerCase()),
        }));
        const dto: LevelAssignmentDto | null = assignment === null ? null : assignmentToDto(assignment);
        res.status(200).json(dto);
    }

    @Get(':projectId/activity')
    async activity(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Query(new ZodPipe(activityQuerySchema)) query: ActivityQuery,
    ): Promise<ActivityDto[]> {
        const list = unwrap(await this.listActivity.execute({
            userId: user.userId,
            projectId: projectIdParam(projectId),
            before: query.before === undefined ? undefined : BigInt(query.before),
            limit: query.limit,
        }));
        return list.map(activityToDto);
    }
}
