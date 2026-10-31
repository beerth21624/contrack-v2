import { Injectable } from '@nestjs/common';
import type { ApprovalDecision } from '@contrack/contract';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { ApprovalHandlers, AuditLog, Clock, UnitOfWork, UserDirectory } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import type { ApprovalRequestId } from '../../domain/approvals-ids';
import type { ApprovalRequest } from '../../domain/entities/approval-request.entity';
import { effectivePolicy } from '../../domain/policies/approval-policy.policy';
import { mayDecide } from '../../domain/policies/auto-skip.policy';
import { type ApprovalRequestView, toApprovalViews } from '../approval-views';
import { ApprovalPolicyRepository } from '../ports/approval-policy.repository';
import { ApprovalRequestRepository } from '../ports/approval-request.repository';

export interface DecideApprovalInput {
    userId: UserId;
    requestId: ApprovalRequestId;
    decision: ApprovalDecision;
    note: string;
}

/** Thrown inside the transaction so that the subject's handler writes are rolled back with the decision. */
class DecisionRefused extends Error {
    constructor(readonly error: DomainError) {
        super(error.message);
        this.name = 'DecisionRefused';
    }
}

/**
 * POST /approvals/:requestId/decide. Order: unknown request / not a member → not_found; `project-hub` not active →
 * module_disabled; not an approver of the request (or its own requester while the policy forbids self-approval) →
 * forbidden; not pending → conflict `invalid_transition`. The owning module's handler runs in the same transaction; an
 * error from it rolls the decision back. Audited as `approval_request` / `approved` | `rejected`.
 * TODO(WP-10): notify `approval.decided` to the requester after the commit.
 */
@Injectable()
export class DecideApprovalUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly requests: ApprovalRequestRepository,
        private readonly policies: ApprovalPolicyRepository,
        private readonly handlers: ApprovalHandlers,
        private readonly audit: AuditLog,
        private readonly users: UserDirectory,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: DecideApprovalInput): Promise<Result<ApprovalRequestView, DomainError>> {
        const found = await this.requests.findById(input.requestId);
        if (found === undefined) return err(DomainError.notFound('Approval request'));
        const grant = await this.access.inWorkspace(input.userId, found.workspaceId, 'project-hub');
        if (!grant.ok) return err(grant.error.code === 'not_found' ? DomainError.notFound('Approval request') : grant.error);
        const { workspaceId, role } = grant.value;
        const note = input.note.trim();

        let decided: ApprovalRequest;
        let selfApprove: boolean;
        try {
            const outcome = await this.uow.run(async (): Promise<Result<{ request: ApprovalRequest; selfApprove: boolean }, DomainError>> => {
                const request = await this.requests.lockForUpdate(workspaceId, input.requestId);
                if (request === undefined) return err(DomainError.notFound('Approval request'));
                const policy = effectivePolicy(request.subject, await this.policies.find(workspaceId, request.subject));
                // An automatic approval has no step: its approvers are the policy's (so they get 409, not 403).
                const approverRoles = request.approverRoles.length > 0 ? request.approverRoles : policy.approverRoles;
                if (!mayDecide({ userId: input.userId, role, approverRoles, requestedBy: request.requestedBy, selfApprove: policy.selfApprove })) {
                    return err(DomainError.forbidden('You may not decide this approval request'));
                }
                const changed = request.decide(input.decision, input.userId, note, this.clock.now());
                if (!changed.ok) return changed;

                const handler = this.handlers.handlerOf(request.subject);
                if (handler !== undefined) {
                    const handled = await handler.onDecided({
                        workspaceId, projectId: request.projectId, requestId: request.id, subjectId: request.subjectId,
                        decision: input.decision, decidedBy: input.userId, note,
                    });
                    if (!handled.ok) throw new DecisionRefused(handled.error);
                }
                await this.requests.update(request);
                await this.audit.record({
                    workspaceId,
                    projectId: request.projectId,
                    actor: input.userId,
                    entityType: 'approval_request',
                    entityId: request.id,
                    action: input.decision,
                    data: { subject: request.subject, subjectId: request.subjectId, status: ['pending', input.decision], ...(note === '' ? {} : { note }) },
                });
                return ok({ request, selfApprove: policy.selfApprove });
            });
            if (!outcome.ok) return outcome;
            decided = outcome.value.request;
            selfApprove = outcome.value.selfApprove;
        } catch (error) {
            if (error instanceof DecisionRefused) return err(error.error);
            throw error;
        }

        const [view] = await toApprovalViews(this.users, [decided], { userId: input.userId, role, selfApprove: () => selfApprove });
        if (view === undefined) throw new Error('approval view missing');
        return ok(view);
    }
}
