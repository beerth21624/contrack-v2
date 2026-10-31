import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
    type BaselineStatusDto, type BoqVersionCompareDto, type BoqVersionCompareQuery, type BoqVersionDetailDto, type BoqVersionDto, type CostCodeDto,
    type LockBaselineRequest, type UnlockBaselineRequest, boqVersionCompareQuerySchema, lockBaselineRequestSchema, unlockBaselineRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    GetBaselineUseCase, ListCostCodesUseCase, LockBaselineUseCase, UnlockBaselineUseCase,
} from '../application/use-cases/baseline.use-cases';
import { CompareBoqVersionsUseCase, GetBoqVersionUseCase, ListBoqVersionsUseCase } from '../application/use-cases/boq-versions.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));

@Controller()
@RequiresModule('boq-control')
export class BoqControlController {
    constructor(
        private readonly list: ListBoqVersionsUseCase,
        private readonly get: GetBoqVersionUseCase,
        private readonly compare: CompareBoqVersionsUseCase,
        private readonly getBaseline: GetBaselineUseCase,
        private readonly lockBaseline: LockBaselineUseCase,
        private readonly unlockBaseline: UnlockBaselineUseCase,
        private readonly listCostCodes: ListCostCodesUseCase,
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

    @Get('projects/:projectId/baseline')
    async baseline(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<BaselineStatusDto> {
        return unwrap(await this.getBaseline.execute(user.userId, projectIdParam(projectId)));
    }

    @Post('projects/:projectId/baseline')
    async lock(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(lockBaselineRequestSchema)) body: LockBaselineRequest,
    ): Promise<BaselineStatusDto> {
        return unwrap(await this.lockBaseline.execute(user.userId, projectIdParam(projectId), body));
    }

    @Post('projects/:projectId/baseline/unlock')
    @HttpCode(200)
    async unlock(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(unlockBaselineRequestSchema)) body: UnlockBaselineRequest,
    ): Promise<BaselineStatusDto> {
        return unwrap(await this.unlockBaseline.execute(user.userId, projectIdParam(projectId), body));
    }

    @Get('projects/:projectId/cost-codes')
    async costCodes(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<CostCodeDto[]> {
        return unwrap(await this.listCostCodes.execute(user.userId, projectIdParam(projectId)));
    }
}
