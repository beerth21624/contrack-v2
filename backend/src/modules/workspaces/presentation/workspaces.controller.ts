import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
    type CreateWorkspaceRequest, type RenameWorkspaceRequest, type WorkspaceDto,
    createWorkspaceRequestSchema, renameWorkspaceRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain/ids';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { CreateCompanyWorkspaceUseCase } from '../application/use-cases/create-company-workspace.use-case';
import { DeleteWorkspaceUseCase } from '../application/use-cases/delete-workspace.use-case';
import { GetWorkspaceUseCase } from '../application/use-cases/get-workspace.use-case';
import { ListMyWorkspacesUseCase } from '../application/use-cases/list-my-workspaces.use-case';
import { RenameWorkspaceUseCase } from '../application/use-cases/rename-workspace.use-case';
import { toWorkspaceDto } from './workspaces.mapper';

export const parseWorkspaceId = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller('workspaces')
export class WorkspacesController {
    constructor(
        private readonly listMine: ListMyWorkspacesUseCase,
        private readonly createCompany: CreateCompanyWorkspaceUseCase,
        private readonly getOne: GetWorkspaceUseCase,
        private readonly rename: RenameWorkspaceUseCase,
        private readonly remove: DeleteWorkspaceUseCase,
    ) {}

    @Get()
    async list(@CurrentUser() user: AuthenticatedUser): Promise<WorkspaceDto[]> {
        return unwrap(await this.listMine.execute({ actorId: user.userId })).map(toWorkspaceDto);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodPipe(createWorkspaceRequestSchema)) body: CreateWorkspaceRequest,
    ): Promise<WorkspaceDto> {
        return toWorkspaceDto(unwrap(await this.createCompany.execute({ actorId: user.userId, name: body.name })));
    }

    @Get(':workspaceId')
    async get(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<WorkspaceDto> {
        return toWorkspaceDto(unwrap(await this.getOne.execute({ actorId: user.userId, workspaceId: parseWorkspaceId(workspaceId) })));
    }

    @Patch(':workspaceId')
    async patch(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(renameWorkspaceRequestSchema)) body: RenameWorkspaceRequest,
    ): Promise<WorkspaceDto> {
        const id = parseWorkspaceId(workspaceId);
        return toWorkspaceDto(unwrap(await this.rename.execute({ actorId: user.userId, workspaceId: id, name: body.name })));
    }

    @Delete(':workspaceId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<void> {
        unwrap(await this.remove.execute({ actorId: user.userId, workspaceId: parseWorkspaceId(workspaceId) }));
    }
}
