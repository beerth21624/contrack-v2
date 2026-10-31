// ─── Progress claim (งวดเบิก) calculation (docs/erp/02-domain-model.md §4.1) ───
// W  = progress mode: Σ this_amount of the lines | milestone mode: the milestone amount
// A  = advance recovery, R = retention, P = penalty, E = escalation (signed)
// base = W − A + E;  VAT = round2(base × vatRate);  WHT = round2(base × customerWhtRate)
// payable = base + VAT − R − WHT − P − otherDeduction
// Pure: the server stores what this returns; web previews call the same function.
import { round2, sumMoney } from '../money/money';
import { advanceRecovery } from './advance';
import { escalationAmount, escalationK, type EscalationFormula } from './escalation';
import { claimPenalty, type ClaimPenalty, type PenaltyBase } from './penalty';
import { claimRetention } from './retention';

export type ClaimBillingMode = 'progress' | 'milestone';

// ── Lines (one per cost code) ──

export interface ClaimLineInput {
    costCodeId: string;
    /** `contract_amount + vo_contract_amount` of the cost code when the claim is made. */
    contractAmount: number;
    /** Progress certified by the previous claims (0–1). */
    prevProgress: number;
    /** Cumulative progress up to this claim (0–1). */
    cumProgress: number;
    /** Amount claimed by the previous claims (their `cum_amount`). */
    prevAmount: number;
    /** Reason, required when cumProgress < prevProgress. */
    note?: string | null;
}

export interface ClaimLine extends ClaimLineInput {
    cumAmount: number;
    thisAmount: number;
}

/** cum_amount = round2(contract_amount × cum_progress); this_amount = cum_amount − prev_amount. */
export function claimLine(input: ClaimLineInput): ClaimLine {
    const cumAmount = round2(input.contractAmount * input.cumProgress);
    return { ...input, cumAmount, thisAmount: round2(cumAmount - round2(input.prevAmount)) };
}

export type ClaimLineIssueReason = 'progress_out_of_range' | 'progress_below_previous';

export interface ClaimLineIssue {
    costCodeId: string;
    reason: ClaimLineIssueReason;
}

/** cum_progress must be within 0–1 and not below prev_progress unless the line has a note. */
export function claimLineIssues(lines: readonly ClaimLineInput[]): ClaimLineIssue[] {
    const issues: ClaimLineIssue[] = [];
    for (const l of lines) {
        if (!Number.isFinite(l.cumProgress) || l.cumProgress < 0 || l.cumProgress > 1) {
            issues.push({ costCodeId: l.costCodeId, reason: 'progress_out_of_range' });
        } else if (l.cumProgress < l.prevProgress && !(l.note ?? '').trim()) {
            issues.push({ costCodeId: l.costCodeId, reason: 'progress_below_previous' });
        }
    }
    return issues;
}

// ── Claim ──

/** The parts of `MainContractTerms` a claim needs. */
export interface ClaimTerms {
    advancePct: number;
    retentionPct: number;
    retentionCapPct: number | null;
    customerWhtRate: number;
    penaltyRatePerDay: number;
    penaltyBase: PenaltyBase;
    penaltyCapPct: number;
    escalation: (EscalationFormula & { enabled: boolean }) | null;
}

export interface ClaimInput {
    mode: ClaimBillingMode;
    /** Progress mode: the lines (milestone mode: may be given to record progress; they do not change W). */
    lines?: readonly ClaimLineInput[];
    /** Milestone mode: amount of the claimed milestone. */
    milestoneAmount?: number;
    /** Milestone mode: kind of the claimed milestone (`final` = last claim). */
    milestoneKind?: 'work' | 'final';
    /** `mc_contracts.current_value`. */
    currentValue: number;
    /** Cumulative work value of the earlier claims. */
    previousValue: number;
    /** `mc_contracts.vat_rate` (0 when the company is not VAT registered). */
    vatRate: number;
    terms: ClaimTerms;
    /** From `ar_advance_entries`. */
    advance: { received: number; recovered: number };
    /** Σ retention withheld by earlier claims. */
    retentionWithheldSoFar: number;
    penalty: { days: number; previousTotal: number; override?: number | null };
    /** Indices of this period for K (only used when escalation is enabled). */
    escalationIndices?: Readonly<Record<string, number>>;
    otherDeduction?: number;
}

export interface ClaimBreakdown {
    /** W. */
    workValue: number;
    previousValue: number;
    cumulativeValue: number;
    /** The claim completes the contract (advance is recovered in full). */
    isFinal: boolean;
    lines: ClaimLine[];
    /** A. */
    advanceRecovery: number;
    /** R. */
    retention: number;
    penalty: ClaimPenalty;
    /** K; null when escalation is off. */
    k: number | null;
    /** E (signed). */
    escalation: number;
    otherDeduction: number;
    /** base = W − A + E. */
    vatBase: number;
    vat: number;
    wht: number;
    payable: number;
}

/** Computes every amount of a claim; all results are rounded to satang. */
export function computeClaim(input: ClaimInput): ClaimBreakdown {
    const lines = (input.lines ?? []).map(claimLine);
    const workValue =
        input.mode === 'progress' ? sumMoney(lines.map(l => l.thisAmount)) : round2(input.milestoneAmount ?? 0);
    const previousValue = round2(input.previousValue);
    const cumulativeValue = round2(previousValue + workValue);
    const currentValue = round2(input.currentValue);
    const isFinal =
        input.mode === 'progress' ? currentValue !== 0 && cumulativeValue >= currentValue : input.milestoneKind === 'final';
    const { terms } = input;

    const advance = advanceRecovery({
        workValue,
        advancePct: terms.advancePct,
        received: input.advance.received,
        recovered: input.advance.recovered,
        isFinal,
    });
    const retention = claimRetention({
        workValue,
        retentionPct: terms.retentionPct,
        retentionCapPct: terms.retentionCapPct,
        currentValue,
        withheldSoFar: input.retentionWithheldSoFar,
    });
    const penalty = claimPenalty({
        days: input.penalty.days,
        ratePerDay: terms.penaltyRatePerDay,
        base: terms.penaltyBase,
        capPct: terms.penaltyCapPct,
        currentValue,
        previousValue,
        previousPenalty: input.penalty.previousTotal,
        override: input.penalty.override,
    });
    const esc = terms.escalation?.enabled ? terms.escalation : null;
    const k = esc ? escalationK(esc, input.escalationIndices ?? {}) : null;
    const escalation = esc && k !== null ? escalationAmount(round2(workValue - advance), k, esc.threshold) : 0;
    const otherDeduction = round2(Math.max(0, input.otherDeduction ?? 0));

    const vatBase = round2(workValue - advance + escalation);
    const vat = round2(vatBase * input.vatRate);
    const wht = round2(vatBase * terms.customerWhtRate);
    const payable = round2(vatBase + vat - retention - wht - penalty.amount - otherDeduction);
    return {
        workValue,
        previousValue,
        cumulativeValue,
        isFinal,
        lines,
        advanceRecovery: advance,
        retention,
        penalty,
        k,
        escalation,
        otherDeduction,
        vatBase,
        vat,
        wht,
        payable,
    };
}

/** Amounts of the invoice issued from a certified claim (`ar_invoices`, kind `invoice`). */
export interface InvoiceAmounts {
    net: number;
    vat: number;
    /** net + vat. */
    total: number;
    retention: number;
    advanceRecovery: number;
    penalty: number;
    whtExpected: number;
    payable: number;
}

export function invoiceAmountsFromClaim(c: ClaimBreakdown): InvoiceAmounts {
    return {
        net: c.vatBase,
        vat: c.vat,
        total: round2(c.vatBase + c.vat),
        retention: c.retention,
        advanceRecovery: c.advanceRecovery,
        penalty: c.penalty.amount,
        whtExpected: c.wht,
        payable: c.payable,
    };
}

/** Advance invoice (งวด 0): VAT on the advance, WHT on it as well; nothing else deducted. */
export function advanceInvoiceAmounts(amount: number, vatRate: number, whtRate: number): InvoiceAmounts {
    const net = round2(amount);
    const vat = round2(net * vatRate);
    const wht = round2(net * whtRate);
    return {
        net,
        vat,
        total: round2(net + vat),
        retention: 0,
        advanceRecovery: 0,
        penalty: 0,
        whtExpected: wht,
        payable: round2(net + vat - wht),
    };
}

/** Invoice that pays retention back: no VAT (it was charged with the claim, D-06) and no WHT. */
export function retentionReleaseInvoiceAmounts(amount: number): InvoiceAmounts {
    const net = round2(amount);
    return { net, vat: 0, total: net, retention: 0, advanceRecovery: 0, penalty: 0, whtExpected: 0, payable: net };
}
