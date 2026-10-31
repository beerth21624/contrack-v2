// ─── Cost ledger / financial event rules (pure, docs/erp/02-domain-model.md §1.11) ───
// Validation of posted rows, totals (committedOpen = Σ commit + Σ commit_release, actual = Σ actual) and the
// commitment invariant: the open amount per (commitment_ref, cost_code_id) never drops below 0.
import {
    COST_CATEGORIES, COST_ENTRY_KINDS, FIN_COUNTERPARTY_TYPES, FIN_DIRECTIONS, FIN_EVENT_TYPES, uuidSchema,
} from '@contrack/contract';
import { isBusinessDate } from '@contrack/domain/dates/business-date';
import { MONEY_MAX, round2, roundQty } from '@contrack/domain/money';
import type {
    CostLedgerCodeTotals, CostLedgerEntry, CostLedgerEntryInput, CostLedgerTotals, FinEventInput,
} from '../../../shared/application/ports';

/** Half a satang: sums of 2-decimal values compared with this tolerance. */
const EPSILON = 0.005;

const isUuid = (v: unknown): boolean => typeof v === 'string' && uuidSchema.safeParse(v).success;
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MONEY_MAX;
const isText = (v: unknown, max: number, required = false): boolean =>
    typeof v === 'string' && v.length <= max && (!required || v.trim() !== '');
const isPlainObject = (v: unknown): boolean => typeof v === 'object' && v !== null && !Array.isArray(v);
const optionalUuid = (v: unknown): boolean => v === undefined || v === null || isUuid(v);

/** The first problem of a cost row (field name), or undefined when valid. */
export function costEntryProblem(e: CostLedgerEntryInput): string | undefined {
    if (!isUuid(e.projectId)) return 'projectId';
    if (!optionalUuid(e.costCodeId)) return 'costCodeId';
    if (typeof e.entryDate !== 'string' || !isBusinessDate(e.entryDate)) return 'entryDate';
    if (!(COST_ENTRY_KINDS as readonly string[]).includes(e.kind)) return 'kind';
    if (!(COST_CATEGORIES as readonly string[]).includes(e.category)) return 'category';
    if (!isAmount(e.amount)) return 'amount';
    if (e.qty !== undefined && e.qty !== null && !(Number.isFinite(e.qty) && Math.abs(e.qty) <= 1e9)) return 'qty';
    if (!isText(e.sourceType, 64, true)) return 'sourceType';
    if (!isUuid(e.sourceId)) return 'sourceId';
    if (!optionalUuid(e.sourceLineId)) return 'sourceLineId';
    if (!optionalUuid(e.commitmentRef)) return 'commitmentRef';
    if (e.note !== undefined && !isText(e.note, 1000)) return 'note';
    if (e.kind === 'commit_release') {
        if (e.commitmentRef === undefined || e.commitmentRef === null) return 'commitmentRef';
        if (round2(e.amount) > 0) return 'amount';
    }
    return undefined;
}

/** The commitment a row opens / frees: given, else (commit only) its source line or source. */
export function commitmentRefOf(e: CostLedgerEntryInput): string | null {
    if (e.commitmentRef !== undefined && e.commitmentRef !== null) return e.commitmentRef.toLowerCase();
    if (e.kind === 'commit') return (e.sourceLineId ?? e.sourceId).toLowerCase();
    return null;
}

/** Normalized values of a valid input row (amount round2, qty 4 places, ids lower-case). */
export function normalizeCostEntry(e: CostLedgerEntryInput): Omit<CostLedgerEntry, 'id' | 'workspaceId' | 'reversesId' | 'createdAt'> {
    return {
        projectId: e.projectId,
        costCodeId: e.costCodeId === null ? null : e.costCodeId.toLowerCase(),
        entryDate: e.entryDate,
        kind: e.kind,
        category: e.category,
        amount: round2(e.amount),
        qty: e.qty === undefined || e.qty === null ? null : roundQty(e.qty),
        sourceType: e.sourceType.trim(),
        sourceId: e.sourceId.toLowerCase(),
        sourceLineId: e.sourceLineId === undefined || e.sourceLineId === null ? null : e.sourceLineId.toLowerCase(),
        commitmentRef: commitmentRefOf(e),
        note: (e.note ?? '').trim(),
        createdBy: e.by,
    };
}

/** Key of the commitment invariant. */
export const commitmentKey = (ref: string, costCodeId: string | null): string => `${ref}|${costCodeId ?? ''}`;

/** Rows that move a commitment (commit / commit_release with a ref). */
export const movesCommitment = (e: Pick<CostLedgerEntry, 'kind' | 'commitmentRef'>): boolean =>
    e.commitmentRef !== null && (e.kind === 'commit' || e.kind === 'commit_release');

/**
 * Applies the new rows to the open amounts (`open` keyed by commitmentKey) and returns the first commitment that
 * would end below 0, or undefined.
 */
export function commitmentBreach(
    open: ReadonlyMap<string, number>, rows: readonly Pick<CostLedgerEntry, 'kind' | 'commitmentRef' | 'costCodeId' | 'amount'>[],
): { commitmentRef: string; costCodeId: string | null; open: number } | undefined {
    const after = new Map(open);
    const touched: { ref: string; costCodeId: string | null; key: string }[] = [];
    for (const r of rows) {
        if (!movesCommitment(r) || r.commitmentRef === null) continue;
        const key = commitmentKey(r.commitmentRef, r.costCodeId);
        if (!after.has(key)) after.set(key, 0);
        after.set(key, round2((after.get(key) ?? 0) + r.amount));
        touched.push({ ref: r.commitmentRef, costCodeId: r.costCodeId, key });
    }
    for (const t of touched) {
        const value = after.get(t.key) ?? 0;
        if (value < -EPSILON) return { commitmentRef: t.ref, costCodeId: t.costCodeId, open: value };
    }
    return undefined;
}

export const EMPTY_TOTALS: CostLedgerTotals = { committed: 0, released: 0, committedOpen: 0, actual: 0 };

/** Adds one row to running totals (exact cents). */
function addTo(t: CostLedgerTotals, e: Pick<CostLedgerEntry, 'kind' | 'amount'>): CostLedgerTotals {
    const committed = e.kind === 'commit' ? round2(t.committed + e.amount) : t.committed;
    const released = e.kind === 'commit_release' ? round2(t.released + e.amount) : t.released;
    const actual = e.kind === 'actual' ? round2(t.actual + e.amount) : t.actual;
    return { committed, released, committedOpen: round2(committed + released), actual };
}

export function sumTotals(entries: readonly Pick<CostLedgerEntry, 'kind' | 'amount'>[]): CostLedgerTotals {
    return entries.reduce(addTo, EMPTY_TOTALS);
}

/** Totals per cost code in first-seen order (null = overhead). */
export function totalsByCode(entries: readonly Pick<CostLedgerEntry, 'kind' | 'amount' | 'costCodeId'>[]): CostLedgerCodeTotals[] {
    const by = new Map<string | null, CostLedgerTotals>();
    for (const e of entries) by.set(e.costCodeId, addTo(by.get(e.costCodeId) ?? EMPTY_TOTALS, e));
    return [...by].map(([costCodeId, t]) => ({ costCodeId, ...t }));
}

/** The first problem of a financial event (field name), or undefined when valid. */
export function finEventProblem(e: FinEventInput): string | undefined {
    if (!optionalUuid(e.projectId)) return 'projectId';
    if (typeof e.eventDate !== 'string' || !isBusinessDate(e.eventDate)) return 'eventDate';
    if (!(FIN_EVENT_TYPES as readonly string[]).includes(e.eventType)) return 'eventType';
    if (!(FIN_DIRECTIONS as readonly string[]).includes(e.direction)) return 'direction';
    if (!(FIN_COUNTERPARTY_TYPES as readonly string[]).includes(e.counterpartyType)) return 'counterpartyType';
    if (!optionalUuid(e.counterpartyId)) return 'counterpartyId';
    if (!isText(e.counterpartyName, 300)) return 'counterpartyName';
    if (e.counterpartyTaxId !== undefined && !isText(e.counterpartyTaxId, 20)) return 'counterpartyTaxId';
    if (e.counterpartyBranch !== undefined && !isText(e.counterpartyBranch, 20)) return 'counterpartyBranch';
    if (e.docType !== undefined && e.docType !== null && !isText(e.docType, 40, true)) return 'docType';
    if (e.docNumber !== undefined && e.docNumber !== null && !isText(e.docNumber, 60, true)) return 'docNumber';
    if (e.docDate !== undefined && e.docDate !== null && !isBusinessDate(e.docDate)) return 'docDate';
    if (!isText(e.sourceType, 64, true)) return 'sourceType';
    if (!isUuid(e.sourceId)) return 'sourceId';
    for (const field of ['net', 'vat', 'wht', 'retention', 'cash'] as const) {
        const v = e[field];
        if (field === 'net' ? !isAmount(v) : v !== undefined && !isAmount(v)) return field;
    }
    if (e.data !== undefined && !isPlainObject(e.data)) return 'data';
    return undefined;
}
