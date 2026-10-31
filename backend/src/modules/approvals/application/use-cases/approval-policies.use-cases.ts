import { Injectable } from '@nestjs/common';
import { APPROVAL_SUBJECTS, type ApprovalPolicy, type ApprovalSubject } from '@contrack/contract';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { AuditLog, Clock, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import { defaultPolicy, normalizePolicy } from '../../domain/policies/approval-policy.policy';
import { ApprovalPolicyRepository, type SavedApprovalPolicy } from '../ports/approval-policy.repository';

export interface ApprovalPolicyView extends ApprovalPolicy {
    subject: ApprovalSubject;
    isDefault: boolean;
    updatedBy: UserId | null;
    updatedAt: Date | null;
}

const view = (subject: ApprovalSubject, saved: SavedApprovalPolicy | undefined): ApprovalPolicyView => (saved === undefined
    ? { subject, ...defaultPolicy(subject), isDefault: true, updatedBy: null, updatedAt: null }
    : {
        subject, enabled: saved.enabled, minAmount: saved.minAmount, approverRoles: [...saved.approverRoles], selfApprove: saved.selfApprove,
        isDefault: false, updatedBy: saved.updatedBy, updatedAt: saved.updatedAt,
    });

/** GET /workspaces/:workspaceId/approval-policies: `project-hub` active, `company.read`; every subject in order. */
@Injectable()
export class ListApprovalPoliciesUseCase {
    constructor(private readonly access: ModuleAccess, private readonly policies: ApprovalPolicyRepository) {}

    async execute(userId: UserId, workspaceId: WorkspaceId): Promise<Result<ApprovalPolicyView[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, 'project-hub', 'company.read');
        if (!grant.ok) return grant;
        const saved = new Map((await this.policies.listByWorkspace(workspaceId)).map(p => [p.subject, p]));
        return ok(APPROVAL_SUBJECTS.map(s => view(s, saved.get(s))));
    }
}

export interface PutApprovalPolicyInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    subject: ApprovalSubject;
    policy: ApprovalPolicy;
}

/**
 * PUT /workspaces/:workspaceId/approval-policies/:subject: `project-hub` active, `company.manage`. The owner is always
 * added to the approver roles; `minAmount` is rounded to satang. Applies to new requests only (pending ones keep the
 * roles of their step). Audited as `approval_policy` / `set` with the changed fields.
 */
@Injectable()
export class PutApprovalPolicyUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly policies: ApprovalPolicyRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: PutApprovalPolicyInput): Promise<Result<ApprovalPolicyView, DomainError>> {
        const grant = await this.access.inWorkspace(input.userId, input.workspaceId, 'project-hub', 'company.manage');
        if (!grant.ok) return grant;
        const next = normalizePolicy(input.policy);
        const saved = await this.uow.run(async () => {
            const before = view(input.subject, await this.policies.find(input.workspaceId, input.subject));
            const row: SavedApprovalPolicy = { subject: input.subject, ...next, updatedBy: input.userId, updatedAt: this.clock.now() };
            await this.policies.save(input.workspaceId, row);
            const changed: Record<string, unknown> = {};
            if (before.enabled !== next.enabled) changed.enabled = [before.enabled, next.enabled];
            if (before.minAmount !== next.minAmount) changed.minAmount = [before.minAmount, next.minAmount];
            if (before.approverRoles.join(',') !== next.approverRoles.join(',')) changed.approverRoles = [before.approverRoles, next.approverRoles];
            if (before.selfApprove !== next.selfApprove) changed.selfApprove = [before.selfApprove, next.selfApprove];
            await this.audit.record({
                workspaceId: input.workspaceId, projectId: null, actor: input.userId,
                entityType: 'approval_policy', entityId: input.subject, action: 'set', data: changed,
            });
            return row;
        });
        return ok(view(input.subject, saved));
    }
}
