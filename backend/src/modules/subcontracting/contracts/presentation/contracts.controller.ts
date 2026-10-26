// ─── HTTP routes of the contracts work stream (docs/marketplace/API-module1.md "Contracts (C3)") ───
import { Body, Controller, Get, HttpCode, Ip, Param, Post, Put, Query } from '@nestjs/common';
import {
    type AcceptSubcontractRequest, type ApproveClaimRequest, type AttachScanRequest, type ClaimDto, type ContractDocumentDto,
    type EndSubcontractRequest, type InspectClaimRequest, type PayClaimRequest, type ProcurementOverviewDto,
    type ProcurementReportDto, type ProposeVariationRequest, type PutSubcontractingSettingsRequest, type RatingRequest,
    type RejectClaimRequest, type RequestChangeRequest, type RequestClaimRequest, type RespondVariationRequest,
    type RetentionEntryDto, type RetentionMoveRequest, type SubcontractDto, type SubcontractingSettingsDto,
    type SubcontractSummaryDto, type TradeId, type UpdateContractDocumentRequest, type VariationDto,
    type WorkspaceRetentionRow, acceptSubcontractRequestSchema, approveClaimRequestSchema, attachScanRequestSchema,
    endSubcontractRequestSchema, inspectClaimRequestSchema, payClaimRequestSchema, proposeVariationRequestSchema,
    putSubcontractingSettingsRequestSchema, ratingRequestSchema, rejectClaimRequestSchema, requestChangeRequestSchema,
    requestClaimRequestSchema, respondVariationRequestSchema, retentionMoveRequestSchema, updateContractDocumentRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, parseId } from '../../../../shared/domain';
import { CurrentUser } from '../../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../../shared/presentation/http';
import type { ClaimId, SubcontractId, VariationId } from '../../shared/ids';
import { ApproveClaimUseCase, InspectClaimUseCase, ListClaimsUseCase, PayClaimUseCase, RejectClaimUseCase, RequestClaimUseCase } from '../application/use-cases/claims.use-case';
import { ListProjectSubcontractsUseCase, ListVendorSubcontractsUseCase, ListWorkspaceRetentionUseCase } from '../application/use-cases/lists.use-case';
import { GetOverviewUseCase, GetReportUseCase } from '../application/use-cases/overview.use-case';
import { ListRetentionUseCase, MoveRetentionUseCase } from '../application/use-cases/retention.use-case';
import { GetScSettingsUseCase, GetTradeChecklistsUseCase, PutScSettingsUseCase } from '../application/use-cases/settings.use-case';
import {
    AcceptSubcontractUseCase, AttachSignedScanUseCase, CancelSubcontractUseCase, CloseSubcontractUseCase,
    CompleteSubcontractUseCase, GetContractDocumentUseCase, GetSubcontractUseCase, RateSubcontractUseCase,
    RequestContractChangeUseCase, TerminateSubcontractUseCase, UpdateContractDocumentUseCase,
} from '../application/use-cases/subcontract-lifecycle.use-case';
import { ListVariationsUseCase, ProposeVariationUseCase, RespondVariationUseCase } from '../application/use-cases/variations.use-case';

const workspaceParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));
const projectParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));
const subcontractParam = (raw: string): SubcontractId => unwrap(parseId<'SubcontractId'>(raw, 'Subcontract'));
const claimParam = (raw: string): ClaimId => unwrap(parseId<'ClaimId'>(raw, 'Claim'));
const variationParam = (raw: string): VariationId => unwrap(parseId<'VariationId'>(raw, 'Variation'));

@Controller('workspaces/:workspaceId/subcontracting')
export class WorkspaceContractsController {
    constructor(
        private readonly getSettings: GetScSettingsUseCase,
        private readonly putSettings: PutScSettingsUseCase,
        private readonly retention: ListWorkspaceRetentionUseCase,
    ) {}

    @Get('settings')
    async settings(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') ws: string): Promise<SubcontractingSettingsDto> {
        return unwrap(await this.getSettings.execute({ userId: user.userId, workspaceId: workspaceParam(ws) }));
    }

    @Put('settings')
    async saveSettings(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') ws: string,
        @Body(new ZodPipe(putSubcontractingSettingsRequestSchema)) body: PutSubcontractingSettingsRequest,
    ): Promise<SubcontractingSettingsDto> {
        return unwrap(await this.putSettings.execute({ userId: user.userId, workspaceId: workspaceParam(ws), settings: body }));
    }

    @Get('retention')
    async retentionRows(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') ws: string): Promise<WorkspaceRetentionRow[]> {
        return unwrap(await this.retention.execute({ userId: user.userId, workspaceId: workspaceParam(ws) }));
    }
}

@Controller('projects/:projectId/subcontracting')
export class ProjectContractsController {
    constructor(
        private readonly overviewUseCase: GetOverviewUseCase,
        private readonly reportUseCase: GetReportUseCase,
        private readonly listUseCase: ListProjectSubcontractsUseCase,
    ) {}

    @Get('overview')
    async overview(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<ProcurementOverviewDto> {
        return unwrap(await this.overviewUseCase.execute({ userId: user.userId, projectId: projectParam(projectId) }));
    }

    @Get('report')
    async report(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<ProcurementReportDto> {
        return unwrap(await this.reportUseCase.execute({ userId: user.userId, projectId: projectParam(projectId) }));
    }

    @Get('subcontracts')
    async list(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<SubcontractSummaryDto[]> {
        return unwrap(await this.listUseCase.execute({ userId: user.userId, projectId: projectParam(projectId) }));
    }
}

@Controller('vendor')
export class VendorContractsController {
    constructor(private readonly listUseCase: ListVendorSubcontractsUseCase) {}

    @Get('subcontracts')
    async list(@CurrentUser() user: AuthenticatedUser, @Query('workspaceId') ws: string | undefined): Promise<SubcontractSummaryDto[]> {
        return unwrap(await this.listUseCase.execute({ userId: user.userId, workspaceId: workspaceParam(ws ?? '') }));
    }
}

@Controller('subcontracting')
export class SubcontractsController {
    constructor(
        private readonly checklistsUseCase: GetTradeChecklistsUseCase,
        private readonly getUseCase: GetSubcontractUseCase,
        private readonly getDocumentUseCase: GetContractDocumentUseCase,
        private readonly updateDocumentUseCase: UpdateContractDocumentUseCase,
        private readonly acceptUseCase: AcceptSubcontractUseCase,
        private readonly requestChangeUseCase: RequestContractChangeUseCase,
        private readonly cancelUseCase: CancelSubcontractUseCase,
        private readonly terminateUseCase: TerminateSubcontractUseCase,
        private readonly completeUseCase: CompleteSubcontractUseCase,
        private readonly closeUseCase: CloseSubcontractUseCase,
        private readonly scanUseCase: AttachSignedScanUseCase,
        private readonly rateUseCase: RateSubcontractUseCase,
        private readonly listVariationsUseCase: ListVariationsUseCase,
        private readonly proposeVariationUseCase: ProposeVariationUseCase,
        private readonly respondVariationUseCase: RespondVariationUseCase,
        private readonly listClaimsUseCase: ListClaimsUseCase,
        private readonly requestClaimUseCase: RequestClaimUseCase,
        private readonly inspectUseCase: InspectClaimUseCase,
        private readonly approveUseCase: ApproveClaimUseCase,
        private readonly payUseCase: PayClaimUseCase,
        private readonly rejectUseCase: RejectClaimUseCase,
        private readonly listRetentionUseCase: ListRetentionUseCase,
        private readonly moveRetentionUseCase: MoveRetentionUseCase,
    ) {}

    @Get('checklists')
    checklists(): Record<TradeId, string[]> {
        return unwrap(this.checklistsUseCase.execute());
    }

    @Get('subcontracts/:id')
    async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<SubcontractDto> {
        return unwrap(await this.getUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id) }));
    }

    @Get('subcontracts/:id/document')
    async document(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ContractDocumentDto> {
        return unwrap(await this.getDocumentUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id) }));
    }

    @Put('subcontracts/:id/document')
    async updateDocument(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(updateContractDocumentRequestSchema)) body: UpdateContractDocumentRequest,
    ): Promise<ContractDocumentDto> {
        return unwrap(await this.updateDocumentUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), html: body.html }));
    }

    @Post('subcontracts/:id/accept')
    @HttpCode(200)
    async accept(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Ip() ip: string | undefined,
        @Body(new ZodPipe(acceptSubcontractRequestSchema)) body: AcceptSubcontractRequest,
    ): Promise<SubcontractDto> {
        return unwrap(await this.acceptUseCase.execute({
            userId: user.userId, subcontractId: subcontractParam(id), documentVersion: body.documentVersion, ip: ip ?? null,
        }));
    }

    @Post('subcontracts/:id/request-change')
    @HttpCode(200)
    async requestChange(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(requestChangeRequestSchema)) body: RequestChangeRequest,
    ): Promise<SubcontractDto> {
        return unwrap(await this.requestChangeUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), text: body.text }));
    }

    @Post('subcontracts/:id/cancel')
    @HttpCode(200)
    async cancel(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(endSubcontractRequestSchema)) body: EndSubcontractRequest,
    ): Promise<SubcontractDto> {
        return unwrap(await this.cancelUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), reason: body.reason }));
    }

    @Post('subcontracts/:id/terminate')
    @HttpCode(200)
    async terminate(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(endSubcontractRequestSchema)) body: EndSubcontractRequest,
    ): Promise<SubcontractDto> {
        return unwrap(await this.terminateUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), reason: body.reason }));
    }

    @Post('subcontracts/:id/complete')
    @HttpCode(200)
    async complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<SubcontractDto> {
        return unwrap(await this.completeUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id) }));
    }

    @Post('subcontracts/:id/close')
    @HttpCode(200)
    async close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<SubcontractDto> {
        return unwrap(await this.closeUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id) }));
    }

    @Post('subcontracts/:id/signed-scan')
    @HttpCode(200)
    async signedScan(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(attachScanRequestSchema)) body: AttachScanRequest,
    ): Promise<SubcontractDto> {
        return unwrap(await this.scanUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), fileId: body.fileId }));
    }

    @Post('subcontracts/:id/ratings')
    @HttpCode(204)
    async rate(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(ratingRequestSchema)) body: RatingRequest,
    ): Promise<void> {
        unwrap(await this.rateUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), ...body }));
    }

    @Get('subcontracts/:id/variations')
    async variations(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<VariationDto[]> {
        return unwrap(await this.listVariationsUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id) }));
    }

    @Post('subcontracts/:id/variations')
    async proposeVariation(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(proposeVariationRequestSchema)) body: ProposeVariationRequest,
    ): Promise<VariationDto> {
        return unwrap(await this.proposeVariationUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), ...body }));
    }

    @Post('variations/:id/respond')
    @HttpCode(200)
    async respondVariation(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(respondVariationRequestSchema)) body: RespondVariationRequest,
    ): Promise<VariationDto> {
        return unwrap(await this.respondVariationUseCase.execute({ userId: user.userId, variationId: variationParam(id), accept: body.accept }));
    }

    @Get('subcontracts/:id/claims')
    async claims(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ClaimDto[]> {
        return unwrap(await this.listClaimsUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id) }));
    }

    @Post('subcontracts/:id/claims')
    async requestClaim(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(requestClaimRequestSchema)) body: RequestClaimRequest,
    ): Promise<ClaimDto> {
        return unwrap(await this.requestClaimUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), ...body }));
    }

    @Post('claims/:id/inspect')
    @HttpCode(200)
    async inspect(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(inspectClaimRequestSchema)) body: InspectClaimRequest,
    ): Promise<ClaimDto> {
        return unwrap(await this.inspectUseCase.execute({ userId: user.userId, claimId: claimParam(id), ...body }));
    }

    @Post('claims/:id/approve')
    @HttpCode(200)
    async approve(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(approveClaimRequestSchema)) body: ApproveClaimRequest,
    ): Promise<ClaimDto> {
        return unwrap(await this.approveUseCase.execute({ userId: user.userId, claimId: claimParam(id), ...body }));
    }

    @Post('claims/:id/pay')
    @HttpCode(200)
    async pay(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(payClaimRequestSchema)) body: PayClaimRequest,
    ): Promise<ClaimDto> {
        return unwrap(await this.payUseCase.execute({ userId: user.userId, claimId: claimParam(id), ...body }));
    }

    @Post('claims/:id/reject')
    @HttpCode(200)
    async reject(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(rejectClaimRequestSchema)) body: RejectClaimRequest,
    ): Promise<ClaimDto> {
        return unwrap(await this.rejectUseCase.execute({ userId: user.userId, claimId: claimParam(id), reason: body.reason }));
    }

    @Get('subcontracts/:id/retention')
    async retention(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<RetentionEntryDto[]> {
        return unwrap(await this.listRetentionUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id) }));
    }

    @Post('subcontracts/:id/retention/release')
    @HttpCode(200)
    async release(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(retentionMoveRequestSchema)) body: RetentionMoveRequest,
    ): Promise<RetentionEntryDto> {
        return unwrap(await this.moveRetentionUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), kind: 'released', ...body }));
    }

    @Post('subcontracts/:id/retention/forfeit')
    @HttpCode(200)
    async forfeit(
        @CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
        @Body(new ZodPipe(retentionMoveRequestSchema)) body: RetentionMoveRequest,
    ): Promise<RetentionEntryDto> {
        return unwrap(await this.moveRetentionUseCase.execute({ userId: user.userId, subcontractId: subcontractParam(id), kind: 'forfeited', ...body }));
    }
}
