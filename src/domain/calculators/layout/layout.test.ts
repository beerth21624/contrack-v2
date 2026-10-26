import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import { layout, layoutLine } from '.';

const ctx = { outputs: () => undefined };

/** Deck p19 material table: [ฐานคงที่, จำนวนก่อนเผื่อ, จำนวนสั่งซื้อ, รวมราคา]. */
const SHEET_ROWS: [number, number, number, number][] = [
    [0, 26, 28, 0],
    [0, 78, 82, 0],
    [21, 21, 23, 0],
    [1, 1, 2, 0],
    [1, 1, 2, 0],
];

describe('STEP 04 วางผัง / ปักหมุด (external sheet, deck p19)', () => {
    const input = layout.defaults();
    const out = layout.compute(input, ctx);

    it('material table matches the screenshot', () => {
        expect(input.materials.map(l => layoutLine(l, input)))
            .toEqual(SHEET_ROWS.map(([fixed, beforeWaste, orderQty, total]) => ({ fixed, beforeWaste, orderQty, total })));
    });

    it('LIVE PREVIEW and BOQ PREVIEW', () => {
        expect(out).toEqual({
            points: 26, stakes: 21,
            orderBoards: 28, orderEucalyptus: 82, orderStakes: 23,
            materialTotal: 0, labour: 0, total: 0,
        });
    });

    it('is not linked into BOQ R32 yet (Excel I32 4,000 / K32 1,500 stay typed, D8)', () => {
        expect(layout.boqLinks).toEqual([]);
        const s4 = computeProject(createProject(), [layout]).boq.sections.find(s => s.no === 4);
        expect(s4?.total).toBeCloseTo(golden.sections['4'].M, 2);
    });

    it('prices and labour flow into the totals', () => {
        const i = layout.defaults();
        i.materials = i.materials.map((m, k) => ({ ...m, unitPrice: [30, 60, 15, 60, 45][k] ?? 0 }));
        i.labour = 1500;
        const o = layout.compute(i, ctx);
        // 28×30 + 82×60 + 23×15 + 2×60 + 2×45 = 840 + 4,920 + 345 + 120 + 90
        expect(o.materialTotal).toBe(6315);
        expect(o.total).toBe(7815);
    });

    it('the stake row follows จำนวนไม้ปักหมุด; added rows count too', () => {
        const i = layout.defaults();
        i.stakes = 30;
        i.points = 10;
        i.materials.push({ item: 'สีสเปรย์', unit: 'กระป๋อง', perPoint: 0, fixed: 2, unitPrice: 65 });
        const o = layout.compute(i, ctx);
        expect(o.orderStakes).toBe(32);       // 30 × 1.05 = 31.5 → 32
        expect(o.orderBoards).toBe(11);       // 10 × 1.05 = 10.5 → 11
        expect(o.orderEucalyptus).toBe(32);   // 30 × 1.05 = 31.5 → 32
        expect(o.materialTotal).toBe(3 * 65); // 2 × 1.05 = 2.1 → 3
    });

    it('blank project: points and stakes 0, recipe kept; BOQ R32 keeps the Excel lump sum (not linked)', () => {
        const blank = layout.blank?.();
        expect(blank).toBeDefined();
        if (!blank) return;
        expect(blank).toEqual({ ...layout.defaults(), points: 0, stakes: 0 });
        const o = layout.compute(blank, ctx);
        expect(Object.values(o).every(Number.isFinite)).toBe(true);
        expect(o).toMatchObject({ points: 0, stakes: 0, orderBoards: 0, orderEucalyptus: 0, orderStakes: 0, total: 0 });
        const s4 = computeProject(createProject('blank'), [layout]).boq.sections.find(s => s.no === 4);
        expect(s4?.total).toBeCloseTo(golden.sections['4'].M, 2);   // 4,000 + 1,500 typed in Excel
    });

    it('ROUNDUP ignores float noise and keeps 0 at 0', () => {
        // 10 × 1.1 = 11.000000000000002 in JS → 11 (Excel shows 11)
        expect(layout.compute({ ...layout.defaults(), points: 10, waste: 0.1 }, ctx).orderBoards).toBe(11);
        const empty = layout.compute({ ...layout.defaults(), points: 0, stakes: 0 }, ctx);
        expect(empty.orderBoards).toBe(0);
        expect(Object.is(empty.orderStakes, 0)).toBe(true);
    });
});
