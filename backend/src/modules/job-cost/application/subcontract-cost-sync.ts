// ─── Subcontracts → cost ledger (docs/erp/02-domain-model.md §12, WP-46) ───
// Each subcontract holding a commitment posts `commit` rows (category subcontract, source `subcontract`, commitment ref =
// the subcontract) spread over the cost codes of its lines (`code = lineKey`; other lines → no cost code); each approved
// claim posts `actual` + `commit_release` (source `sc_claim`); a closed / terminated subcontract releases what stays open.
// Idempotent: the rows already in the ledger are read first and only the difference is posted (a value change through
// a variation posts a commit delta). Runs inside the caller's transaction, after JobCostRepository.lockProject.
import { Injectable, Logger } from '@nestjs/common';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { allocate, round2 } from '@contrack/domain/money';
import {
    Clock, type CostCode, CostLedger, type CostLedgerEntry, type CostLedgerEntryInput, type SubcontractCommitment, SubcontractCommitments,
} from '../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../shared/domain/ids';

export const SUBCONTRACT_SOURCE = 'subcontract';
export const SC_CLAIM_SOURCE = 'sc_claim';

/** Half a satang. */
const EPSILON = 0.005;
const ENDED = new Set(['closed', 'terminated']);

/** One bucket = one cost code (or none) of a subcontract, weighted by the line totals that map to it. */
interface Bucket {
    costCodeId: string | null;
    weight: number;
}

@Injectable()
export class SubcontractCostSync {
    private readonly logger = new Logger(SubcontractCostSync.name);

    constructor(
        private readonly commitments: SubcontractCommitments,
        private readonly ledger: CostLedger,
        private readonly clock: Clock,
    ) {}

    /** Brings the ledger up to date with the project's subcontracts; nothing without cost codes (no baseline yet). */
    async syncProject(workspaceId: WorkspaceId, projectId: ProjectId, costCodes: readonly CostCode[]): Promise<void> {
        if (costCodes.length === 0) return;
        const list = await this.commitments.forProject(workspaceId, projectId);
        if (list.length === 0) return;
        const entries = await this.ledger.listByProject(workspaceId, projectId);
        const byCode = new Map<string, string>();
        for (const c of costCodes) if (c.lineKey !== null && !byCode.has(c.lineKey)) byCode.set(c.lineKey, c.id);
        for (const c of costCodes) byCode.set(c.code, c.id);
        const today = bangkokToday(this.clock.now());
        for (const sc of list) {
            const rows = this.rowsFor(sc, projectId, entries, byCode, today);
            if (rows.length === 0) continue;
            const posted = await this.ledger.post(workspaceId, rows);
            if (!posted.ok) this.logger.warn(`subcontract ${sc.subcontractId}: ${posted.error.message}`);
        }
    }

    private rowsFor(
        sc: SubcontractCommitment, projectId: ProjectId, entries: readonly CostLedgerEntry[], byCode: ReadonlyMap<string, string>, today: string,
    ): CostLedgerEntryInput[] {
        const ref = sc.subcontractId.toLowerCase();
        const buckets = bucketsOf(sc, byCode);
        const weights = buckets.map(b => b.weight);
        const target = allocate(sc.total, weights);
        const mine = entries.filter(e => e.commitmentRef === ref || (e.sourceType === SUBCONTRACT_SOURCE && e.sourceId === ref));
        const open = new Map<string | null, number>();
        const postedCommit = new Map<string | null, number>();
        for (const e of mine) {
            if (e.kind !== 'actual') open.set(e.costCodeId, round2((open.get(e.costCodeId) ?? 0) + e.amount));
            if (e.kind === 'commit' && e.sourceType === SUBCONTRACT_SOURCE) {
                postedCommit.set(e.costCodeId, round2((postedCommit.get(e.costCodeId) ?? 0) + e.amount));
            }
        }
        const firstPost = postedCommit.size === 0;
        const base = { projectId, category: 'subcontract' as const, commitmentRef: ref };
        const rows: CostLedgerEntryInput[] = [];

        // 1. Commitment = contract value spread over the buckets (a delta when the value changed).
        const targetBy = new Map<string | null, number>();
        buckets.forEach((b, i) => targetBy.set(b.costCodeId, round2((targetBy.get(b.costCodeId) ?? 0) + (target[i] ?? 0))));
        for (const id of new Set([...targetBy.keys(), ...postedCommit.keys()])) {
            let delta = round2((targetBy.get(id) ?? 0) - (postedCommit.get(id) ?? 0));
            if (delta < 0) delta = Math.max(delta, -(open.get(id) ?? 0));
            if (Math.abs(delta) < EPSILON) continue;
            rows.push({
                ...base, costCodeId: id, kind: 'commit', amount: delta, entryDate: firstPost ? (sc.activatedOn ?? today) : today,
                sourceType: SUBCONTRACT_SOURCE, sourceId: ref, note: sc.title.slice(0, 200), by: sc.createdBy,
            });
            open.set(id, round2((open.get(id) ?? 0) + delta));
        }

        // 2. Approved claims not posted yet: actual cost, and the commitment it uses up.
        const postedClaims = new Set(entries.filter(e => e.sourceType === SC_CLAIM_SOURCE).map(e => e.sourceId));
        for (const claim of sc.claims) {
            const claimId = claim.claimId.toLowerCase();
            if (postedClaims.has(claimId) || round2(claim.gross) === 0) continue;
            const parts = allocate(claim.gross, weights);
            buckets.forEach((b, i) => {
                const part = parts[i] ?? 0;
                if (Math.abs(part) < EPSILON) return;
                const common = { ...base, costCodeId: b.costCodeId, entryDate: claim.approvedOn, sourceType: SC_CLAIM_SOURCE, sourceId: claimId, by: claim.approvedBy };
                rows.push({ ...common, kind: 'actual', amount: part, note: `${sc.title} #${claim.installmentNo}`.slice(0, 200) });
                const release = round2(Math.min(part, open.get(b.costCodeId) ?? 0));
                if (release >= EPSILON) {
                    rows.push({ ...common, kind: 'commit_release', amount: -release });
                    open.set(b.costCodeId, round2((open.get(b.costCodeId) ?? 0) - release));
                }
            });
        }

        // 3. A closed / terminated subcontract no longer commits what is left.
        if (ENDED.has(sc.status)) {
            for (const [id, left] of open) {
                if (left < EPSILON) continue;
                rows.push({
                    ...base, costCodeId: id, kind: 'commit_release', amount: -left, entryDate: today,
                    sourceType: SUBCONTRACT_SOURCE, sourceId: ref, note: sc.status, by: sc.createdBy,
                });
                open.set(id, 0);
            }
        }
        return rows;
    }
}

/** Buckets of a subcontract: its lines grouped by cost code (lines without a match → no cost code). */
function bucketsOf(sc: SubcontractCommitment, byCode: ReadonlyMap<string, string>): Bucket[] {
    const by = new Map<string | null, number>();
    for (const l of sc.lines) {
        const id = l.lineKey === null ? null : (byCode.get(l.lineKey) ?? null);
        by.set(id, round2((by.get(id) ?? 0) + Math.max(0, l.total)));
    }
    if (by.size === 0) by.set(null, 1);
    return [...by].map(([costCodeId, weight]) => ({ costCodeId, weight }));
}
