// ─── Bids (drafts + submitted versions). Writes join the caller's UnitOfWork transaction. ───
import type { BidStatus } from '@contrack/contract';
import type { WorkspaceId } from '../../../../../shared/domain';
import type { BidId, PackageId, ScInvitationId } from '../../../shared/ids';
import type { Bid } from '../../domain/entities/bid.entity';

/**
 * Thrown by `insert` when the invitation already has a row with that version (two submissions / two first autosaves
 * of one invitation at the same time). Inside a transaction it must propagate out of `UnitOfWork.run` (the database
 * transaction is aborted); the use case turns it into a 409 after the rollback.
 */
export class BidVersionTaken extends Error {
    constructor() {
        super('bid version already taken (invitation, version)');
        this.name = 'BidVersionTaken';
    }
}

export abstract class BidRepository {
    abstract findById(id: BidId): Promise<Bid | undefined>;
    /** The draft of an invitation (at most one). */
    abstract findDraft(invitationId: ScInvitationId): Promise<Bid | undefined>;
    /** Invitations among `invitationIds` that have a draft. */
    abstract withDraft(invitationIds: readonly ScInvitationId[]): Promise<Set<ScInvitationId>>;
    /** Every submitted version (any status but draft) of an invitation, oldest first. */
    abstract listSubmittedOfInvitation(invitationId: ScInvitationId): Promise<Bid[]>;
    /** Every submitted version of every invitation of a package (tenant-scoped), by invitation then version. */
    abstract listSubmittedOfPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<Bid[]>;
    /** The highest version of an invitation that is not withdrawn, when it is the latest one. */
    abstract latestSubmitted(invitationIds: readonly ScInvitationId[]): Promise<Map<ScInvitationId, Bid>>;
    /** Highest version number used by an invitation (0 when none was submitted). */
    abstract maxVersion(invitationId: ScInvitationId): Promise<number>;
    /** @throws BidVersionTaken when (invitation, version) is already used. */
    abstract insert(bid: Bid): Promise<void>;
    /** Saves the status / draft content of an existing bid. */
    abstract update(bid: Bid): Promise<void>;
    /**
     * Saves the bid's new status (status, withdrawn / decided / updated at) only when the stored status is still `from`
     * (compare-and-set: a concurrent submit / withdraw / award changed it otherwise). True when the row was changed.
     */
    abstract transition(bid: Bid, from: BidStatus): Promise<boolean>;
    /** Every selected / not_selected bid of the package goes back to submitted (decision cleared). */
    abstract resetDecisions(buyerWorkspaceId: WorkspaceId, packageId: PackageId, at: Date): Promise<void>;
    abstract deleteDraft(invitationId: ScInvitationId): Promise<void>;
}
