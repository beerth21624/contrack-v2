import { Injectable } from '@nestjs/common';
import { round2 } from '@contrack/domain/money';
import {
    type ApprovalRequestInput, type ApprovalTicket, AuditLog, Clock, IdGenerator, UnitOfWork, WorkspaceDirectory,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { asApprovalRequestId, asApprovalStepId } from '../../domain/approvals-ids';
import { ApprovalRequest } from '../../domain/entities/approval-request.entity';
import { effectivePolicy } from '../../domain/policies/approval-policy.policy';
import { autoSkip } from '../../domain/policies/auto-skip.policy';
import { ApprovalPolicyRepository } from '../ports/approval-policy.repository';
import { ApprovalRequestRepository } from '../ports/approval-request.repository';

export const approvalPending = (): DomainError =>
    DomainError.conflict('This document is already waiting for approval', { reason: 'approval_pending' });

const TITLE_MAX = 200;

/**
 * `Approvals.request` (docs/erp/01-architecture.md §6.3): applies the auto-skip rules and stores the request (also an
 * automatic approval, for the audit trail). Joins the caller's transaction; the caller checked access already.
 * The caller sends `approval.requested` after its commit with `Approvals.notifyRequested(ticket.requestId)` when pending.
 */
@Injectable()
export class RequestApprovalUseCase {
    constructor(
        private readonly policies: ApprovalPolicyRepository,
        private readonly requests: ApprovalRequestRepository,
        private readonly members: WorkspaceDirectory,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: ApprovalRequestInput): Promise<Result<ApprovalTicket, DomainError>> {
        if (!isUuid(input.subjectId)) return err(DomainError.validation('subjectId must be a uuid'));
        if (input.amount !== null && !Number.isFinite(input.amount)) return err(DomainError.validation('amount must be a number'));
        const title = input.title.trim().slice(0, TITLE_MAX);
        const amount = input.amount === null ? null : round2(input.amount);
        const subjectId = input.subjectId.toLowerCase();

        return this.uow.run(async (): Promise<Result<ApprovalTicket, DomainError>> => {
            if (await this.requests.findPending(input.workspaceId, input.subject, subjectId) !== undefined) return err(approvalPending());
            const policy = effectivePolicy(input.subject, await this.policies.find(input.workspaceId, input.subject));
            const outcome = autoSkip({
                policy, amount, requestedBy: input.requestedBy, requesterRole: input.requesterRole,
                members: await this.members.members(input.workspaceId),
            });
            const now = this.clock.now();
            const base = {
                id: asApprovalRequestId(this.ids.newId()), workspaceId: input.workspaceId, projectId: input.projectId, subject: input.subject,
                subjectId, title, amount, requestedBy: input.requestedBy, now,
            };
            const request = outcome.status === 'approved'
                ? ApprovalRequest.autoApproved(base, outcome.reason)
                : ApprovalRequest.pending(base, asApprovalStepId(this.ids.newId()), policy.approverRoles);
            if (!(await this.requests.insert(request))) return err(approvalPending());
            await this.audit.record({
                workspaceId: input.workspaceId,
                projectId: input.projectId,
                actor: input.requestedBy,
                entityType: 'approval_request',
                entityId: request.id,
                action: outcome.status === 'approved' ? 'auto_approved' : 'requested',
                data: {
                    subject: input.subject, subjectId, amount,
                    ...(outcome.status === 'approved' ? { autoReason: outcome.reason } : { approverRoles: policy.approverRoles }),
                },
            });
            return ok({ requestId: request.id, status: outcome.status, auto: outcome.status === 'approved' });
        });
    }
}
