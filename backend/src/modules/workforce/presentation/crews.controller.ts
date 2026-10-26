import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { z } from 'zod';
import {
    type CrewDto, type UpdateCrewRequest, createCrewRequestSchema, updateCrewRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { ArchiveCrewUseCase } from '../application/use-cases/archive-crew.use-case';
import { CreateCrewUseCase } from '../application/use-cases/create-crew.use-case';
import { ListCrewsUseCase } from '../application/use-cases/list-crews.use-case';
import { UpdateCrewUseCase } from '../application/use-cases/update-crew.use-case';
import { crewIdParam, workspaceIdParam } from './route-params';
import { crewToDto } from './workforce.mapper';

/** The body after zod (defaults applied: memberIds []). */
type ParsedCreateCrew = z.infer<typeof createCrewRequestSchema>;

@RequiresModule('workforce')
@Controller('workspaces/:workspaceId/crews')
export class CrewsController {
    constructor(
        private readonly listCrews: ListCrewsUseCase,
        private readonly createCrew: CreateCrewUseCase,
        private readonly updateCrew: UpdateCrewUseCase,
        private readonly archiveCrew: ArchiveCrewUseCase,
    ) {}

    @Get()
    async list(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<CrewDto[]> {
        const { role, crews } = unwrap(await this.listCrews.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId) }));
        return crews.map(c => crewToDto(c, role));
    }

    @Post()
    @HttpCode(201)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createCrewRequestSchema)) body: ParsedCreateCrew,
    ): Promise<CrewDto> {
        const { role, ...priced } = unwrap(await this.createCrew.execute({
            ...body, userId: user.userId, workspaceId: workspaceIdParam(workspaceId),
        }));
        return crewToDto(priced, role);
    }

    @Patch(':crewId')
    async update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('crewId') crewId: string,
        @Body(new ZodPipe(updateCrewRequestSchema)) body: UpdateCrewRequest,
    ): Promise<CrewDto> {
        const { role, ...priced } = unwrap(await this.updateCrew.execute({
            ...body, userId: user.userId, workspaceId: workspaceIdParam(workspaceId), crewId: crewIdParam(crewId),
        }));
        return crewToDto(priced, role);
    }

    /** Archive (soft delete). */
    @Delete(':crewId')
    @HttpCode(204)
    async archive(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('crewId') crewId: string,
    ): Promise<void> {
        unwrap(await this.archiveCrew.execute({
            userId: user.userId, workspaceId: workspaceIdParam(workspaceId), crewId: crewIdParam(crewId),
        }));
    }
}
