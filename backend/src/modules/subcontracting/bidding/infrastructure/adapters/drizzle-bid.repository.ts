// ─── BidRepository on PostgreSQL (sc_bids) ───
import { and, asc, eq, inArray, max, ne } from 'drizzle-orm';
import type { BidStatus } from '@contrack/contract';
import { asUserId, asWorkspaceId, type WorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scBids } from '../../../../../shared/infrastructure/database/schema-sc-bidding';
import { asBidId, asPackageId, asScInvitationId, type BidId, type PackageId, type ScInvitationId } from '../../../shared/ids';
import { BidRepository, BidVersionTaken } from '../../application/ports/bid.repository';
import { Bid } from '../../domain/entities/bid.entity';

type BidRow = typeof scBids.$inferSelect;
const VERSION_KEY = 'sc_bids_invitation_version_key';

/** A unique violation (23505) of the given constraint, through Drizzle's wrapping (DrizzleQueryError.cause = pg error). */
function isUniqueViolation(error: unknown, constraint: string): boolean {
    let current: unknown = error;
    for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
        const e = current as { code?: unknown; constraint?: unknown; cause?: unknown };
        if (e.code === '23505') return e.constraint === constraint;
        current = e.cause;
    }
    return false;
}
type BidInsert = typeof scBids.$inferInsert;

function toEntity(r: BidRow): Bid {
    return Bid.rehydrate({
        id: asBidId(r.id),
        buyerWorkspaceId: asWorkspaceId(r.buyerWorkspaceId),
        packageId: asPackageId(r.packageId),
        invitationId: asScInvitationId(r.invitationId),
        vendorWorkspaceId: r.vendorWorkspaceId === null ? null : asWorkspaceId(r.vendorWorkspaceId),
        packageVersion: r.packageVersion,
        version: r.version,
        status: r.status,
        mode: r.mode,
        lines: r.lines,
        lumpTotal: r.lumpTotal,
        adjustment: r.adjustment,
        adjustmentNote: r.adjustmentNote,
        inclusions: r.inclusions,
        total: r.total,
        normalizedTotal: r.normalizedTotal,
        days: r.days,
        earliestStart: r.earliestStart,
        crewSkilled: r.crewSkilled,
        crewLabourers: r.crewLabourers,
        validUntil: r.validUntil,
        installmentsProposal: r.installmentsProposal,
        answers: r.answers,
        note: r.note,
        photoFileIds: r.photoFileIds,
        enteredByBuyer: r.enteredByBuyer,
        submittedBy: r.submittedBy === null ? null : asUserId(r.submittedBy),
        submittedAt: r.submittedAt,
        withdrawnAt: r.withdrawnAt,
        decidedAt: r.decidedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
    });
}

function toRow(bid: Bid): BidInsert {
    const p = bid.toProps();
    return {
        id: p.id, buyerWorkspaceId: p.buyerWorkspaceId, packageId: p.packageId, invitationId: p.invitationId,
        vendorWorkspaceId: p.vendorWorkspaceId, packageVersion: p.packageVersion, version: p.version, status: p.status,
        mode: p.mode, lines: p.lines, lumpTotal: p.lumpTotal, adjustment: p.adjustment, adjustmentNote: p.adjustmentNote,
        inclusions: p.inclusions, total: p.total, normalizedTotal: p.normalizedTotal, days: p.days,
        earliestStart: p.earliestStart, crewSkilled: p.crewSkilled, crewLabourers: p.crewLabourers, validUntil: p.validUntil,
        installmentsProposal: p.installmentsProposal, answers: p.answers, note: p.note, photoFileIds: p.photoFileIds,
        enteredByBuyer: p.enteredByBuyer, submittedBy: p.submittedBy, submittedAt: p.submittedAt, withdrawnAt: p.withdrawnAt,
        decidedAt: p.decidedAt, createdAt: p.createdAt, updatedAt: p.updatedAt,
    };
}

export class DrizzleBidRepository extends BidRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findById(id: BidId): Promise<Bid | undefined> {
        const rows = await this.ctx.executor.select().from(scBids).where(eq(scBids.id, id)).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async findDraft(invitationId: ScInvitationId): Promise<Bid | undefined> {
        const rows = await this.ctx.executor.select().from(scBids)
            .where(and(eq(scBids.invitationId, invitationId), eq(scBids.version, 0))).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async withDraft(invitationIds: readonly ScInvitationId[]): Promise<Set<ScInvitationId>> {
        if (invitationIds.length === 0) return new Set();
        const rows = await this.ctx.executor.select({ invitationId: scBids.invitationId }).from(scBids)
            .where(and(inArray(scBids.invitationId, [...invitationIds]), eq(scBids.version, 0)));
        return new Set(rows.map(r => asScInvitationId(r.invitationId)));
    }

    async listSubmittedOfInvitation(invitationId: ScInvitationId): Promise<Bid[]> {
        const rows = await this.ctx.executor.select().from(scBids)
            .where(and(eq(scBids.invitationId, invitationId), ne(scBids.version, 0))).orderBy(asc(scBids.version));
        return rows.map(toEntity);
    }

    async listSubmittedOfPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<Bid[]> {
        const rows = await this.ctx.executor.select().from(scBids)
            .where(and(eq(scBids.buyerWorkspaceId, buyerWorkspaceId), eq(scBids.packageId, packageId), ne(scBids.version, 0)))
            .orderBy(asc(scBids.invitationId), asc(scBids.version));
        return rows.map(toEntity);
    }

    async latestSubmitted(invitationIds: readonly ScInvitationId[]): Promise<Map<ScInvitationId, Bid>> {
        const out = new Map<ScInvitationId, Bid>();
        if (invitationIds.length === 0) return out;
        const rows = await this.ctx.executor.select().from(scBids)
            .where(and(inArray(scBids.invitationId, [...new Set(invitationIds)]), ne(scBids.version, 0)))
            .orderBy(asc(scBids.invitationId), asc(scBids.version));
        const latest = new Map<string, BidRow>();
        for (const r of rows) latest.set(r.invitationId, r);
        for (const [id, r] of latest) if (r.status !== 'withdrawn') out.set(asScInvitationId(id), toEntity(r));
        return out;
    }

    async maxVersion(invitationId: ScInvitationId): Promise<number> {
        const rows = await this.ctx.executor.select({ v: max(scBids.version) }).from(scBids).where(eq(scBids.invitationId, invitationId));
        return rows[0]?.v ?? 0;
    }

    async insert(bid: Bid): Promise<void> {
        try {
            await this.ctx.executor.insert(scBids).values(toRow(bid));
        } catch (error) {
            if (isUniqueViolation(error, VERSION_KEY)) throw new BidVersionTaken();
            throw error;
        }
    }

    async update(bid: Bid): Promise<void> {
        const { id, buyerWorkspaceId, ...rest } = toRow(bid);
        await this.ctx.executor.update(scBids).set(rest)
            .where(and(eq(scBids.id, id), eq(scBids.buyerWorkspaceId, buyerWorkspaceId)));
    }

    async transition(bid: Bid, from: BidStatus): Promise<boolean> {
        const p = bid.toProps();
        const rows = await this.ctx.executor.update(scBids)
            .set({ status: p.status, withdrawnAt: p.withdrawnAt, decidedAt: p.decidedAt, updatedAt: p.updatedAt })
            .where(and(eq(scBids.id, p.id), eq(scBids.buyerWorkspaceId, p.buyerWorkspaceId), eq(scBids.status, from)))
            .returning({ id: scBids.id });
        return rows.length > 0;
    }

    async resetDecisions(buyerWorkspaceId: WorkspaceId, packageId: PackageId, at: Date): Promise<void> {
        await this.ctx.executor.update(scBids).set({ status: 'submitted', decidedAt: null, updatedAt: at })
            .where(and(
                eq(scBids.buyerWorkspaceId, buyerWorkspaceId), eq(scBids.packageId, packageId),
                inArray(scBids.status, ['selected', 'not_selected']),
            ));
    }

    async deleteDraft(invitationId: ScInvitationId): Promise<void> {
        await this.ctx.executor.delete(scBids).where(and(eq(scBids.invitationId, invitationId), eq(scBids.version, 0)));
    }
}
