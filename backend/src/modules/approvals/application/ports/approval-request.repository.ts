// ─── Approval requests with their steps. Writes join the caller's UnitOfWork transaction. ───
import type { ApprovalStatus, ApprovalSubject, Role } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import type { ApprovalRequestId } from '../../domain/approvals-ids';
import type { ApprovalRequest } from '../../domain/entities/approval-request.entity';

/** Position in the newest-first list: (requested_at, id). */
export interface ApprovalCursor {
    requestedAt: Date;
    id: string;
}

export interface ApprovalListFilter {
    status?: ApprovalStatus;
    /** Only pending requests whose pending step lists this role. */
    pendingForRole?: Role;
    /** Only requests asked by this user or whose steps list this role. */
    visibleTo?: { userId: UserId; role: Role };
    before?: ApprovalCursor;
    limit: number;
}

export abstract class ApprovalRequestRepository {
    /**
     * Stores a new request and its steps. false (nothing stored) when the document already has a pending request
     * (partial unique `approval_requests_pending_key`).
     */
    abstract insert(request: ApprovalRequest): Promise<boolean>;
    /** Saves status / decision fields of the request and of its steps. */
    abstract update(request: ApprovalRequest): Promise<void>;
    /** By id in any workspace (POST /approvals/:id/decide finds the workspace from the request; access is checked after). */
    abstract findById(id: ApprovalRequestId): Promise<ApprovalRequest | undefined>;
    /** Locks the request row until the transaction ends. */
    abstract lockForUpdate(workspaceId: WorkspaceId, id: ApprovalRequestId): Promise<ApprovalRequest | undefined>;
    abstract findPending(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<ApprovalRequest | undefined>;
    /** The newest request of a document. */
    abstract latestOf(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<ApprovalRequest | undefined>;
    /** Newest first. */
    abstract list(workspaceId: WorkspaceId, filter: ApprovalListFilter): Promise<ApprovalRequest[]>;
}
