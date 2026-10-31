// ─── Shared port Approvals (docs/erp/01-architecture.md §6.2): how every ERP module sends a document for approval ───
import { Injectable } from '@nestjs/common';
import type { ApprovalStatus, ApprovalSubject } from '@contrack/contract';
import { type ApprovalRequestInput, type ApprovalTicket, Approvals } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import type { Result } from '../../../../shared/domain/result';
import { ApprovalRequestRepository } from '../../application/ports/approval-request.repository';
import { CancelApprovalUseCase } from '../../application/use-cases/cancel-approval.use-case';
import { RequestApprovalUseCase } from '../../application/use-cases/request-approval.use-case';

@Injectable()
export class RepositoryApprovals extends Approvals {
    constructor(
        private readonly requestUseCase: RequestApprovalUseCase,
        private readonly cancelUseCase: CancelApprovalUseCase,
        private readonly requests: ApprovalRequestRepository,
    ) {
        super();
    }

    request(input: ApprovalRequestInput): Promise<Result<ApprovalTicket, DomainError>> {
        return this.requestUseCase.execute(input);
    }

    cancel(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string, by: UserId): Promise<void> {
        return this.cancelUseCase.execute(workspaceId, subject, subjectId, by);
    }

    async statusOf(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<ApprovalStatus | undefined> {
        if (!isUuid(subjectId)) return undefined;
        return (await this.requests.latestOf(workspaceId, subject, subjectId.toLowerCase()))?.status;
    }
}
