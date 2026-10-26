// ─── BidRepository in memory (unit tests, PERSISTENCE=memory) ───
import type { BidStatus } from '@contrack/contract';
import type { WorkspaceId } from '../../../../../shared/domain';
import type { BidId, PackageId, ScInvitationId } from '../../../shared/ids';
import { BidRepository, BidVersionTaken } from '../../application/ports/bid.repository';
import { Bid, type BidProps } from '../../domain/entities/bid.entity';

export class InMemoryBidRepository extends BidRepository {
    private readonly rows = new Map<BidId, BidProps>();

    private all(): Bid[] {
        return [...this.rows.values()].map(p => Bid.rehydrate(structuredClone(p)));
    }

    private submittedOf(invitationId: ScInvitationId): Bid[] {
        return this.all().filter(b => b.invitationId === invitationId && !b.isDraft).sort((a, b) => a.version - b.version);
    }

    findById(id: BidId): Promise<Bid | undefined> {
        const p = this.rows.get(id);
        return Promise.resolve(p === undefined ? undefined : Bid.rehydrate(structuredClone(p)));
    }

    findDraft(invitationId: ScInvitationId): Promise<Bid | undefined> {
        return Promise.resolve(this.all().find(b => b.invitationId === invitationId && b.isDraft));
    }

    withDraft(invitationIds: readonly ScInvitationId[]): Promise<Set<ScInvitationId>> {
        const wanted = new Set(invitationIds);
        return Promise.resolve(new Set(this.all().filter(b => b.isDraft && wanted.has(b.invitationId)).map(b => b.invitationId)));
    }

    listSubmittedOfInvitation(invitationId: ScInvitationId): Promise<Bid[]> {
        return Promise.resolve(this.submittedOf(invitationId));
    }

    listSubmittedOfPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<Bid[]> {
        return Promise.resolve(this.all()
            .filter(b => b.buyerWorkspaceId === buyerWorkspaceId && b.packageId === packageId && !b.isDraft)
            .sort((a, b) => a.invitationId.localeCompare(b.invitationId) || a.version - b.version));
    }

    latestSubmitted(invitationIds: readonly ScInvitationId[]): Promise<Map<ScInvitationId, Bid>> {
        const out = new Map<ScInvitationId, Bid>();
        for (const id of new Set(invitationIds)) {
            const latest = this.submittedOf(id).at(-1);
            if (latest !== undefined && latest.status !== 'withdrawn') out.set(id, latest);
        }
        return Promise.resolve(out);
    }

    maxVersion(invitationId: ScInvitationId): Promise<number> {
        return Promise.resolve(this.submittedOf(invitationId).at(-1)?.version ?? 0);
    }

    insert(bid: Bid): Promise<void> {
        const p = bid.toProps();
        const clash = [...this.rows.values()].some(r => r.invitationId === p.invitationId && r.version === p.version);
        if (this.rows.has(p.id) || clash) return Promise.reject(new BidVersionTaken());
        this.rows.set(p.id, p);
        return Promise.resolve();
    }

    update(bid: Bid): Promise<void> {
        if (!this.rows.has(bid.id)) return Promise.reject(new Error('unknown bid'));
        this.rows.set(bid.id, bid.toProps());
        return Promise.resolve();
    }

    transition(bid: Bid, from: BidStatus): Promise<boolean> {
        const stored = this.rows.get(bid.id);
        if (stored?.status !== from) return Promise.resolve(false);
        const p = bid.toProps();
        this.rows.set(bid.id, { ...stored, status: p.status, withdrawnAt: p.withdrawnAt, decidedAt: p.decidedAt, updatedAt: p.updatedAt });
        return Promise.resolve(true);
    }

    resetDecisions(buyerWorkspaceId: WorkspaceId, packageId: PackageId, at: Date): Promise<void> {
        for (const [id, p] of this.rows) {
            if (p.buyerWorkspaceId !== buyerWorkspaceId || p.packageId !== packageId || (p.status !== 'selected' && p.status !== 'not_selected')) continue;
            this.rows.set(id, { ...p, status: 'submitted', decidedAt: null, updatedAt: at });
        }
        return Promise.resolve();
    }

    deleteDraft(invitationId: ScInvitationId): Promise<void> {
        for (const [id, p] of this.rows) if (p.invitationId === invitationId && p.status === 'draft') this.rows.delete(id);
        return Promise.resolve();
    }
}
