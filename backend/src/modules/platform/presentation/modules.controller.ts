import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import {
    type ModuleId, type PlatformModulesDto, type PutWorkspaceModuleRequest, type StartTrialResponse, type WorkspaceModuleDto,
    moduleIdSchema, putWorkspaceModuleRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain/ids';
import { CurrentUser, Public } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { ListPlatformModulesUseCase } from '../application/use-cases/list-platform-modules.use-case';
import { ListWorkspaceModulesUseCase } from '../application/use-cases/list-workspace-modules.use-case';
import { SetWorkspaceModuleUseCase } from '../application/use-cases/set-workspace-module.use-case';
import { StartTrialUseCase } from '../application/use-cases/start-trial.use-case';
import { toStartTrialResponse, toWorkspaceModuleDto } from './platform.mapper';

const parseWorkspaceId = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller('platform')
export class PlatformModulesController {
    constructor(private readonly listPlatform: ListPlatformModulesUseCase) {}

    /** What this server offers (public: the web app hides module menus with it before sign-in). */
    @Public()
    @Get('modules')
    modules(): PlatformModulesDto {
        return { modules: this.listPlatform.execute() };
    }
}

@Controller('workspaces/:workspaceId/modules')
export class WorkspaceModulesController {
    constructor(
        private readonly listModules: ListWorkspaceModulesUseCase,
        private readonly setModule: SetWorkspaceModuleUseCase,
        private readonly startTrial: StartTrialUseCase,
    ) {}

    @Get()
    async list(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<WorkspaceModuleDto[]> {
        const views = unwrap(await this.listModules.execute({ actorId: user.userId, workspaceId: parseWorkspaceId(workspaceId) }));
        return views.map(toWorkspaceModuleDto);
    }

    @Put(':module')
    async put(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('module', new ZodPipe(moduleIdSchema)) module: ModuleId,
        @Body(new ZodPipe(putWorkspaceModuleRequestSchema)) body: PutWorkspaceModuleRequest,
    ): Promise<WorkspaceModuleDto> {
        const view = unwrap(await this.setModule.execute({
            actorId: user.userId,
            workspaceId: parseWorkspaceId(workspaceId),
            module,
            enabled: body.enabled,
            confirm: body.confirm,
        }));
        return toWorkspaceModuleDto(view);
    }

    /** Starts the one 30-day trial of the module (and of dependencies the workspace is not entitled to yet). */
    @Post(':module/trial')
    @HttpCode(HttpStatus.OK)
    async trial(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('module', new ZodPipe(moduleIdSchema)) module: ModuleId,
    ): Promise<StartTrialResponse> {
        return toStartTrialResponse(unwrap(await this.startTrial.execute({
            actorId: user.userId,
            workspaceId: parseWorkspaceId(workspaceId),
            module,
        })));
    }
}
