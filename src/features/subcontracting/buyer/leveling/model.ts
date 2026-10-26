// ─── Pure model of the comparison table: column order, cell tone, award choice (whole package / per line) ───
// Award rules (plan §4.6, §6 rule 7; server: src/domain/subcontracting/leveling.ts): every line goes to one bid; a
// unit bid can win only the lines it really priced; a lump bid wins every line or nothing.
import type { AwardRequest, LevelingDto } from '@/shared/contract';
import { round2 } from '@/domain/subcontracting/snapshot';
import { isApiError } from '@/features/cloud/api/errors';

export type Bidder = LevelingDto['bidders'][number];
export type LevelingLine = LevelingDto['lines'][number];
export type LevelingCell = LevelingLine['cells'][number];
export type Flag = LevelingCell['flag'];

export type BidderOrder = 'normalized' | 'original';

/**
 * Positions (into `bidders` / `cells`) in display order: cheapest normalised total first, or as received. Outdated
 * bids (made before an addendum, cannot be awarded) always come last.
 */
export function bidderOrder(bidders: readonly Bidder[], order: BidderOrder): number[] {
    const ks = bidders.map((_, k) => k);
    return ks.sort((a, b) => {
        const x = bidders[a];
        const y = bidders[b];
        if (x === undefined || y === undefined) return 0;
        const stale = Number(x.outdated) - Number(y.outdated);
        if (stale !== 0) return stale;
        return order === 'original' ? a - b : x.normalizedTotal - y.normalizedTotal || a - b;
    });
}

/** Shown on a bid made before the latest addendum: the server refuses to award it (422 bid_outdated). */
export const OUTDATED_NOTE = 'ราคานี้ทำก่อนแก้ไขแพ็กเกจ รอทีมช่างส่งราคาใหม่';

/** The bid can be awarded (not made before the latest addendum). */
export function isAwardable(bidder: Pick<Bidder, 'outdated'>): boolean {
    return !bidder.outdated;
}

/**
 * A cell of an outdated bid on a line the addendum changed: the server sends it unpriced (unitPrice null, total 0,
 * not filled with the estimate). Shown as "—", never as a price or a diff.
 */
export function isBlankCell(bidder: Pick<Bidder, 'outdated'>, cell: Pick<LevelingCell, 'unitPrice' | 'total' | 'filled' | 'excluded'>): boolean {
    return bidder.outdated && !cell.excluded && !cell.filled && cell.unitPrice === null && cell.total === 0;
}

/** Diff % of a bid's total against the estimate; none for an outdated bid (its total is its own, not normalised). */
export function bidderDiffPct(bidder: Pick<Bidder, 'outdated' | 'diffPct'>): number | null {
    return bidder.outdated ? null : bidder.diffPct;
}

/** What to tell the buyer when POST /award fails, and whether the table must be fetched again. */
export function awardErrorInfo(e: unknown): { text: string; refetch: boolean } | null {
    if (!isApiError(e)) return null;
    const details = e.details as { reason?: unknown } | undefined;
    const reason = typeof details?.reason === 'string' ? details.reason : null;
    if (e.status === 409 && (reason === 'package_not_open' || reason === 'bid_changed')) {
        return { text: 'ข้อมูลเปลี่ยนแล้ว ลองอีกครั้ง', refetch: true };
    }
    if (e.status === 422 && reason === 'bid_outdated') return { text: OUTDATED_NOTE, refetch: true };
    if (e.status === 422 && reason === 'negative_total') {
        return { text: 'ยอดที่จะจ้างติดลบ (ส่วนลดมากกว่าราคาแถวที่เลือก) เลือกแถวเพิ่มหรือเลือกรายอื่น', refetch: false };
    }
    return null;
}

/** Quiet background of a flagged amount: amber beyond the threshold, light red when abnormally low. */
export function toneClass(flag: Flag): string {
    if (flag === 'very_low') return 'bg-red-50';
    if (flag === 'high' || flag === 'low') return 'bg-amber-50';
    return '';
}

/** Excel fill (ARGB) of the same tones. */
export function toneArgb(flag: Flag): string | undefined {
    if (flag === 'very_low') return 'FFFEE2E2';
    if (flag === 'high' || flag === 'low') return 'FFFEF3C7';
    return undefined;
}

/** Any amount in the table is abnormally low (shows the "check the scope" note). */
export function hasVeryLow(leveling: LevelingDto): boolean {
    return leveling.bidders.some(b => b.flag === 'very_low')
        || leveling.lines.some(l => l.cells.some(c => c.flag === 'very_low'));
}

/** Line idxs bidder k can win: every line for a lump bid, the lines it priced for a unit bid. */
export function winnableIdxs(leveling: LevelingDto, k: number): number[] {
    const bidder = leveling.bidders[k];
    if (bidder === undefined || !isAwardable(bidder)) return [];
    if (bidder.mode === 'lump') return leveling.lines.map(l => l.idx);
    return leveling.lines.filter(l => {
        const c = l.cells[k];
        return c !== undefined && !c.filled && !c.excluded;
    }).map(l => l.idx);
}

export function canWinLine(leveling: LevelingDto, k: number, idx: number): boolean {
    return winnableIdxs(leveling, k).includes(idx);
}

// ── award choice ──

export type AwardMode = 'whole' | 'per_line';

export interface AwardChoice {
    mode: AwardMode;
    /** Whole package: the chosen bid. */
    whole: string | null;
    /** Per line: idx → bidId. */
    perLine: ReadonlyMap<number, string>;
}

export const EMPTY_CHOICE: AwardChoice = { mode: 'whole', whole: null, perLine: new Map() };

const indexOfBid = (leveling: LevelingDto, bidId: string) => leveling.bidders.findIndex(b => b.bidId === bidId);
const isLump = (leveling: LevelingDto, bidId: string) => leveling.bidders.find(b => b.bidId === bidId)?.mode === 'lump';

/** Switch between whole package and per line; the current allocation carries over. */
export function setMode(leveling: LevelingDto, choice: AwardChoice, mode: AwardMode): AwardChoice {
    if (mode === choice.mode) return choice;
    if (mode === 'per_line') return { mode, whole: null, perLine: allocationOf(leveling, choice) };
    const bids = new Set(choice.perLine.values());
    const only = bids.size === 1 ? [...bids][0] ?? null : null;
    return { mode, whole: only, perLine: new Map() };
}

/** Whole package to one bid (the same bid again clears the choice). */
export function chooseWhole(choice: AwardChoice, bidId: string): AwardChoice {
    return { mode: 'whole', whole: choice.whole === bidId ? null : bidId, perLine: new Map() };
}

/**
 * Per line: give line `idx` to `bidId` (the same pick again clears it). A lump bid takes every line (and is cleared
 * as a whole); picking a unit bid on a line that a lump bid held releases the lump bid's other lines too.
 */
export function chooseLine(leveling: LevelingDto, choice: AwardChoice, idx: number, bidId: string): AwardChoice {
    const k = indexOfBid(leveling, bidId);
    if (k < 0 || !canWinLine(leveling, k, idx)) return choice;
    const current = choice.perLine.get(idx);
    if (isLump(leveling, bidId)) {
        if (current === bidId) return { ...choice, mode: 'per_line', perLine: new Map() };
        return { ...choice, mode: 'per_line', perLine: new Map(leveling.lines.map(l => [l.idx, bidId])) };
    }
    const next = new Map([...choice.perLine].filter(([, b]) => !isLump(leveling, b)));
    if (current === bidId) next.delete(idx);
    else next.set(idx, bidId);
    return { ...choice, mode: 'per_line', perLine: next };
}

/** idx → bidId of what is chosen now (whole package: the lines the bid can win). */
export function allocationOf(leveling: LevelingDto, choice: AwardChoice): Map<number, string> {
    if (choice.mode === 'per_line') return new Map(choice.perLine);
    if (choice.whole === null) return new Map();
    const k = indexOfBid(leveling, choice.whole);
    const bidId = choice.whole;
    return new Map(winnableIdxs(leveling, k).map(idx => [idx, bidId]));
}

export interface Winner {
    bidId: string;
    /** Position in `bidders`. */
    k: number;
    bidder: Bidder;
    idxs: number[];
    /** Value of the award to this bid (lump: its total; unit: chosen lines + their share of the bid's adjustment). */
    value: number;
}


/** The bids that win something, in bidder order, with the value of what each wins. */
export function winnersOf(leveling: LevelingDto, allocation: ReadonlyMap<number, string>): Winner[] {
    const out: Winner[] = [];
    leveling.bidders.forEach((bidder, k) => {
        const idxs = leveling.lines.filter(l => allocation.get(l.idx) === bidder.bidId).map(l => l.idx);
        if (idxs.length === 0) return;
        if (bidder.mode === 'lump') {
            out.push({ bidId: bidder.bidId, k, bidder, idxs, value: bidder.total });
            return;
        }
        const totalOf = (idx: number) => leveling.lines.find(l => l.idx === idx)?.cells[k]?.total ?? 0;
        const priced = winnableIdxs(leveling, k);
        const pricedSum = priced.reduce((s, idx) => s + totalOf(idx), 0);
        const chosenSum = idxs.reduce((s, idx) => s + totalOf(idx), 0);
        const adjustment = bidder.total - pricedSum;
        const share = pricedSum > 0 ? adjustment * (chosenSum / pricedSum) : 0;
        out.push({ bidId: bidder.bidId, k, bidder, idxs, value: round2(chosenSum + share) });
    });
    return out;
}

/** POST /award body: lines in package order; installments source per winner (default the package's). */
export function buildAwardRequest(
    leveling: LevelingDto,
    allocation: ReadonlyMap<number, string>,
    installmentsFrom: Readonly<Record<string, 'package' | 'bid'>>,
    note: string,
): AwardRequest {
    const allocations = leveling.lines
        .filter(l => allocation.has(l.idx))
        .map(l => ({ idx: l.idx, bidId: allocation.get(l.idx) ?? '' }));
    const winners = new Set(allocations.map(a => a.bidId));
    const from = Object.fromEntries(
        [...winners].map(bidId => {
            const hasProposal = (leveling.bidders.find(b => b.bidId === bidId)?.installmentsProposal ?? null) !== null;
            return [bidId, hasProposal ? installmentsFrom[bidId] ?? 'package' : 'package'] as const;
        }),
    );
    return { allocations, installmentsFrom: from, note: note.trim() };
}

/** "30/40/30%" of a proposed installment list. */
export function installmentsText(list: readonly { pct: number }[]): string {
    return `${list.map(i => String(Math.round(i.pct * 1000) / 10)).join('/')}%`;
}

/** Safe file name: `เทียบราคา_<title>.xlsx`. */
export function levelingFileName(title: string): string {
    const clean = title.replace(/[\\/:*?"<>|\r\n\t]+/g, '_').trim().slice(0, 80);
    return `เทียบราคา_${clean === '' ? 'แพ็กเกจ' : clean}.xlsx`;
}
