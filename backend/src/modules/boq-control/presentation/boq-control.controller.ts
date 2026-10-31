import { Controller, Get, Param, Query } from '@nestjs/common';
import {
    type BoqVersionCompareDto, type BoqVersionCompareQuery, type BoqVersionDetailDto, type BoqVersionDto, boqVersionCompareQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { CompareBoqVersionsUseCase, GetBoqVersionUseCase, ListBoqVersionsUseCase } from '../application/use-cases/boq-versions.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));

@Controller()
@RequiresModule('boq-control')
export class BoqControlController {
    constructor(
        private readonly list: ListBoqVersionsUseCase,
        private readonly get: GetBoqVersionUseCase,
        private readonly compare: CompareBoqVersionsUseCase,
    ) {}

    @Get('projects/:projectId/boq-versions')
    async listVersions(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<BoqVersionDto[]> {
        return unwrap(await this.list.execute(user.userId, projectIdParam(projectId)));
    }

    @Get('projects/:projectId/boq-versions/compare')
    async compareVersions(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Query(new ZodPipe(boqVersionCompareQuerySchema)) query: BoqVersionCompareQuery,
    ): Promise<BoqVersionCompareDto> {
        const ids = { from: query.from.toLowerCase(), to: query.to.toLowerCase() };
        return unwrap(await this.compare.execute(user.userId, projectIdParam(projectId), ids));
    }

    @Get('boq-versions/:versionId')
    async getVersion(@CurrentUser() user: AuthenticatedUser, @Param('versionId') versionId: string): Promise<BoqVersionDetailDto> {
        return unwrap(await this.get.execute(user.userId, unwrap(parseId<'BoqVersionId'>(versionId, 'BoqVersion'))));
    }
}
