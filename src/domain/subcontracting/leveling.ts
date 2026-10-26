// ─── Bid math: totals, the comparison table (bid leveling) and the price of an award ───
// Plan §4.5 / §4.6 / §6 rules 4 and 7. Pure functions shared by the server (bids are stored with these totals, the
// leveling table and awards are computed with them) and the browser (live totals in the bid form).
// A unit bid prices lines: Σ priceLine(line) + adjustment. A lump bid is one amount: lumpTotal + adjustment.
// The normalised total makes bids comparable: a line a unit bid left out (excluded / not priced) counts at its
// estimate. A lump bid is spread over the lines by their share of the estimate for DISPLAY only; its normalised
// total is its total. A bid made for an older package version (an addendum since) is never moved onto the new lines:
// it shows its own total and its prices on unchanged lines only (levelOutdatedBid), and cannot be awarded.
import { priceLine, round2, type SnapshotLine } from './snapshot';

/** Below the estimate by more than this fraction is "abnormally low, check the scope" (plan §4.5). */
export const VERY_LOW_THRESHOLD = 0.3;
/** Default of the workspace setting `levelingThreshold`. */
export const DEFAULT_LEVELING_THRESHOLD = 0.2;

export type LevelingBidMode = 'unit' | 'lump';
export type LevelingFlag = 'high' | 'low' | 'very_low' | null;

/** The price a bid gives one line (by the line's idx in the package version the prices refer to). */
export interface BidLinePrice {
    idx: number;
    unitPrice: number | null;
    matUnitPrice: number | null;
    excluded: boolean;
}

export interface BidPricing {
    mode: LevelingBidMode;
    lines: readonly BidLinePrice[];
    lumpTotal: number | null;
    adjustment: number;
}

/** What of a snapshot line the bid math needs. */
export type PricedLine = Pick<SnapshotLine, 'idx' | 'qtyPriced' | 'qtyMaterial' | 'materialBy' | 'estTotal' | 'estLabUnit' | 'estMatUnit'>;

function priceMap(bid: Pick<BidPricing, 'lines'>): Map<number, BidLinePrice> {
    return new Map(bid.lines.map(l => [l.idx, l]));
}

/** A line the bid really priced: not excluded, unit price given (and material price when the vendor supplies material). */
export function isLinePriced(line: Pick<SnapshotLine, 'materialBy'>, price: BidLinePrice | undefined): boolean {
    if (price === undefined || price.excluded || price.unitPrice === null) return false;
    return line.materialBy !== 'vendor' || price.matUnitPrice !== null;
}

/** Total of one line of a bid: 0 when excluded or missing; a missing price counts as 0 (drafts). */
export function bidLineTotal(line: Pick<SnapshotLine, 'qtyPriced' | 'qtyMaterial' | 'materialBy'>, price: BidLinePrice | undefined): number {
    if (price === undefined || price.excluded) return 0;
    return priceLine(line, price.unitPrice, price.matUnitPrice);
}

/** Total of each line of the package for a unit bid (by idx; 0 for excluded / missing lines). */
export function bidLineTotals(lines: readonly PricedLine[], bid: Pick<BidPricing, 'lines'>): Map<number, number> {
    const prices = priceMap(bid);
    return new Map(lines.map(l => [l.idx, bidLineTotal(l, prices.get(l.idx))]));
}

/** The bid total: unit = Σ line totals + adjustment; lump = lumpTotal + adjustment. */
export function bidTotal(lines: readonly PricedLine[], bid: BidPricing): number {
    if (bid.mode === 'lump') return round2((bid.lumpTotal ?? 0) + bid.adjustment);
    let sum = 0;
    for (const t of bidLineTotals(lines, bid).values()) sum += t;
    return round2(sum + bid.adjustment);
}

/** Total made comparable: unit lines left out count at their estimate; a lump bid's normalised total is its total. */
export function normalizedTotal(lines: readonly PricedLine[], bid: BidPricing): number {
    if (bid.mode === 'lump') return bidTotal(lines, bid);
    const prices = priceMap(bid);
    let sum = 0;
    for (const l of lines) {
        const p = prices.get(l.idx);
        sum += p !== undefined && isLinePriced(l, p) ? priceLine(l, p.unitPrice, p.matUnitPrice) : l.estTotal;
    }
    return round2(sum + bid.adjustment);
}

/** (total − estimate) / estimate, rounded to 4 decimals; null when the estimate is 0 (nothing to compare with). */
export function diffFromEstimate(total: number, estimate: number): number | null {
    if (!(estimate > 0)) return null;
    return Math.round(((total - estimate) / estimate) * 10000) / 10000;
}

/** high above +threshold, very_low below −30 %, low below −threshold. */
export function flagOf(diff: number | null, threshold: number): LevelingFlag {
    if (diff === null) return null;
    if (diff > threshold) return 'high';
    if (diff < -VERY_LOW_THRESHOLD) return 'very_low';
    if (diff < -threshold) return 'low';
    return null;
}

/**
 * Splits an amount over the lines by their share of the estimate (equal shares when every estimate is 0), in satang;
 * the rounding remainder goes to the last line so the parts add up to the amount exactly.
 */
export function spreadByEstimate(lines: readonly Pick<SnapshotLine, 'estTotal'>[], amount: number): number[] {
    return spreadByWeights(lines.map(l => l.estTotal), amount);
}

function spreadByWeights(weights: readonly number[], amount: number): number[] {
    if (weights.length === 0) return [];
    const sum = weights.reduce((s, w) => s + w, 0);
    const parts = weights.map(w => round2(sum > 0 ? amount * (w / sum) : amount / weights.length));
    const rest = round2(amount - parts.reduce((s, p) => s + p, 0));
    parts[parts.length - 1] = round2((parts[parts.length - 1] ?? 0) + rest);
    return parts;
}

/** Estimate per unit shown in the comparison column: labour (BOQ K), plus material (BOQ I) when the vendor supplies it. */
export function estimateUnitOf(line: Pick<SnapshotLine, 'estLabUnit' | 'estMatUnit' | 'materialBy'>): number {
    return round2(line.estLabUnit + (line.materialBy === 'vendor' ? line.estMatUnit : 0));
}

export interface LevelingCellView {
    /** Labour + material per unit the bid gives (null when not priced or a lump bid). */
    unitPrice: number | null;
    total: number;
    diffPct: number | null;
    excluded: boolean;
    /** Filled from the estimate (excluded / not priced) or spread from a lump sum. */
    filled: boolean;
    flag: LevelingFlag;
}

export interface BidLevelingView {
    total: number;
    normalizedTotal: number;
    diffPct: number | null;
    flag: LevelingFlag;
    /** One cell per line, in the order of `lines`. */
    cells: LevelingCellView[];
}

/** One bidder column of the comparison table. `lines` are the package lines the bid's prices refer to. */
export function levelBid(lines: readonly PricedLine[], bid: BidPricing, threshold: number): BidLevelingView {
    const estimate = round2(lines.reduce((s, l) => s + l.estTotal, 0));
    const total = bidTotal(lines, bid);
    const normalized = normalizedTotal(lines, bid);
    const diff = diffFromEstimate(normalized, estimate);
    let cells: LevelingCellView[];
    if (bid.mode === 'lump') {
        const spread = spreadByEstimate(lines, total);
        cells = lines.map((_, k) => ({
            unitPrice: null, total: spread[k] ?? 0, diffPct: null, excluded: false, filled: true, flag: null,
        }));
    } else {
        const prices = priceMap(bid);
        cells = lines.map(l => {
            const p = prices.get(l.idx);
            if (p === undefined || !isLinePriced(l, p)) {
                return { unitPrice: null, total: l.estTotal, diffPct: null, excluded: p?.excluded ?? false, filled: true, flag: null };
            }
            return pricedCell(l, p, threshold);
        });
    }
    return { total, normalizedTotal: normalized, diffPct: diff, flag: flagOf(diff, threshold), cells };
}

/** The cell of a line the bid priced: labour + material per unit, line total, difference from the line estimate. */
function pricedCell(line: PricedLine, p: BidLinePrice, threshold: number): LevelingCellView {
    const lineTotal = priceLine(line, p.unitPrice, p.matUnitPrice);
    const unit = round2((p.unitPrice ?? 0) + (line.materialBy === 'vendor' ? p.matUnitPrice ?? 0 : 0));
    const d = diffFromEstimate(lineTotal, line.estTotal);
    return { unitPrice: unit, total: lineTotal, diffPct: d, excluded: false, filled: false, flag: flagOf(d, threshold) };
}

type MatchableLine = Pick<SnapshotLine, 'idx' | 'lineKey' | 'desc' | 'unit'>;

/** The line of `from` that `target` continues: BOQ lines by line key, typed lines by description + unit. */
function matchingLine<T extends MatchableLine>(target: MatchableLine, from: readonly T[]): T | undefined {
    return target.lineKey !== null
        ? from.find(f => f.lineKey === target.lineKey)
        : from.find(f => f.lineKey === null && f.desc === target.desc && f.unit === target.unit);
}

// ── Bids made for an older package version (an addendum since) ──

/** A cell without a price: the bid was made for an older version and never saw this line as it is now. */
export const EMPTY_LEVELING_CELL: Readonly<LevelingCellView> = { unitPrice: null, total: 0, diffPct: null, excluded: false, filled: false, flag: null };

/** A line as the bidder saw it: what decides whether a price given for one version still holds in another. */
export type VersionedLine = PricedLine & Pick<SnapshotLine, 'lineKey' | 'desc' | 'unit'>;

/**
 * Lines of `current` unchanged since `old` (matched like `remapBidLines`, with the same description, unit, quantities
 * and material supply): current idx → idx in `old`. Changed and new lines are left out: a price given for them no
 * longer describes the work.
 */
export function unchangedLines(old: readonly VersionedLine[], current: readonly VersionedLine[]): Map<number, number> {
    const out = new Map<number, number>();
    for (const target of current) {
        const s = matchingLine(target, old);
        if (s === undefined) continue;
        const same = s.desc === target.desc && s.unit === target.unit && s.qtyPriced === target.qtyPriced
            && s.qtyMaterial === target.qtyMaterial && s.materialBy === target.materialBy;
        if (same) out.set(target.idx, s.idx);
    }
    return out;
}

/**
 * Column of a bid made for an older package version. It is NOT made comparable: prices are never moved onto new
 * quantities. Its total and "normalised" total are the total it was submitted with (no difference, no flag). A cell
 * shows the bid's price only on a line that did not change (`unchangedLines`); every other cell is `EMPTY_LEVELING_CELL`. A lump
 * bid has no line prices: every cell is empty. Such a bid cannot be awarded: the vendor must resubmit.
 */
export function levelOutdatedBid(
    current: readonly VersionedLine[], old: readonly VersionedLine[], bid: BidPricing, storedTotal: number, threshold: number,
): BidLevelingView {
    const same = bid.mode === 'unit' ? unchangedLines(old, current) : new Map<number, number>();
    const prices = priceMap(bid);
    const cells = current.map((l): LevelingCellView => {
        const oldIdx = same.get(l.idx);
        const p = oldIdx === undefined ? undefined : prices.get(oldIdx);
        if (p === undefined) return { ...EMPTY_LEVELING_CELL };
        if (p.excluded) return { ...EMPTY_LEVELING_CELL, excluded: true };
        return isLinePriced(l, p) ? pricedCell(l, p, threshold) : { ...EMPTY_LEVELING_CELL };
    });
    return { total: storedTotal, normalizedTotal: storedTotal, diffPct: null, flag: null, cells };
}

/**
 * Moves the prices of a bid made for an older package version onto the lines of another version: BOQ lines match by
 * line key, typed lines by description + unit. Lines of `to` without a match get no price. Used only to carry a
 * vendor's DRAFT over an addendum (the vendor re-checks it before submitting); never for leveling or awards.
 */
export function remapBidLines<T extends BidLinePrice>(prices: readonly T[], from: readonly MatchableLine[], to: readonly MatchableLine[]): T[] {
    const byIdx = new Map(prices.map(p => [p.idx, p]));
    const out: T[] = [];
    for (const target of to) {
        const source = matchingLine(target, from);
        const price = source === undefined ? undefined : byIdx.get(source.idx);
        if (price !== undefined) out.push({ ...price, idx: target.idx });
    }
    return out;
}

// ── Award (plan §4.6, §6 rule 7) ──

export interface AwardLinePrice {
    idx: number;
    unitPrice: number | null;
    matUnitPrice: number | null;
    /** The line's part of the award total (adjustment spread over the awarded lines). */
    total: number;
}

export type AwardPricing =
    | { ok: true; lines: AwardLinePrice[]; total: number }
    | { ok: false; reason: AwardRefusal; idx?: number };

export type AwardRefusal = 'no_lines' | 'unknown_line' | 'duplicate_line' | 'line_not_priced' | 'lump_needs_all_lines' | 'negative_total';

/**
 * Price of the lines `chosen` awarded to one bid. `lines` are the package version the bid was made for (an outdated bid
 * is never priced on other lines).
 * Unit bid: Σ chosen line totals + adjustment × (chosen line totals / the bid's priced total, i.e. Σ of every line it
 * priced); every chosen line must be priced by the bid. Lump bid: the whole package only, at its total (spread over
 * the lines by estimate share). A part below 0 is refused (`negative_total`).
 */
export function priceAward(lines: readonly PricedLine[], bid: BidPricing, chosen: readonly number[]): AwardPricing {
    if (chosen.length === 0) return { ok: false, reason: 'no_lines' };
    const byIdx = new Map(lines.map(l => [l.idx, l]));
    const seen = new Set<number>();
    for (const idx of chosen) {
        if (!byIdx.has(idx)) return { ok: false, reason: 'unknown_line', idx };
        if (seen.has(idx)) return { ok: false, reason: 'duplicate_line', idx };
        seen.add(idx);
    }
    if (bid.mode === 'lump') {
        const missing = lines.find(l => !seen.has(l.idx));
        if (missing !== undefined) return { ok: false, reason: 'lump_needs_all_lines', idx: missing.idx };
        const total = bidTotal(lines, bid);
        if (total < 0) return { ok: false, reason: 'negative_total' };
        const spread = spreadByEstimate(lines, total);
        return {
            ok: true,
            total,
            lines: lines.map((l, k) => ({ idx: l.idx, unitPrice: null, matUnitPrice: null, total: spread[k] ?? 0 })),
        };
    }

    const prices = priceMap(bid);
    const chosenLines = lines.filter(l => seen.has(l.idx));
    for (const l of chosenLines) {
        if (!isLinePriced(l, prices.get(l.idx))) return { ok: false, reason: 'line_not_priced', idx: l.idx };
    }
    const lineTotal = (l: PricedLine): number => bidLineTotal(l, prices.get(l.idx));
    const pricedLines = lines.filter(l => isLinePriced(l, prices.get(l.idx)));
    const chosenSum = round2(chosenLines.reduce((s, l) => s + lineTotal(l), 0));
    // The bid's original priced total (its total before the adjustment): every line it priced in its own version.
    const allPriced = round2(pricedLines.reduce((s, l) => s + lineTotal(l), 0));
    const whole = pricedLines.every(l => seen.has(l.idx));
    const share = whole ? 1 : allPriced > 0 ? chosenSum / allPriced : 0;
    const total = round2(chosenSum + round2(bid.adjustment * share));
    if (total < 0) return { ok: false, reason: 'negative_total' };
    const weights = chosenLines.map(l => (chosenSum > 0 ? lineTotal(l) : 1));
    const parts = spreadByWeights(weights, total);
    return {
        ok: true,
        total,
        lines: chosenLines.map((l, k) => {
            const p = prices.get(l.idx);
            return { idx: l.idx, unitPrice: p?.unitPrice ?? null, matUnitPrice: l.materialBy === 'vendor' ? p?.matUnitPrice ?? null : null, total: parts[k] ?? 0 };
        }),
    };
}
