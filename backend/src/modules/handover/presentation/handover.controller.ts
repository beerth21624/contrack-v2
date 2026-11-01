import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type CloseoutDto, type FinalizeCloseoutRequest, type PatchCloseoutRequest, finalizeCloseoutRequestSchema, patchCloseoutRequestSchema,
} from '@contrack/contract';
import {
    type AcceptHandoverRequest, type AddHandoverDocumentRequest, type AssignWarrantyClaimRequest, type CloseWarrantyClaimRequest,
    type CreateHandoverRequest, type CreateWarrantyClaimRequest, type HandoverDto, type InspectHandoverRequest, type PatchHandoverRequest,
    type PatchWarrantyClaimRequest, type ProjectHandoverDto, type ProjectWarrantyDto, type RejectHandoverRequest,
    type RejectWarrantyClaimRequest, type ResolveWarrantyClaimRequest, type ScheduleHandoverRequest, type WarrantyClaimDto,
    type WarrantyClaimListDto, type WarrantyClaimListQuery, acceptHandoverRequestSchema, addHandoverDocumentRequestSchema,
    assignWarrantyClaimRequestSchema, closeWarrantyClaimRequestSchema, createHandoverRequestSchema, createWarrantyClaimRequestSchema,
    inspectHandoverRequestSchema, patchHandoverRequestSchema, patchWarrantyClaimRequestSchema, rejectHandoverRequestSchema,
    rejectWarrantyClaimRequestSchema, resolveWarrantyClaimRequestSchema, scheduleHandoverRequestSchema, warrantyClaimListQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    AcceptHandoverUseCase, AddHandoverDocumentUseCase, CreateHandoverUseCase, GetProjectHandoverUseCase, InspectHandoverUseCase,
    PatchHandoverUseCase, RejectHandoverUseCase, ScheduleHandoverUseCase,
} from '../application/use-cases/handover.use-cases';
import { FinalizeCloseoutUseCase, GetCloseoutUseCase, PatchCloseoutUseCase } from '../application/use-cases/closeout.use-cases';
import {
    CreateWarrantyClaimUseCase, GetProjectWarrantyUseCase, ListWarrantyClaimsUseCase, PatchWarrantyClaimUseCase, WarrantyClaimActions,
} from '../application/use-cases/warranty.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));

@Controller()
@RequiresModule('handover')
export class HandoverController {
    constructor(
        private readonly getHandover: GetProjectHandoverUseCase,
        private readonly create: CreateHandoverUseCase,
        private readonly patch: PatchHandoverUseCase,
        private readonly schedule: ScheduleHandoverUseCase,
        private readonly inspect: InspectHandoverUseCase,
        private readonly accept: AcceptHandoverUseCase,
        private readonly reject: RejectHandoverUseCase,
        private readonly addDocument: AddHandoverDocumentUseCase,
        private readonly getWarranty: GetProjectWarrantyUseCase,
        private readonly listClaims: ListWarrantyClaimsUseCase,
        private readonly createClaim: CreateWarrantyClaimUseCase,
        private readonly patchClaim: PatchWarrantyClaimUseCase,
        private readonly claimActions: WarrantyClaimActions,
        private readonly getCloseout: GetCloseoutUseCase,
        private readonly patchCloseout: PatchCloseoutUseCase,
        private readonly finalizeCloseout: FinalizeCloseoutUseCase,
    ) {}

    // ── closeout (WP-55) ──

    @Get('projects/:projectId/closeout')
    async getProjectCloseout(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<CloseoutDto> {
        return unwrap(await this.getCloseout.execute(user.userId, projectIdParam(projectId)));
    }

    @Patch('projects/:projectId/closeout')
    async patchProjectCloseout(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(patchCloseoutRequestSchema)) body: PatchCloseoutRequest,
    ): Promise<CloseoutDto> {
        return unwrap(await this.patchCloseout.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Post('projects/:projectId/closeout/finalize')
    @HttpCode(200)
    async finalizeProjectCloseout(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(finalizeCloseoutRequestSchema)) body: FinalizeCloseoutRequest,
    ): Promise<CloseoutDto> {
        return unwrap(await this.finalizeCloseout.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    // ── handover ──

    @Get('projects/:projectId/handover')
    async getProjectHandover(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<ProjectHandoverDto> {
        return unwrap(await this.getHandover.execute(user.userId, projectIdParam(projectId)));
    }

    @Post('projects/:projectId/handover')
    async createHandover(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createHandoverRequestSchema)) body: CreateHandoverRequest,
    ): Promise<HandoverDto> {
        return unwrap(await this.create.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Patch('handovers/:handoverId')
    async patchHandover(
        @CurrentUser() user: AuthenticatedUser,
        @Param('handoverId') handoverId: string,
        @Body(new ZodPipe(patchHandoverRequestSchema)) body: PatchHandoverRequest,
    ): Promise<HandoverDto> {
        return unwrap(await this.patch.execute({ userId: user.userId, handoverId, body }));
    }

    @Post('handovers/:handoverId/schedule')
    @HttpCode(200)
    async scheduleHandover(
        @CurrentUser() user: AuthenticatedUser,
        @Param('handoverId') handoverId: string,
        @Body(new ZodPipe(scheduleHandoverRequestSchema)) body: ScheduleHandoverRequest,
    ): Promise<HandoverDto> {
        return unwrap(await this.schedule.execute({ userId: user.userId, handoverId, body }));
    }

    @Post('handovers/:handoverId/inspect')
    @HttpCode(200)
    async inspectHandover(
        @CurrentUser() user: AuthenticatedUser,
        @Param('handoverId') handoverId: string,
        @Body(new ZodPipe(inspectHandoverRequestSchema)) body: InspectHandoverRequest,
    ): Promise<HandoverDto> {
        return unwrap(await this.inspect.execute({ userId: user.userId, handoverId, body }));
    }

    @Post('handovers/:handoverId/accept')
    @HttpCode(200)
    async acceptHandover(
        @CurrentUser() user: AuthenticatedUser,
        @Param('handoverId') handoverId: string,
        @Body(new ZodPipe(acceptHandoverRequestSchema)) body: AcceptHandoverRequest,
    ): Promise<HandoverDto> {
        return unwrap(await this.accept.execute({ userId: user.userId, handoverId, body }));
    }

    @Post('handovers/:handoverId/reject')
    @HttpCode(200)
    async rejectHandover(
        @CurrentUser() user: AuthenticatedUser,
        @Param('handoverId') handoverId: string,
        @Body(new ZodPipe(rejectHandoverRequestSchema)) body: RejectHandoverRequest,
    ): Promise<HandoverDto> {
        return unwrap(await this.reject.execute({ userId: user.userId, handoverId, body }));
    }

    @Post('handovers/:handoverId/documents')
    async addHandoverDocument(
        @CurrentUser() user: AuthenticatedUser,
        @Param('handoverId') handoverId: string,
        @Body(new ZodPipe(addHandoverDocumentRequestSchema)) body: AddHandoverDocumentRequest,
    ): Promise<HandoverDto> {
        return unwrap(await this.addDocument.execute({ userId: user.userId, handoverId, body }));
    }

    // ── warranty ──

    @Get('projects/:projectId/warranty')
    async getProjectWarranty(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<ProjectWarrantyDto> {
        return unwrap(await this.getWarranty.execute(user.userId, projectIdParam(projectId)));
    }

    @Get('projects/:projectId/warranty-claims')
    async listWarrantyClaims(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Query(new ZodPipe(warrantyClaimListQuerySchema)) query: WarrantyClaimListQuery,
    ): Promise<WarrantyClaimListDto> {
        return unwrap(await this.listClaims.execute(user.userId, projectIdParam(projectId), query));
    }

    @Post('projects/:projectId/warranty-claims')
    async createWarrantyClaim(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createWarrantyClaimRequestSchema)) body: CreateWarrantyClaimRequest,
    ): Promise<WarrantyClaimDto> {
        return unwrap(await this.createClaim.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Patch('warranty-claims/:claimId')
    async patchWarrantyClaim(
        @CurrentUser() user: AuthenticatedUser,
        @Param('claimId') claimId: string,
        @Body(new ZodPipe(patchWarrantyClaimRequestSchema)) body: PatchWarrantyClaimRequest,
    ): Promise<WarrantyClaimDto> {
        return unwrap(await this.patchClaim.execute({ userId: user.userId, claimId, body }));
    }

    @Post('warranty-claims/:claimId/assign')
    @HttpCode(200)
    async assignWarrantyClaim(
        @CurrentUser() user: AuthenticatedUser,
        @Param('claimId') claimId: string,
        @Body(new ZodPipe(assignWarrantyClaimRequestSchema)) body: AssignWarrantyClaimRequest,
    ): Promise<WarrantyClaimDto> {
        return unwrap(await this.claimActions.assign({ userId: user.userId, claimId, body }));
    }

    @Post('warranty-claims/:claimId/start')
    @HttpCode(200)
    async startWarrantyClaim(@CurrentUser() user: AuthenticatedUser, @Param('claimId') claimId: string): Promise<WarrantyClaimDto> {
        return unwrap(await this.claimActions.start({ userId: user.userId, claimId }));
    }

    @Post('warranty-claims/:claimId/resolve')
    @HttpCode(200)
    async resolveWarrantyClaim(
        @CurrentUser() user: AuthenticatedUser,
        @Param('claimId') claimId: string,
        @Body(new ZodPipe(resolveWarrantyClaimRequestSchema)) body: ResolveWarrantyClaimRequest,
    ): Promise<WarrantyClaimDto> {
        return unwrap(await this.claimActions.resolve({ userId: user.userId, claimId, body }));
    }

    @Post('warranty-claims/:claimId/close')
    @HttpCode(200)
    async closeWarrantyClaim(
        @CurrentUser() user: AuthenticatedUser,
        @Param('claimId') claimId: string,
        @Body(new ZodPipe(closeWarrantyClaimRequestSchema)) body: CloseWarrantyClaimRequest,
    ): Promise<WarrantyClaimDto> {
        return unwrap(await this.claimActions.close({ userId: user.userId, claimId, body }));
    }

    @Post('warranty-claims/:claimId/reject')
    @HttpCode(200)
    async rejectWarrantyClaim(
        @CurrentUser() user: AuthenticatedUser,
        @Param('claimId') claimId: string,
        @Body(new ZodPipe(rejectWarrantyClaimRequestSchema)) body: RejectWarrantyClaimRequest,
    ): Promise<WarrantyClaimDto> {
        return unwrap(await this.claimActions.reject({ userId: user.userId, claimId, body }));
    }
}
