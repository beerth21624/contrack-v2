import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
    type ProjectSupervisorsDto, type PutProjectSupervisorsRequest, putProjectSupervisorsRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    GetProjectSupervisorsUseCase, PutProjectSupervisorsUseCase,
} from '../application/use-cases/project-supervisors.use-case';
import { projectIdParam } from './route-params';
import { supervisorsToDto } from './workforce.mapper';

@RequiresModule('workforce')
@Controller('projects/:projectId/supervisors')
export class ProjectSupervisorsController {
    constructor(
        private readonly getSupervisors: GetProjectSupervisorsUseCase,
        private readonly putSupervisors: PutProjectSupervisorsUseCase,
    ) {}

    @Get()
    async get(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<ProjectSupervisorsDto> {
        return supervisorsToDto(unwrap(await this.getSupervisors.execute({ userId: user.userId, projectId: projectIdParam(projectId) })));
    }

    @Put()
    async put(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(putProjectSupervisorsRequestSchema)) body: PutProjectSupervisorsRequest,
    ): Promise<ProjectSupervisorsDto> {
        return supervisorsToDto(unwrap(await this.putSupervisors.execute({
            userId: user.userId, projectId: projectIdParam(projectId), personIds: body.personIds,
        })));
    }
}
