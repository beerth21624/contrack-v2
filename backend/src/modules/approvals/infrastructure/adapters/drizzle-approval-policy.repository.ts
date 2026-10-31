import { and, eq } from 'drizzle-orm';
import { APPROVAL_SUBJECTS, type ApprovalSubject } from '@contrack/contract';
import { type WorkspaceId, asUserId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { approvalPolicies } from '../../../../shared/infrastructure/database/schema-erp-core';
import { ApprovalPolicyRepository, type SavedApprovalPolicy } from '../../application/ports/approval-policy.repository';

type Row = typeof approvalPolicies.$inferSelect;

const KNOWN = new Set<string>(APPROVAL_SUBJECTS);

/** Rows of subjects this code no longer knows are ignored (never deleted). */
const toPolicy = (row: Row): SavedApprovalPolicy | undefined => (KNOWN.has(row.subject)
    ? {
        subject: row.subject as ApprovalSubject,
        enabled: row.enabled,
        minAmount: row.minAmount,
        approverRoles: [...row.approverRoles],
        selfApprove: row.selfApprove,
        updatedBy: row.updatedBy === null ? null : asUserId(row.updatedBy),
        updatedAt: row.updatedAt,
    }
    : undefined);

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Every query filters by `workspace_id`. */
export class DrizzleApprovalPolicyRepository extends ApprovalPolicyRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(workspaceId: WorkspaceId, subject: ApprovalSubject): Promise<SavedApprovalPolicy | undefined> {
        const [row] = await this.ctx.executor.select().from(approvalPolicies)
            .where(and(eq(approvalPolicies.workspaceId, workspaceId), eq(approvalPolicies.subject, subject)))
            .limit(1);
        return row === undefined ? undefined : toPolicy(row);
    }

    async listByWorkspace(workspaceId: WorkspaceId): Promise<SavedApprovalPolicy[]> {
        const rows = await this.ctx.executor.select().from(approvalPolicies).where(eq(approvalPolicies.workspaceId, workspaceId));
        return rows.map(toPolicy).filter((p): p is SavedApprovalPolicy => p !== undefined);
    }

    async save(workspaceId: WorkspaceId, policy: SavedApprovalPolicy): Promise<void> {
        const values = {
            enabled: policy.enabled,
            minAmount: policy.minAmount,
            approverRoles: policy.approverRoles,
            selfApprove: policy.selfApprove,
            updatedBy: policy.updatedBy,
            updatedAt: policy.updatedAt,
        };
        await this.ctx.executor.insert(approvalPolicies)
            .values({ workspaceId, subject: policy.subject, ...values })
            .onConflictDoUpdate({ target: [approvalPolicies.workspaceId, approvalPolicies.subject], set: values });
    }
}
