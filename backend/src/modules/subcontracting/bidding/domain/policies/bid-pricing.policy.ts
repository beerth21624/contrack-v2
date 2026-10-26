// ─── Pricing a bid and the rules a submitted bid must meet (plan §5.3, §6 rule 4) ───
import type { BidLineInput, BidMode, InstallmentDto, PricingMode } from '@contrack/contract';
import {
    bidLineTotal, bidTotal, isLinePriced, normalizedTotal, type BidPricing,
} from '@contrack/domain/subcontracting/leveling';
import type { SnapshotLine } from '@contrack/domain/subcontracting';
import { DomainError, type Result, err, okVoid } from '../../../../../shared/domain';
import type { BidContent } from '../entities/bid.entity';

/** A complete bid as typed (submit / manual bid), or a draft merged with its saved content. */
export interface BidInput {
    mode: BidMode;
    lines: BidLineInput[];
    lumpTotal: number | null;
    adjustment: number;
    adjustmentNote: string;
    inclusions: string;
    days: number | null;
    earliestStart: string | null;
    crewSkilled: number | null;
    crewLabourers: number | null;
    validUntil: string | null;
    installmentsProposal: InstallmentDto[] | null;
    answers: string[];
    note: string;
    photoFileIds: string[];
}

function pricingOf(input: Pick<BidInput, 'mode' | 'lines' | 'lumpTotal' | 'adjustment'>): BidPricing {
    return { mode: input.mode, lines: input.lines, lumpTotal: input.mode === 'lump' ? input.lumpTotal : null, adjustment: input.adjustment };
}

/** Line totals, total and normalised total of the input on the package lines it refers to. */
export function priceBid(lines: readonly SnapshotLine[], input: BidInput): BidContent {
    const byIdx = new Map(lines.map(l => [l.idx, l]));
    const priced = [...input.lines].sort((a, b) => a.idx - b.idx).map(l => {
        const line = byIdx.get(l.idx);
        const matUnitPrice = line?.materialBy === 'vendor' ? l.matUnitPrice : null;
        const clean = { idx: l.idx, unitPrice: l.unitPrice, matUnitPrice, excluded: l.excluded, reason: l.excluded ? l.reason : '' };
        return { ...clean, total: line === undefined || input.mode === 'lump' ? 0 : bidLineTotal(line, clean) };
    });
    const pricing = pricingOf({ ...input, lines: priced });
    return {
        mode: input.mode,
        lines: priced,
        lumpTotal: input.mode === 'lump' ? input.lumpTotal : null,
        adjustment: input.adjustment,
        adjustmentNote: input.adjustmentNote,
        inclusions: input.inclusions,
        total: bidTotal(lines, pricing),
        normalizedTotal: normalizedTotal(lines, pricing),
        days: input.days,
        earliestStart: input.earliestStart,
        crewSkilled: input.crewSkilled,
        crewLabourers: input.crewLabourers,
        validUntil: input.validUntil,
        installmentsProposal: input.installmentsProposal,
        answers: input.answers,
        note: input.note,
        photoFileIds: [...new Set(input.photoFileIds)],
    };
}

/** Every line reference points at a line of the package (once) and the mode is one the package allows. */
export function checkBidShape(lines: readonly SnapshotLine[], pricingMode: PricingMode, input: Pick<BidInput, 'mode' | 'lines'>): Result<undefined, DomainError> {
    if (pricingMode !== 'vendor_choice' && input.mode !== pricingMode) {
        return err(DomainError.unprocessable(`This package asks for a ${pricingMode} price`, { reason: 'mode_not_allowed' }));
    }
    const known = new Set(lines.map(l => l.idx));
    const seen = new Set<number>();
    for (const l of input.lines) {
        if (!known.has(l.idx)) return err(DomainError.unprocessable('Unknown line', { reason: 'unknown_line', idx: l.idx }));
        if (seen.has(l.idx)) return err(DomainError.unprocessable('Line priced twice', { reason: 'duplicate_line', idx: l.idx }));
        seen.add(l.idx);
    }
    return okVoid();
}

/**
 * Rules of a submitted bid: shape; unit mode prices every line that is not excluded (material too when the vendor
 * supplies it) and at least one line; lump mode gives the amount; excluded lines say why; one answer per question;
 * the total is not negative.
 */
export function checkSubmission(
    lines: readonly SnapshotLine[], pricingMode: PricingMode, questions: number, input: BidInput,
): Result<undefined, DomainError> {
    const shape = checkBidShape(lines, pricingMode, input);
    if (!shape.ok) return shape;
    const prices = new Map(input.lines.map(l => [l.idx, l]));
    for (const p of input.lines) {
        if (p.excluded && p.reason.trim() === '') {
            return err(DomainError.unprocessable('Say why the line is excluded', { reason: 'excluded_needs_reason', idx: p.idx }));
        }
    }
    if (input.mode === 'unit') {
        let pricedCount = 0;
        for (const line of lines) {
            const p = prices.get(line.idx);
            if (p?.excluded === true) continue;
            if (!isLinePriced(line, p)) return err(DomainError.unprocessable('Every line needs a price', { reason: 'line_not_priced', idx: line.idx }));
            pricedCount += 1;
        }
        if (pricedCount === 0) return err(DomainError.unprocessable('Price at least one line', { reason: 'nothing_priced' }));
    } else if (input.lumpTotal === null) {
        return err(DomainError.unprocessable('Give the lump-sum amount', { reason: 'lump_total_missing' }));
    }
    if (input.answers.length !== questions) {
        return err(DomainError.unprocessable('Answer every question of the package', { reason: 'answers_mismatch', expected: questions }));
    }
    if (priceBid(lines, input).total < 0) return err(DomainError.unprocessable('The total cannot be negative', { reason: 'negative_total' }));
    return okVoid();
}
