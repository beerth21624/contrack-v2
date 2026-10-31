import type { ApprovalPolicy, ApprovalSubject } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** A workspace's saved rule of one subject (no row = APPROVAL_SUBJECT_DEFAULTS). */
export interface SavedApprovalPolicy extends ApprovalPolicy {
    subject: ApprovalSubject;
    updatedBy: UserId | null;
    updatedAt: Date;
}

export abstract class ApprovalPolicyRepository {
    abstract find(workspaceId: WorkspaceId, subject: ApprovalSubject): Promise<SavedApprovalPolicy | undefined>;
    abstract listByWorkspace(workspaceId: WorkspaceId): Promise<SavedApprovalPolicy[]>;
    /** Insert or replace. */
    abstract save(workspaceId: WorkspaceId, policy: SavedApprovalPolicy): Promise<void>;
}
