// ─── Money of a subcontract: installment amounts, claim amounts, retention ledger and its release schedule ───
// Pure rules used by the server (stored amounts) and the browser (previews). The system only RECORDS money; tax figures
// are a calculation aid, not a tax document (plan §6 rule 11).
// Plan: docs/marketplace/01-module1-subcontracting-plan.md §4.7, §6 rules 8–11.

import { round2 } from './snapshot';

/** VAT rate added to a claim when the vendor is VAT-registered. */
export const CLAIM_VAT_RATE = 0.07;

export interface InstallmentTerm {
    no: number;
    /** Fraction of the contract value (0.4 = 40 %). */
    pct: number;
    condition: string;
}

export interface InstallmentAmount extends InstallmentTerm {
    amount: number;
}

/**
 * Amount of each installment. Every installment but the last is round2(pct × base total); the LAST one absorbs the
 * rounding and the accepted variations (total − Σ earlier), so earlier installments never change once agreed and the
 * amounts always add up to the contract total exactly.
 */
export function installmentAmounts(installments: readonly InstallmentTerm[], baseTotal: number, variationsTotal = 0): InstallmentAmount[] {
    const total = round2(baseTotal + variationsTotal);
    const sorted = [...installments].sort((a, b) => a.no - b.no);
    let earlier = 0;
    return sorted.map((i, k) => {
        if (k === sorted.length - 1) return { ...i, amount: round2(total - earlier) };
        const amount = round2(i.pct * baseTotal);
        earlier = round2(earlier + amount);
        return { ...i, amount };
    });
}

export interface ClaimAdjustment {
    label: string;
    /** Signed: + extra work, − deductions (e.g. a penalty). */
    amount: number;
}

export interface ClaimAmountsInput {
    /** Installment amount. */
    gross: number;
    adjustments: readonly ClaimAdjustment[];
    /** 0.05 = 5 %. */
    retentionPct: number;
    /** 0.03 = 3 %; 0 = not shown. */
    whtPct: number;
    vat: boolean;
    /**
     * Share of the contract value that is labour (ค่าจ้างทำของ), 0–1: withholding applies to that share only. Use
     * labourShareOf(contract lines); omitted = 1 (labour-only contract, or the split is unknown).
     */
    labourShare?: number;
}

export interface ClaimAmountsResult {
    gross: number;
    adjustments: ClaimAdjustment[];
    retention: number;
    wht: number;
    vat: number;
    net: number;
}

/** What labourShareOf needs of a contract line (SubcontractLineDto and the server's line both fit). */
export interface PricedContractLine {
    qty: number;
    /** Labour unit price (null: lump-sum price, no split known). */
    unitPrice: number | null;
    /** Material unit price: set only on lines where the vendor supplies the material. */
    matUnitPrice: number | null;
    total: number;
}

/**
 * Labour share of a contract: Σ labour totals / Σ line totals. A line without a material price is all labour; a line
 * with one (vendor-supplied material) counts min(total, unitPrice × qty) as labour. 1 when no line has vendor material,
 * or when the split is unknown (a material line without a labour unit price, or no positive total).
 */
export function labourShareOf(lines: readonly PricedContractLine[]): number {
    if (!lines.some(l => l.matUnitPrice !== null)) return 1;
    let labour = 0;
    let total = 0;
    for (const l of lines) {
        total += l.total;
        if (l.matUnitPrice === null) {
            labour += l.total;
            continue;
        }
        if (l.unitPrice === null) return 1;
        labour += Math.max(0, Math.min(l.total, l.unitPrice * l.qty));
    }
    if (!(total > 0)) return 1;
    return Math.min(1, Math.max(0, labour / total));
}

/**
 * gross + Σadjustments − retention − wht + vat. One definition for the server (stored amounts) and the browser (previews).
 * - retention = round2(gross × retentionPct) (rule 10: of the installment value);
 * - wht = round2((gross + Σadjustments) × whtPct × labourShare): withholding is on the labour (ค่าจ้างทำของ) of what is
 *   paid for, so only on the labour share when the vendor also supplies material;
 * - vat = round2((gross + Σadjustments) × 7 %) when the vendor is VAT-registered, else 0.
 */
export function claimAmounts(input: ClaimAmountsInput): ClaimAmountsResult {
    const gross = round2(input.gross);
    const adjustments = input.adjustments.map(a => ({ label: a.label, amount: round2(a.amount) }));
    const adj = round2(adjustments.reduce((s, a) => s + a.amount, 0));
    const base = round2(gross + adj);
    const share = Math.min(1, Math.max(0, input.labourShare ?? 1));
    const retention = round2(gross * input.retentionPct);
    const wht = round2(base * input.whtPct * share);
    const vat = input.vat ? round2(base * CLAIM_VAT_RATE) : 0;
    const net = round2(base - retention - wht + vat);
    return { gross, adjustments, retention, wht, vat, net };
}

/** What contractClaimAmounts reads of a contract (SubcontractDto fits). */
export interface ClaimContract {
    terms: { retentionPct: number; whtPct: number; vat: boolean };
    lines: readonly PricedContractLine[];
}

/** claimAmounts with the contract's terms and labour share: what the server stores and what previews must show. */
export function contractClaimAmounts(contract: ClaimContract, gross: number, adjustments: readonly ClaimAdjustment[]): ClaimAmountsResult {
    return claimAmounts({
        gross, adjustments, retentionPct: contract.terms.retentionPct, whtPct: contract.terms.whtPct, vat: contract.terms.vat,
        labourShare: labourShareOf(contract.lines),
    });
}

// ── Retention ledger ──

export type RetentionKind = 'withheld' | 'released' | 'forfeited';

export interface RetentionMove {
    kind: RetentionKind;
    amount: number;
}

export interface RetentionTotals {
    withheld: number;
    released: number;
    forfeited: number;
    /** withheld − released − forfeited. */
    balance: number;
}

export function retentionTotals(entries: readonly RetentionMove[]): RetentionTotals {
    const sum = (k: RetentionKind) => round2(entries.filter(e => e.kind === k).reduce((s, e) => s + e.amount, 0));
    const withheld = sum('withheld');
    const released = sum('released');
    const forfeited = sum('forfeited');
    return { withheld, released, forfeited, balance: round2(withheld - released - forfeited) };
}

export interface PlannedRelease {
    amount: number;
    /** YYYY-MM-DD; null until the work is completed (the dates count from completion). */
    dueAt: string | null;
    label: string;
}

export interface RetentionSummaryResult extends RetentionTotals {
    schedule: PlannedRelease[];
}

/** Adds whole months to a YYYY-MM-DD date (31 Jan + 1 month → 28/29 Feb). */
export function addMonthsToDate(date: string, months: number): string {
    const [y, m, d] = date.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined || !Number.isFinite(y + m + d)) throw new Error(`bad date ${date}`);
    const index = y * 12 + (m - 1) + months;
    const year = Math.floor(index / 12);
    const month = index - year * 12 + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Ledger totals and the default release plan: half of what is held back (withheld − forfeited) when the work is
 * handed over (completedAt), the rest when the warranty ends (completedAt + warrantyMonths). Releases already
 * recorded are taken off the first stage first. Stages already fully released are left out.
 */
export function retentionSummary(
    entries: readonly RetentionMove[],
    opts: { completedAt: string | null; warrantyMonths: number },
): RetentionSummaryResult {
    const totals = retentionTotals(entries);
    const held = round2(totals.withheld - totals.forfeited);
    const first = round2(held / 2);
    const second = round2(held - first);
    let released = totals.released;
    const firstLeft = round2(Math.max(0, first - released));
    released = round2(Math.max(0, released - first));
    const secondLeft = round2(Math.max(0, second - released));
    const schedule: PlannedRelease[] = [];
    if (firstLeft > 0) {
        schedule.push({ amount: firstLeft, dueAt: opts.completedAt, label: 'คืนครึ่งแรกเมื่อส่งมอบงาน' });
    }
    if (secondLeft > 0) {
        schedule.push({
            amount: secondLeft,
            dueAt: opts.completedAt === null ? null : addMonthsToDate(opts.completedAt, opts.warrantyMonths),
            label: opts.warrantyMonths > 0 ? `คืนส่วนที่เหลือเมื่อพ้นระยะประกันผลงาน ${opts.warrantyMonths} เดือน` : 'คืนส่วนที่เหลือ',
        });
    }
    return { ...totals, schedule };
}
