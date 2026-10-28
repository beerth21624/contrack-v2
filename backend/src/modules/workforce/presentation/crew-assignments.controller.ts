import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type CreateCrewAssignmentRequest, type CrewAssignmentDto, type CrewAssignmentQuery, type UpdateCrewAssignmentRequest,
    createCrewAssignmentRequestSchema, crewAssignmentQuerySchema, updateCrewAssignmentRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { asCrewId, asProjectId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { CreateCrewAssignmentUseCase } from '../application/use-cases/create-crew-assignment.use-case';
import { DeleteCrewAssignmentUseCase } from '../application/use-cases/delete-crew-assignment.use-case';
import { ListCrewAssignmentsUseCase } from '../application/use-cases/list-crew-assignments.use-case';
import { UpdateCrewAssignmentUseCase } from '../application/use-cases/update-crew-assignment.use-case';
import { assignmentIdParam, workspaceIdParam } from './route-params';
import { assignmentToDto } from './workforce.mapper';

/** Ids validated as UUIDs by the contract schemas; stored lower-cased. */
const lower = (id: string): string => id.toLowerCase();

@RequiresModule('workforce')
@Controller('workspaces/:workspaceId/crew-assignments')
export class CrewAssignmentsController {
    constructor(
        private readonly listAssignments: ListCrewAssignmentsUseCase,
        private readonly createAssignment: CreateCrewAssignmentUseCase,
        private readonly updateAssignment: UpdateCrewAssignmentUseCase,
        private readonly deleteAssignment: DeleteCrewAssignmentUseCase,
    ) {}

    /** `?projectId&crewId&from&to` (all optional): `from`/`to` keep the assignments whose days overlap the range. */
    @Get()
    async list(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(crewAssignmentQuerySchema)) query: CrewAssignmentQuery,
    ): Promise<CrewAssignmentDto[]> {
        const list = unwrap(await this.listAssignments.execute({
            userId: user.userId,
            workspaceId: workspaceIdParam(workspaceId),
            ...(query.projectId === undefined ? {} : { projectId: asProjectId(lower(query.projectId)) }),
            ...(query.crewId === undefined ? {} : { crewId: asCrewId(lower(query.crewId)) }),
            ...(query.from === undefined ? {} : { from: query.from }),
            ...(query.to === undefined ? {} : { to: query.to }),
        }));
        return list.map(assignmentToDto);
    }

    @Post()
    @HttpCode(201)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createCrewAssignmentRequestSchema)) body: CreateCrewAssignmentRequest,
    ): Promise<CrewAssignmentDto> {
        const assignment = unwrap(await this.createAssignment.execute({
            userId: user.userId,
            workspaceId: workspaceIdParam(workspaceId),
            projectId: asProjectId(lower(body.projectId)),
            taskId: body.taskId,
            crewId: asCrewId(lower(body.crewId)),
            start: body.start,
            end: body.end,
            note: body.note,
        }));
        return assignmentToDto(assignment);
    }

    @Patch(':assignmentId')
    async update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('assignmentId') assignmentId: string,
        @Body(new ZodPipe(updateCrewAssignmentRequestSchema)) body: UpdateCrewAssignmentRequest,
    ): Promise<CrewAssignmentDto> {
        const assignment = unwrap(await this.updateAssignment.execute({
            userId: user.userId,
            workspaceId: workspaceIdParam(workspaceId),
            assignmentId: assignmentIdParam(assignmentId),
            ...(body.crewId === undefined ? {} : { crewId: asCrewId(lower(body.crewId)) }),
            start: body.start,
            end: body.end,
            note: body.note,
        }));
        return assignmentToDto(assignment);
    }

    @Delete(':assignmentId')
    @HttpCode(204)
    async remove(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('assignmentId') assignmentId: string,
    ): Promise<void> {
        unwrap(await this.deleteAssignment.execute({
            userId: user.userId, workspaceId: workspaceIdParam(workspaceId), assignmentId: assignmentIdParam(assignmentId),
        }));
    }
}
