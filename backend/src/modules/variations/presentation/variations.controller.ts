import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
    type AddVariationEvidenceRequest, type ComputeVariationOrderRequest, type CreateVariationOrderRequest, type PatchVariationOrderRequest,
    type PutVariationOrderLinesRequest, type RecordVariationResponseRequest, type VariationOrderDto, type VariationOrderSummaryDto,
    addVariationEvidenceRequestSchema, computeVariationOrderRequestSchema, createVariationOrderRequestSchema,
    patchVariationOrderRequestSchema, putVariationOrderLinesRequestSchema, recordVariationResponseRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    AddVariationEvidenceUseCase, CancelVariationUseCase, ComputeVariationUseCase, CreateVariationUseCase, DeleteVariationEvidenceUseCase,
    GetVariationUseCase, ListVariationsUseCase, PatchVariationUseCase, PutVariationLinesUseCase, RecordVariationResponseUseCase,
    SubmitVariationUseCase, WithdrawVariationUseCase,
} from '../application/use-cases/variations.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));

@Controller()
@RequiresModule('variations')
export class VariationsController {
    constructor(
        private readonly list: ListVariationsUseCase,
        private readonly getOne: GetVariationUseCase,
        private readonly create: CreateVariationUseCase,
        private readonly patch: PatchVariationUseCase,
        private readonly putLines: PutVariationLinesUseCase,
        private readonly compute: ComputeVariationUseCase,
        private readonly addEvidence: AddVariationEvidenceUseCase,
        private readonly deleteEvidence: DeleteVariationEvidenceUseCase,
        private readonly submit: SubmitVariationUseCase,
        private readonly recordResponse: RecordVariationResponseUseCase,
        private readonly withdraw: WithdrawVariationUseCase,
        private readonly cancel: CancelVariationUseCase,
    ) {}

    @Get('projects/:projectId/variations')
    async listVariations(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<VariationOrderSummaryDto[]> {
        return unwrap(await this.list.execute(user.userId, projectIdParam(projectId)));
    }

    @Post('projects/:projectId/variations')
    async createVariation(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createVariationOrderRequestSchema)) body: CreateVariationOrderRequest,
    ): Promise<VariationOrderDto> {
        return unwrap(await this.create.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Get('variations/:variationId')
    async getVariation(@CurrentUser() user: AuthenticatedUser, @Param('variationId') variationId: string): Promise<VariationOrderDto> {
        return unwrap(await this.getOne.execute(user.userId, variationId));
    }

    @Patch('variations/:variationId')
    async patchVariation(
        @CurrentUser() user: AuthenticatedUser,
        @Param('variationId') variationId: string,
        @Body(new ZodPipe(patchVariationOrderRequestSchema)) body: PatchVariationOrderRequest,
    ): Promise<VariationOrderDto> {
        return unwrap(await this.patch.execute({ userId: user.userId, variationId, body }));
    }

    @Put('variations/:variationId/lines')
    async putVariationLines(
        @CurrentUser() user: AuthenticatedUser,
        @Param('variationId') variationId: string,
        @Body(new ZodPipe(putVariationOrderLinesRequestSchema)) body: PutVariationOrderLinesRequest,
    ): Promise<VariationOrderDto> {
        return unwrap(await this.putLines.execute({ userId: user.userId, variationId, body }));
    }

    @Post('variations/:variationId/compute')
    @HttpCode(200)
    async computeVariation(
        @CurrentUser() user: AuthenticatedUser,
        @Param('variationId') variationId: string,
        @Body(new ZodPipe(computeVariationOrderRequestSchema)) body: ComputeVariationOrderRequest,
    ): Promise<VariationOrderDto> {
        return unwrap(await this.compute.execute({ userId: user.userId, variationId, body }));
    }

    @Post('variations/:variationId/evidence')
    async addVariationEvidence(
        @CurrentUser() user: AuthenticatedUser,
        @Param('variationId') variationId: string,
        @Body(new ZodPipe(addVariationEvidenceRequestSchema)) body: AddVariationEvidenceRequest,
    ): Promise<VariationOrderDto> {
        return unwrap(await this.addEvidence.execute({ userId: user.userId, variationId, body }));
    }

    @Delete('variation-evidence/:evidenceId')
    @HttpCode(204)
    async deleteVariationEvidence(@CurrentUser() user: AuthenticatedUser, @Param('evidenceId') evidenceId: string): Promise<void> {
        unwrap(await this.deleteEvidence.execute({ userId: user.userId, evidenceId }));
    }

    @Post('variations/:variationId/submit')
    @HttpCode(200)
    async submitVariation(@CurrentUser() user: AuthenticatedUser, @Param('variationId') variationId: string): Promise<VariationOrderDto> {
        return unwrap(await this.submit.execute({ userId: user.userId, variationId }));
    }

    @Post('variations/:variationId/record-response')
    @HttpCode(200)
    async recordVariationResponse(
        @CurrentUser() user: AuthenticatedUser,
        @Param('variationId') variationId: string,
        @Body(new ZodPipe(recordVariationResponseRequestSchema)) body: RecordVariationResponseRequest,
    ): Promise<VariationOrderDto> {
        return unwrap(await this.recordResponse.execute({ userId: user.userId, variationId, body }));
    }

    @Post('variations/:variationId/withdraw')
    @HttpCode(200)
    async withdrawVariation(@CurrentUser() user: AuthenticatedUser, @Param('variationId') variationId: string): Promise<VariationOrderDto> {
        return unwrap(await this.withdraw.execute({ userId: user.userId, variationId }));
    }

    @Post('variations/:variationId/cancel')
    @HttpCode(200)
    async cancelVariation(@CurrentUser() user: AuthenticatedUser, @Param('variationId') variationId: string): Promise<VariationOrderDto> {
        return unwrap(await this.cancel.execute({ userId: user.userId, variationId }));
    }
}
