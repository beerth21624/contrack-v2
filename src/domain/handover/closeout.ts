// ─── Closeout: the summary of a finished project (docs/erp/02-domain-model.md §11, WP-55) ───
// Pure. Per BOQ section: estimate (baseline cost), budget (baseline + VO), actual cost from the ledger split by category,
// variance = budget − actual; ledger rows without a cost code (or of a cost code not listed) go to the "unassigned" row
// (sectionNo null), so Σ actual of the rows = Σ ledger actual of the project. Revenue = the contract's current value,
// profit = revenue − actual, against the quoted margin. The unit rates fed back to estimating: per line key, the actual
// material / labour cost per unit of the whole quantity (baseline + VO; the work is handed over, D-359).
import { roundQty, round2, sumMoney } from '../money';

export const CLOSEOUT_CATEGORIES = ['material', 'labour', 'subcontract', 'equipment', 'other'] as const;
export type CloseoutCategory = typeof CLOSEOUT_CATEGORIES[number];

export type CloseoutAmounts = Record<CloseoutCategory, number> & { total: number };

export interface CloseoutCostCode {
    id: string;
    sectionNo: number;
    lineKey: string | null;
    descTh: string;
    unit: string;
    baselineTotal: number;
    budgetTotal: number;
    /** baseline_qty + vo_qty. */
    budgetQty: number;
}

/** One `actual` ledger row of the project (reversals included, signed). */
export interface CloseoutLedgerRow {
    costCodeId: string | null;
    category: CloseoutCategory;
    amount: number;
}

export interface CloseoutContract {
    currentValue: number;
    originalValue: number;
    /** Fraction; null when the contract has no quotation behind it. */
    quotedMarginPct: number | null;
}

export interface CloseoutBilling {
    billed: number;
    received: number;
    retentionHeld: number;
    advanceOutstanding: number;
}

export interface CloseoutSection {
    /** null = the "unassigned" row (ledger rows without a cost code). */
    sectionNo: number | null;
    lineCount: number;
    estimate: number;
    budget: number;
    actual: CloseoutAmounts;
    /** budget − actual (negative = over budget). */
    variance: number;
}

export interface CloseoutSummary {
    sections: CloseoutSection[];
    totals: { estimate: number; budget: number; actual: CloseoutAmounts; variance: number };
    /** Contract current value (without VAT); null without a signed contract. */
    revenue: number | null;
    originalValue: number | null;
    billing: (CloseoutBilling & { outstanding: number }) | null;
    quotedMarginPct: number | null;
    /** revenue × quoted margin. */
    quotedProfit: number | null;
    /** revenue − Σ actual. */
    profit: number | null;
    marginPct: number | null;
    /** Line keys with an actual unit rate (written to the history on finalize). */
    unitRateCount: number;
}

export interface CloseoutUnitRate {
    lineKey: string;
    descTh: string;
    unit: string;
    qty: number;
    actualMatUnit: number;
    actualLabUnit: number;
}

function amounts(rows: readonly CloseoutLedgerRow[]): CloseoutAmounts {
    const out = { total: sumMoney(rows.map(r => r.amount)) } as CloseoutAmounts;
    for (const c of CLOSEOUT_CATEGORIES) out[c] = sumMoney(rows.filter(r => r.category === c).map(r => r.amount));
    return out;
}

function addAmounts(list: readonly CloseoutAmounts[]): CloseoutAmounts {
    const out = { total: sumMoney(list.map(a => a.total)) } as CloseoutAmounts;
    for (const c of CLOSEOUT_CATEGORIES) out[c] = sumMoney(list.map(a => a[c]));
    return out;
}

const ratio = (num: number, den: number): number => Math.round((num / den) * 1e6) / 1e6;

/** Actual unit rates per line key (cost codes sharing a line key are pooled); only quantities > 0 with some cost. */
export function closeoutUnitRates(costCodes: readonly CloseoutCostCode[], ledger: readonly CloseoutLedgerRow[]): CloseoutUnitRate[] {
    const byCode = new Map<string, CloseoutLedgerRow[]>();
    for (const r of ledger) if (r.costCodeId !== null) byCode.set(r.costCodeId, [...(byCode.get(r.costCodeId) ?? []), r]);
    const byKey = new Map<string, { descTh: string; unit: string; qty: number; mat: number; lab: number }>();
    for (const c of costCodes) {
        if (c.lineKey === null || c.lineKey === '') continue;
        const a = amounts(byCode.get(c.id) ?? []);
        const prev = byKey.get(c.lineKey);
        byKey.set(c.lineKey, {
            descTh: prev?.descTh ?? c.descTh,
            unit: prev?.unit ?? c.unit,
            qty: roundQty((prev?.qty ?? 0) + c.budgetQty),
            mat: round2((prev?.mat ?? 0) + a.material),
            lab: round2((prev?.lab ?? 0) + a.labour),
        });
    }
    const out: CloseoutUnitRate[] = [];
    for (const [lineKey, v] of byKey) {
        if (v.qty <= 0 || (v.mat === 0 && v.lab === 0)) continue;
        out.push({
            lineKey, descTh: v.descTh, unit: v.unit, qty: v.qty,
            actualMatUnit: Math.max(0, round2(v.mat / v.qty)), actualLabUnit: Math.max(0, round2(v.lab / v.qty)),
        });
    }
    return out;
}

export function closeoutSummary(input: {
    costCodes: readonly CloseoutCostCode[];
    ledger: readonly CloseoutLedgerRow[];
    contract: CloseoutContract | null;
    billing: CloseoutBilling | null;
}): CloseoutSummary {
    const { costCodes, ledger, contract, billing } = input;
    const codeIds = new Set(costCodes.map(c => c.id));
    const rowsOf = new Map<string | null, CloseoutLedgerRow[]>();
    for (const r of ledger) {
        const key = r.costCodeId !== null && codeIds.has(r.costCodeId) ? r.costCodeId : null;
        rowsOf.set(key, [...(rowsOf.get(key) ?? []), r]);
    }
    const bySection = new Map<number, CloseoutCostCode[]>();
    for (const c of costCodes) bySection.set(c.sectionNo, [...(bySection.get(c.sectionNo) ?? []), c]);
    const sections: CloseoutSection[] = [...bySection].sort((a, b) => a[0] - b[0]).map(([sectionNo, codes]) => {
        const actual = amounts(codes.flatMap(c => rowsOf.get(c.id) ?? []));
        const budget = sumMoney(codes.map(c => c.budgetTotal));
        return {
            sectionNo, lineCount: codes.length, estimate: sumMoney(codes.map(c => c.baselineTotal)), budget, actual,
            variance: round2(budget - actual.total),
        };
    });
    const unassigned = rowsOf.get(null) ?? [];
    if (unassigned.length > 0) {
        const actual = amounts(unassigned);
        sections.push({ sectionNo: null, lineCount: 0, estimate: 0, budget: 0, actual, variance: round2(-actual.total) });
    }
    const estimate = sumMoney(sections.map(s => s.estimate));
    const budget = sumMoney(sections.map(s => s.budget));
    const actual = addAmounts(sections.map(s => s.actual));
    const revenue = contract === null ? null : round2(contract.currentValue);
    const profit = revenue === null ? null : round2(revenue - actual.total);
    const quotedMarginPct = contract?.quotedMarginPct ?? null;
    return {
        sections,
        totals: { estimate, budget, actual, variance: round2(budget - actual.total) },
        revenue,
        originalValue: contract === null ? null : round2(contract.originalValue),
        billing: billing === null ? null : { ...billing, outstanding: round2(billing.billed - billing.received) },
        quotedMarginPct,
        quotedProfit: revenue === null || quotedMarginPct === null ? null : round2(revenue * quotedMarginPct),
        profit,
        marginPct: revenue === null || profit === null || revenue <= 0 ? null : ratio(profit, revenue),
        unitRateCount: closeoutUnitRates(costCodes, ledger).length,
    };
}
