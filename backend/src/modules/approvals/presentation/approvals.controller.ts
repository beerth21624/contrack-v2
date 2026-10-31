import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
    type ApprovalListDto, type ApprovalListQuery, type ApprovalPolicyDto, type ApprovalRequestDto, type DecideApprovalRequest,
    type PutApprovalPolicyRequest, approvalListQuerySchema, approvalSubjectSchema, decideApprovalRequestSchema,
    putApprovalPolicyRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { DomainError, type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { DomainHttpException, ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { ListApprovalPoliciesUseCase, PutApprovalPolicyUseCase } from '../application/use-cases/approval-policies.use-cases';
import { DecideApprovalUseCase } from '../application/use-cases/decide-approval.use-case';
import { ListApprovalsUseCase } from '../application/use-cases/list-approvals.use-case';
import { asApprovalRequestId } from '../domain/approvals-ids';
import { approvalPolicyToDto, approvalRequestToDto } from './approvals.mapper';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller()
@RequiresModule('project-hub')
export class ApprovalsController {
    constructor(
        private readonly listRequests: ListApprovalsUseCase,
        private readonly decideRequest: DecideApprovalUseCase,
        private readonly listPolicies: ListApprovalPoliciesUseCase,
        private readonly putPolicy: PutApprovalPolicyUseCase,
    ) {}

    @Get('workspaces/:workspaceId/approvals')
    async list(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(approvalListQuerySchema)) query: ApprovalListQuery,
    ): Promise<ApprovalListDto> {
        const page = unwrap(await this.listRequests.execute({
            userId: user.userId,
            workspaceId: workspaceIdParam(workspaceId),
            status: query.status,
            mine: query.mine === 'true',
            before: query.before,
            limit: query.limit,
        }));
        return { items: page.items.map(approvalRequestToDto), nextBefore: page.nextBefore };
    }

    @Post('approvals/:requestId/decide')
    @HttpCode(200)
    async decide(
        @CurrentUser() user: AuthenticatedUser,
        @Param('requestId') raw: string,
        @Body(new ZodPipe(decideApprovalRequestSchema)) body: DecideApprovalRequest,
    ): Promise<ApprovalRequestDto> {
        const requestId = asApprovalRequestId(unwrap(parseId<'ApprovalRequestId'>(raw, 'Approval request')));
        const view = unwrap(await this.decideRequest.execute({ userId: user.userId, requestId, decision: body.decision, note: body.note }));
        return approvalRequestToDto(view);
    }

    @Get('workspaces/:workspaceId/approval-policies')
    async policies(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<ApprovalPolicyDto[]> {
        const list = unwrap(await this.listPolicies.execute(user.userId, workspaceIdParam(workspaceId)));
        return list.map(approvalPolicyToDto);
    }

    @Put('workspaces/:workspaceId/approval-policies/:subject')
    async setPolicy(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('subject') rawSubject: string,
        @Body(new ZodPipe(putApprovalPolicyRequestSchema)) body: PutApprovalPolicyRequest,
    ): Promise<ApprovalPolicyDto> {
        const subject = approvalSubjectSchema.safeParse(rawSubject);
        if (!subject.success) throw new DomainHttpException(DomainError.notFound('Approval subject'));
        const saved = unwrap(await this.putPolicy.execute({
            userId: user.userId, workspaceId: workspaceIdParam(workspaceId), subject: subject.data, policy: body,
        }));
        return approvalPolicyToDto(saved);
    }
}
