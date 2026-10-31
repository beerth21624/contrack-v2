// ─── Shared port Approvals (docs/erp/01-architecture.md §6.2): how every ERP module sends a document for approval ───
import { Injectable } from '@nestjs/common';
import type { ApprovalStatus, ApprovalSubject } from '@contrack/contract';
import {
    type ApprovalRequestInput, type ApprovalTicket, Approvals, Notifier, UserDirectory, WorkspaceDirectory,
} from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import type { Result } from '../../../../shared/domain/result';
import { ApprovalRequestRepository } from '../../application/ports/approval-request.repository';
import { CancelApprovalUseCase } from '../../application/use-cases/cancel-approval.use-case';
import { RequestApprovalUseCase } from '../../application/use-cases/request-approval.use-case';
import { asApprovalRequestId } from '../../domain/approvals-ids';

@Injectable()
export class RepositoryApprovals extends Approvals {
    constructor(
        private readonly requestUseCase: RequestApprovalUseCase,
        private readonly cancelUseCase: CancelApprovalUseCase,
        private readonly requests: ApprovalRequestRepository,
        private readonly members: WorkspaceDirectory,
        private readonly users: UserDirectory,
        private readonly notifier: Notifier,
    ) {
        super();
    }

    request(input: ApprovalRequestInput): Promise<Result<ApprovalTicket, DomainError>> {
        return this.requestUseCase.execute(input);
    }

    cancel(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string, by: UserId): Promise<void> {
        return this.cancelUseCase.execute(workspaceId, subject, subjectId, by);
    }

    async notifyRequested(requestId: string): Promise<void> {
        if (!isUuid(requestId)) return;
        const request = await this.requests.findById(asApprovalRequestId(requestId.toLowerCase()));
        if (request?.status !== 'pending') return;
        const roles = new Set(request.approverRoles);
        const to = [...new Set((await this.members.members(request.workspaceId))
            .filter(m => roles.has(m.role) && m.userId !== request.requestedBy).map(m => m.userId))];
        if (to.length === 0) return;
        const requester = (await this.users.findMany([request.requestedBy])).get(request.requestedBy);
        await this.notifier.notify({
            template: 'approval.requested',
            toUserIds: to,
            payload: {
                subject: request.subject, title: request.toProps().title, requesterName: requester?.displayName ?? '', href: '/approvals',
                ...(request.amount === null ? {} : { amount: request.amount }),
            },
        });
    }

    async statusOf(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<ApprovalStatus | undefined> {
        if (!isUuid(subjectId)) return undefined;
        return (await this.requests.latestOf(workspaceId, subject, subjectId.toLowerCase()))?.status;
    }
}
