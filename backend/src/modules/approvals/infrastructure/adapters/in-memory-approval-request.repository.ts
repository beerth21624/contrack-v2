import type { ApprovalSubject } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { type ApprovalCursor, type ApprovalListFilter, ApprovalRequestRepository } from '../../application/ports/approval-request.repository';
import type { ApprovalRequestId } from '../../domain/approvals-ids';
import { ApprovalRequest, type ApprovalRequestProps } from '../../domain/entities/approval-request.entity';

/** Newest first: requested_at desc, then id desc. */
const newestFirst = (a: ApprovalRequestProps, b: ApprovalRequestProps): number =>
    b.requestedAt.getTime() - a.requestedAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const olderThan = (r: ApprovalRequestProps, c: ApprovalCursor): boolean =>
    r.requestedAt.getTime() < c.requestedAt.getTime() || (r.requestedAt.getTime() === c.requestedAt.getTime() && r.id < c.id);

/** Map-based; stores snapshots and mimics the partial unique index of pending requests. */
export class InMemoryApprovalRequestRepository extends ApprovalRequestRepository {
    private readonly rows = new Map<ApprovalRequestId, ApprovalRequestProps>();

    insert(request: ApprovalRequest): Promise<boolean> {
        const p = request.toProps();
        if (p.status === 'pending' && this.pendingOf(p.workspaceId, p.subject, p.subjectId) !== undefined) return Promise.resolve(false);
        this.rows.set(p.id, p);
        return Promise.resolve(true);
    }

    update(request: ApprovalRequest): Promise<void> {
        const p = request.toProps();
        const stored = this.rows.get(p.id);
        if (stored?.workspaceId === p.workspaceId) this.rows.set(p.id, p);
        return Promise.resolve();
    }

    findById(id: ApprovalRequestId): Promise<ApprovalRequest | undefined> {
        return Promise.resolve(this.entity(this.rows.get(id)));
    }

    lockForUpdate(workspaceId: WorkspaceId, id: ApprovalRequestId): Promise<ApprovalRequest | undefined> {
        const row = this.rows.get(id);
        return Promise.resolve(row?.workspaceId === workspaceId ? this.entity(row) : undefined);
    }

    findPending(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<ApprovalRequest | undefined> {
        return Promise.resolve(this.entity(this.pendingOf(workspaceId, subject, subjectId)));
    }

    latestOf(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<ApprovalRequest | undefined> {
        const found = [...this.rows.values()]
            .filter(r => r.workspaceId === workspaceId && r.subject === subject && r.subjectId === subjectId)
            .sort(newestFirst);
        return Promise.resolve(this.entity(found[0]));
    }

    list(workspaceId: WorkspaceId, filter: ApprovalListFilter): Promise<ApprovalRequest[]> {
        const { status, pendingForRole: role, visibleTo, before } = filter;
        const found = [...this.rows.values()]
            .filter(r => r.workspaceId === workspaceId
                && (status === undefined || r.status === status)
                && (role === undefined || (r.status === 'pending' && r.steps.some(s => s.status === 'pending' && s.approverRoles.includes(role))))
                && (visibleTo === undefined
                    || r.requestedBy === visibleTo.userId || r.steps.some(s => s.approverRoles.includes(visibleTo.role)))
                && (before === undefined || olderThan(r, before)))
            .sort(newestFirst)
            .slice(0, Math.max(0, filter.limit));
        return Promise.resolve(found.map(r => ApprovalRequest.rehydrate(r)));
    }

    private pendingOf(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): ApprovalRequestProps | undefined {
        return [...this.rows.values()].find(r => r.workspaceId === workspaceId && r.subject === subject && r.subjectId === subjectId && r.status === 'pending');
    }

    private entity(row: ApprovalRequestProps | undefined): ApprovalRequest | undefined {
        return row === undefined ? undefined : ApprovalRequest.rehydrate(row);
    }
}
