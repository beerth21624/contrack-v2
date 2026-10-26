import { describe, expect, it } from 'vitest';
import type { LevelingDto } from '@/shared/contract';
import {
    allocationOf, awardErrorInfo, bidderDiffPct, bidderOrder, buildAwardRequest, canWinLine, chooseLine, chooseWhole, EMPTY_CHOICE,
    hasVeryLow, installmentsText, isAwardable, isBlankCell, levelingFileName, OUTDATED_NOTE, setMode, toneClass, winnableIdxs, winnersOf,
} from '../leveling/model';
import { ApiError } from '@/features/cloud/api/errors';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

type Bidder = LevelingDto['bidders'][number];
type Cell = LevelingDto['lines'][number]['cells'][number];

const bidder = (bidId: string, p: Partial<Bidder>): Bidder => ({
    bidId, invitationId: bidId, displayName: bidId.slice(-1), vendorWorkspaceId: null, tier: null, version: 1, mode: 'unit',
    total: 0, normalizedTotal: 0, diffPct: null, flag: null, days: null, earliestStart: null, crewSkilled: null,
    crewLabourers: null, validUntil: null, expired: false, installmentsProposal: null, answers: [], note: '',
    enteredByBuyer: false, outdated: false, ratingFromUs: null, completedWithUs: 0, ...p,
});

const cell = (bidId: string, total: number, p: Partial<Cell> = {}): Cell => ({
    bidId, unitPrice: total, total, diffPct: 0, excluded: false, filled: false, flag: null, ...p,
});

/** 3 lines (estimate 100 / 200 / 300); A unit bid prices all (adjustment −60); B unit bid excludes line 2; C lump 550. */
const leveling: LevelingDto = {
    packageId: A, version: 1, estimateTotal: 600, threshold: 0.2, questions: ['q'],
    bidders: [
        bidder(A, { total: 540, normalizedTotal: 540 }),
        bidder(B, { total: 250, normalizedTotal: 550, installmentsProposal: [{ no: 1, pct: 0.3, condition: 'x' }, { no: 2, pct: 0.7, condition: 'y' }] }),
        bidder(C, { mode: 'lump', total: 550, normalizedTotal: 550 }),
    ],
    lines: [
        { idx: 0, desc: 'a', unit: 'ม.', qtyPriced: 1, estUnit: 100, estTotal: 100, cells: [cell(A, 100), cell(B, 60, { flag: 'very_low' }), cell(C, 92, { filled: true, unitPrice: null })] },
        { idx: 1, desc: 'b', unit: 'ม.', qtyPriced: 1, estUnit: 200, estTotal: 200, cells: [cell(A, 200), cell(B, 190), cell(C, 183, { filled: true, unitPrice: null })] },
        { idx: 2, desc: 'c', unit: 'ม.', qtyPriced: 1, estUnit: 300, estTotal: 300, cells: [cell(A, 300), cell(B, 300, { excluded: true, filled: true, unitPrice: null }), cell(C, 275, { filled: true, unitPrice: null })] },
    ],
};

describe('leveling model', () => {
    it('orders bidders by normalised total, ties by position', () => {
        expect(bidderOrder(leveling.bidders, 'normalized')).toEqual([0, 1, 2]);
        expect(bidderOrder([leveling.bidders[2], leveling.bidders[0]].filter(b => b !== undefined), 'normalized')).toEqual([1, 0]);
        expect(bidderOrder(leveling.bidders, 'original')).toEqual([0, 1, 2]);
    });

    it('tones flags quietly', () => {
        expect(toneClass('very_low')).toBe('bg-red-50');
        expect(toneClass('high')).toBe('bg-amber-50');
        expect(toneClass('low')).toBe('bg-amber-50');
        expect(toneClass(null)).toBe('');
        expect(hasVeryLow(leveling)).toBe(true);
    });

    it('a unit bid wins only priced lines, a lump bid every line', () => {
        expect(winnableIdxs(leveling, 0)).toEqual([0, 1, 2]);
        expect(winnableIdxs(leveling, 1)).toEqual([0, 1]);
        expect(winnableIdxs(leveling, 2)).toEqual([0, 1, 2]);
    });

    it('whole package: the bid takes the lines it can win; again clears', () => {
        const c = chooseWhole(EMPTY_CHOICE, B);
        expect([...allocationOf(leveling, c)]).toEqual([[0, B], [1, B]]);
        expect(allocationOf(leveling, chooseWhole(c, B)).size).toBe(0);
    });

    it('per line: unit picks, toggles, refuses unpriced lines', () => {
        let c = setMode(leveling, EMPTY_CHOICE, 'per_line');
        c = chooseLine(leveling, c, 0, B);
        c = chooseLine(leveling, c, 2, A);
        c = chooseLine(leveling, c, 2, B); // B excluded line 2: ignored
        expect([...allocationOf(leveling, c)]).toEqual([[0, B], [2, A]]);
        c = chooseLine(leveling, c, 0, B);
        expect([...allocationOf(leveling, c)]).toEqual([[2, A]]);
    });

    it('per line: a lump bid takes every line, a unit pick afterwards releases it', () => {
        let c = setMode(leveling, EMPTY_CHOICE, 'per_line');
        c = chooseLine(leveling, c, 0, A);
        c = chooseLine(leveling, c, 1, C);
        expect([...allocationOf(leveling, c).values()]).toEqual([C, C, C]);
        c = chooseLine(leveling, c, 1, A);
        expect([...allocationOf(leveling, c)]).toEqual([[1, A]]);
        c = chooseLine(leveling, c, 0, C);
        c = chooseLine(leveling, c, 2, C); // same lump again clears all
        expect(allocationOf(leveling, c).size).toBe(0);
    });

    it('switching modes carries the allocation', () => {
        const whole = chooseWhole(EMPTY_CHOICE, A);
        const perLine = setMode(leveling, whole, 'per_line');
        expect(perLine.perLine.size).toBe(3);
        expect(setMode(leveling, perLine, 'whole').whole).toBe(A);
        const mixed = chooseLine(leveling, perLine, 0, B);
        expect(setMode(leveling, mixed, 'whole').whole).toBeNull();
    });

    it('winner values: unit lines + share of the adjustment, lump at its total', () => {
        const alloc = new Map([[0, B], [1, A], [2, A]]);
        const w = winnersOf(leveling, alloc);
        expect(w.map(x => [x.bidId, x.idxs, x.value])).toEqual([[A, [1, 2], 450], [B, [0], 60]]);
        expect(winnersOf(leveling, new Map([[0, C], [1, C], [2, C]]))[0]?.value).toBe(550);
    });

    it('builds the award body in line order with installment sources', () => {
        const alloc = new Map([[1, A], [0, B]]);
        expect(buildAwardRequest(leveling, alloc, { [B]: 'bid', [A]: 'bid' }, ' ok ')).toEqual({
            allocations: [{ idx: 0, bidId: B }, { idx: 1, bidId: A }],
            installmentsFrom: { [B]: 'bid', [A]: 'package' },
            note: 'ok',
        });
    });

    it('formats stages and the file name', () => {
        expect(installmentsText([{ pct: 0.3 }, { pct: 0.4 }, { pct: 0.3 }])).toBe('30/40/30%');
        expect(levelingFileName('งาน: ไฟฟ้า/ประปา')).toBe('เทียบราคา_งาน_ ไฟฟ้า_ประปา.xlsx');
        expect(levelingFileName('  ')).toBe('เทียบราคา_แพ็กเกจ.xlsx');
    });
});

describe('leveling workbook', () => {
    it('writes lines, bidders in display order and the footer', async () => {
        const { levelingWorkbook } = await import('../leveling/xlsx');
        const wb = await levelingWorkbook(leveling, 'งานไฟฟ้า', 'normalized');
        const ws = wb.getWorksheet('เทียบราคา');
        expect(ws?.getCell(3, 6).value).toBe('a');
        expect(ws?.getCell(5, 1).value).toBe('a');
        expect(ws?.getCell(5, 10).value).toBe(60);
        expect(ws?.getCell(7, 9).value).toBe('ไม่รวม');
        expect(ws?.getCell(8, 1).value).toBe('รวม');
        expect(ws?.getCell(8, 6).value).toBe(540);
    });
});

function must<T>(v: T | undefined): T {
    if (v === undefined) throw new Error('missing fixture');
    return v;
}

describe('outdated bids (made before an addendum)', () => {
    const stale: LevelingDto = {
        ...leveling,
        bidders: leveling.bidders.map((b, k) => (k === 0 ? { ...b, outdated: true, normalizedTotal: 100, diffPct: -0.5 } : b)),
        lines: leveling.lines.map(l => (l.idx === 1
            ? { ...l, cells: l.cells.map((c, k) => (k === 0 ? { ...c, unitPrice: null, total: 0, filled: false, diffPct: null } : c)) }
            : l)),
    };
    it('come last in both orders, even when cheapest', () => {
        expect(bidderOrder(stale.bidders, 'normalized')).toEqual([1, 2, 0]);
        expect(bidderOrder(stale.bidders, 'original')).toEqual([1, 2, 0]);
    });
    it('cannot win anything (no whole-package or per-line pick)', () => {
        expect(isAwardable(must(stale.bidders[0]))).toBe(false);
        expect(winnableIdxs(stale, 0)).toEqual([]);
        expect(canWinLine(stale, 0, 0)).toBe(false);
        expect(chooseLine(stale, EMPTY_CHOICE, 0, A)).toBe(EMPTY_CHOICE);
        expect(allocationOf(stale, chooseWhole(EMPTY_CHOICE, A)).size).toBe(0);
    });
    it('changed lines show as blank, and no diff % for the bid', () => {
        const b = must(stale.bidders[0]);
        expect(isBlankCell(b, must(must(stale.lines[1]).cells[0]))).toBe(true);
        expect(isBlankCell(b, must(must(stale.lines[0]).cells[0]))).toBe(false);
        expect(isBlankCell(must(leveling.bidders[0]), { unitPrice: null, total: 0, filled: false, excluded: false })).toBe(false);
        expect(bidderDiffPct(b)).toBeNull();
        expect(bidderDiffPct({ outdated: false, diffPct: 0.1 })).toBe(0.1);
    });
});

describe('award errors', () => {
    const err = (status: number, reason: string) => new ApiError(status, status === 409 ? 'conflict' : 'unprocessable', 'x', { reason });
    it('conflicts refetch with one calm message', () => {
        expect(awardErrorInfo(err(409, 'package_not_open'))).toEqual({ text: 'ข้อมูลเปลี่ยนแล้ว ลองอีกครั้ง', refetch: true });
        expect(awardErrorInfo(err(409, 'bid_changed'))).toEqual({ text: 'ข้อมูลเปลี่ยนแล้ว ลองอีกครั้ง', refetch: true });
        expect(awardErrorInfo(err(422, 'bid_outdated'))).toEqual({ text: OUTDATED_NOTE, refetch: true });
    });
    it('negative total explains itself; anything else falls back', () => {
        expect(awardErrorInfo(err(422, 'negative_total'))?.refetch).toBe(false);
        expect(awardErrorInfo(err(422, 'other'))).toBeNull();
        expect(awardErrorInfo(new Error('x'))).toBeNull();
    });
});
