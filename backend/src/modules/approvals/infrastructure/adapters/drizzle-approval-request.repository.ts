import { type SQL, and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { APPROVAL_SUBJECTS, type ApprovalSubject } from '@contrack/contract';
import { type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { approvalRequests, approvalSteps } from '../../../../shared/infrastructure/database/schema-erp-core';
import { type ApprovalListFilter, ApprovalRequestRepository } from '../../application/ports/approval-request.repository';
import { type ApprovalRequestId, asApprovalRequestId, asApprovalStepId } from '../../domain/approvals-ids';
import { ApprovalRequest, type ApprovalStepProps } from '../../domain/entities/approval-request.entity';

type RequestRow = typeof approvalRequests.$inferSelect;
type StepRow = typeof approvalSteps.$inferSelect;

const KNOWN = new Set<string>(APPROVAL_SUBJECTS);

const toStep = (row: StepRow): ApprovalStepProps => ({
    id: asApprovalStepId(row.id),
    seq: row.seq,
    approverRoles: [...row.approverRoles],
    status: row.status,
    decidedBy: row.decidedBy === null ? null : asUserId(row.decidedBy),
    decidedAt: row.decidedAt,
    note: row.note,
});

function toEntity(row: RequestRow, steps: readonly StepRow[]): ApprovalRequest {
    if (!KNOWN.has(row.subject)) throw new Error(`approval request ${row.id} has unknown subject "${row.subject}"`);
    return ApprovalRequest.rehydrate({
        id: asApprovalRequestId(row.id),
        workspaceId: asWorkspaceId(row.workspaceId),
        projectId: row.projectId === null ? null : asProjectId(row.projectId),
        subject: row.subject as ApprovalSubject,
        subjectId: row.subjectId,
        title: row.title,
        amount: row.amount,
        status: row.status,
        auto: row.auto,
        autoReason: row.autoReason,
        requestedBy: asUserId(row.requestedBy),
        requestedAt: row.requestedAt,
        decidedBy: row.decidedBy === null ? null : asUserId(row.decidedBy),
        decidedAt: row.decidedAt,
        decisionNote: row.decisionNote,
        steps: steps.filter(s => s.requestId === row.id).sort((a, b) => a.seq - b.seq).map(toStep),
    });
}

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Every query but `findById` filters by `workspace_id`. */
export class DrizzleApprovalRequestRepository extends ApprovalRequestRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(request: ApprovalRequest): Promise<boolean> {
        const p = request.toProps();
        return this.ctx.transaction(async () => {
            const inserted = await this.ctx.executor.insert(approvalRequests)
                .values({
                    id: p.id, workspaceId: p.workspaceId, projectId: p.projectId, subject: p.subject, subjectId: p.subjectId, title: p.title,
                    amount: p.amount, status: p.status, auto: p.auto, autoReason: p.autoReason, requestedBy: p.requestedBy,
                    requestedAt: p.requestedAt, decidedBy: p.decidedBy, decidedAt: p.decidedAt, decisionNote: p.decisionNote,
                })
                // Only a new pending row can collide with the partial unique index of pending requests.
                .onConflictDoNothing({
                    target: [approvalRequests.workspaceId, approvalRequests.subject, approvalRequests.subjectId],
                    where: sql`status = 'pending'`,
                })
                .returning({ id: approvalRequests.id });
            if (inserted.length === 0) return false;
            if (p.steps.length > 0) {
                await this.ctx.executor.insert(approvalSteps).values(p.steps.map(s => ({
                    id: s.id, requestId: p.id, workspaceId: p.workspaceId, seq: s.seq, approverRoles: s.approverRoles, status: s.status,
                    decidedBy: s.decidedBy, decidedAt: s.decidedAt, note: s.note,
                })));
            }
            return true;
        });
    }

    async update(request: ApprovalRequest): Promise<void> {
        const p = request.toProps();
        await this.ctx.transaction(async () => {
            await this.ctx.executor.update(approvalRequests)
                .set({ status: p.status, decidedBy: p.decidedBy, decidedAt: p.decidedAt, decisionNote: p.decisionNote })
                .where(and(eq(approvalRequests.id, p.id), eq(approvalRequests.workspaceId, p.workspaceId)));
            for (const s of p.steps) {
                await this.ctx.executor.update(approvalSteps)
                    .set({ status: s.status, decidedBy: s.decidedBy, decidedAt: s.decidedAt, note: s.note })
                    .where(and(eq(approvalSteps.id, s.id), eq(approvalSteps.workspaceId, p.workspaceId)));
            }
        });
    }

    async findById(id: ApprovalRequestId): Promise<ApprovalRequest | undefined> {
        const [row] = await this.ctx.executor.select().from(approvalRequests).where(eq(approvalRequests.id, id)).limit(1);
        return row === undefined ? undefined : (await this.withSteps([row]))[0];
    }

    async lockForUpdate(workspaceId: WorkspaceId, id: ApprovalRequestId): Promise<ApprovalRequest | undefined> {
        const [row] = await this.ctx.executor.select().from(approvalRequests)
            .where(and(eq(approvalRequests.id, id), eq(approvalRequests.workspaceId, workspaceId)))
            .limit(1)
            .for('update');
        return row === undefined ? undefined : (await this.withSteps([row]))[0];
    }

    async findPending(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<ApprovalRequest | undefined> {
        const [row] = await this.ctx.executor.select().from(approvalRequests)
            .where(and(this.ofDocument(workspaceId, subject, subjectId), eq(approvalRequests.status, 'pending')))
            .limit(1);
        return row === undefined ? undefined : (await this.withSteps([row]))[0];
    }

    async latestOf(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<ApprovalRequest | undefined> {
        const [row] = await this.ctx.executor.select().from(approvalRequests)
            .where(this.ofDocument(workspaceId, subject, subjectId))
            .orderBy(desc(approvalRequests.requestedAt), desc(approvalRequests.id))
            .limit(1);
        return row === undefined ? undefined : (await this.withSteps([row]))[0];
    }

    async list(workspaceId: WorkspaceId, filter: ApprovalListFilter): Promise<ApprovalRequest[]> {
        const conditions: (SQL | undefined)[] = [eq(approvalRequests.workspaceId, workspaceId)];
        if (filter.status !== undefined) conditions.push(eq(approvalRequests.status, filter.status));
        if (filter.pendingForRole !== undefined) {
            conditions.push(eq(approvalRequests.status, 'pending'));
            conditions.push(sql`exists (select 1 from ${approvalSteps} where ${approvalSteps.requestId} = ${approvalRequests.id}
                and ${approvalSteps.status} = 'pending' and ${approvalSteps.approverRoles} @> ${JSON.stringify([filter.pendingForRole])}::jsonb)`);
        }
        if (filter.visibleTo !== undefined) {
            conditions.push(or(
                eq(approvalRequests.requestedBy, filter.visibleTo.userId),
                sql`exists (select 1 from ${approvalSteps} where ${approvalSteps.requestId} = ${approvalRequests.id}
                    and ${approvalSteps.approverRoles} @> ${JSON.stringify([filter.visibleTo.role])}::jsonb)`,
            ));
        }
        if (filter.before !== undefined) {
            conditions.push(sql`(${approvalRequests.requestedAt}, ${approvalRequests.id}) < (${filter.before.requestedAt.toISOString()}::timestamptz, ${filter.before.id}::uuid)`);
        }
        const rows = await this.ctx.executor.select().from(approvalRequests)
            .where(and(...conditions))
            .orderBy(desc(approvalRequests.requestedAt), desc(approvalRequests.id))
            .limit(Math.max(0, filter.limit));
        return this.withSteps(rows);
    }

    private ofDocument(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): SQL | undefined {
        return and(
            eq(approvalRequests.workspaceId, workspaceId),
            eq(approvalRequests.subject, subject),
            eq(approvalRequests.subjectId, subjectId),
        );
    }

    private async withSteps(rows: readonly RequestRow[]): Promise<ApprovalRequest[]> {
        if (rows.length === 0) return [];
        const first = rows[0];
        const steps = first === undefined ? [] : await this.ctx.executor.select().from(approvalSteps)
            .where(and(eq(approvalSteps.workspaceId, first.workspaceId), inArray(approvalSteps.requestId, rows.map(r => r.id))))
            .orderBy(asc(approvalSteps.seq));
        // findById may return a row of any workspace; every other caller passes rows of one workspace.
        return rows.map(r => toEntity(r, steps.filter(s => s.workspaceId === r.workspaceId)));
    }
}
