// ─── Simple append-only records of a subcontract: document versions, change requests, retention moves, ratings ───
import type { UserId, WorkspaceId } from '../../../../../shared/domain';
import type { ClaimId, RatingId, RetentionEntryId, SubcontractId } from '../../../shared/ids';
import type { Side } from './claim.entity';

export interface ContractDocument {
    id: string;
    subcontractId: SubcontractId;
    buyerWorkspaceId: WorkspaceId;
    version: number;
    /** Sanitized HTML. */
    html: string;
    createdBy: UserId;
    createdAt: Date;
}

export interface ChangeRequest {
    id: string;
    subcontractId: SubcontractId;
    buyerWorkspaceId: WorkspaceId;
    text: string;
    requestedBy: UserId;
    createdAt: Date;
    resolvedAt: Date | null;
}

export interface RetentionEntry {
    id: RetentionEntryId;
    subcontractId: SubcontractId;
    buyerWorkspaceId: WorkspaceId;
    kind: 'withheld' | 'released' | 'forfeited';
    amount: number;
    claimId: ClaimId | null;
    note: string;
    createdBy: UserId | null;
    createdAt: Date;
}

export type RatingScores = Partial<Record<'quality' | 'time' | 'communication' | 'payment', number>>;

export interface Rating {
    id: RatingId;
    subcontractId: SubcontractId;
    buyerWorkspaceId: WorkspaceId;
    fromSide: Side;
    fromWorkspaceId: WorkspaceId;
    toWorkspaceId: WorkspaceId | null;
    scores: RatingScores;
    comment: string;
    createdBy: UserId;
    createdAt: Date;
}
