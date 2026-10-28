import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { z } from 'zod';
import {
    type PersonDto, type UpdatePersonRequest, createPersonRequestSchema, updatePersonRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { ArchivePersonUseCase } from '../application/use-cases/archive-person.use-case';
import { CreatePersonUseCase } from '../application/use-cases/create-person.use-case';
import { ListPeopleUseCase } from '../application/use-cases/list-people.use-case';
import { UpdatePersonUseCase } from '../application/use-cases/update-person.use-case';
import { personIdParam, workspaceIdParam } from './route-params';
import { personToDto } from './workforce.mapper';

/** The body after zod (defaults applied: trades []). */
type ParsedCreatePerson = z.infer<typeof createPersonRequestSchema>;

@RequiresModule('workforce')
@Controller('workspaces/:workspaceId/people')
export class PeopleController {
    constructor(
        private readonly listPeople: ListPeopleUseCase,
        private readonly createPerson: CreatePersonUseCase,
        private readonly updatePerson: UpdatePersonUseCase,
        private readonly archivePerson: ArchivePersonUseCase,
    ) {}

    @Get()
    async list(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<PersonDto[]> {
        const { role, people } = unwrap(await this.listPeople.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId) }));
        return people.map(p => personToDto(p, role));
    }

    @Post()
    @HttpCode(201)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createPersonRequestSchema)) body: ParsedCreatePerson,
    ): Promise<PersonDto> {
        const { role, person } = unwrap(await this.createPerson.execute({
            ...body, userId: user.userId, workspaceId: workspaceIdParam(workspaceId),
        }));
        return personToDto(person, role);
    }

    @Patch(':personId')
    async update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('personId') personId: string,
        @Body(new ZodPipe(updatePersonRequestSchema)) body: UpdatePersonRequest,
    ): Promise<PersonDto> {
        const { role, person } = unwrap(await this.updatePerson.execute({
            ...body, userId: user.userId, workspaceId: workspaceIdParam(workspaceId), personId: personIdParam(personId),
        }));
        return personToDto(person, role);
    }

    /** Archive (soft delete). */
    @Delete(':personId')
    @HttpCode(204)
    async archive(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('personId') personId: string,
    ): Promise<void> {
        unwrap(await this.archivePerson.execute({
            userId: user.userId, workspaceId: workspaceIdParam(workspaceId), personId: personIdParam(personId),
        }));
    }
}
