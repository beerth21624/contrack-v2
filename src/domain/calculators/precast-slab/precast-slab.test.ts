import { describe, expect, it } from 'vitest';
import { precastPanel, precastSlab, precastSlabTotals, type PrecastPanelRow } from '.';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const goldenSections = golden.sections as Record<string, { M: number }>;
const goldenLines = golden.lines as Record<string, { E?: number; H?: number; M: number }>;

const run = (input?: unknown) => {
    const project = createProject();
    if (input !== undefined) project.calculators['precast-slab'] = input;
    const res = computeProject(project, [precastSlab]);
    const rows = res.boq.sections.flatMap(s => s.rows);
    const row = (key: string) => rows.find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    const section = (no: number) => res.boq.sections.find(s => s.no === no);
    return { row, rows, section };
};

describe('พื้นสำเร็จรูป_PS (sheet 29)', () => {
    it('Excel sample inputs (rows 8–16)', () => {
        const d = precastSlab.defaults();
        expect(d.panels.map(p => [p.width, p.length])).toEqual([
            [2, 1.2], [3, 3], [3, 3], [3, 4], [3, 3], [3, 3.5], [3, 1.2], [2, 3.5], [3.5, 3.5],
        ]);
        for (const p of d.panels) {
            expect([p.keySize, p.keySpacing, p.keyBarLength, p.topping]).toEqual(['RB6', 0.35, 0.8, 0.05]);
        }
    });

    it('reproduces every cached row value (E, G, K, L, M, O, P, S of rows 8–16)', () => {
        // [E, K, L, M, O, P, S]
        const expected = [
            [2.4, 12, 9.6, 2.1312, 6.4, 0.32, 0.12],
            [9, 18, 14.4, 3.1968, 12, 0.6, 0.45],
            [9, 18, 14.4, 3.1968, 12, 0.6, 0.45],
            [12, 18, 14.4, 3.1968, 14, 0.7, 0.6],
            [9, 18, 14.4, 3.1968, 12, 0.6, 0.45],
            [10.5, 18, 14.4, 3.1968, 13, 0.65, 0.525],
            [3.6, 18, 14.4, 3.1968, 8.4, 0.42, 0.18],
            [7, 12, 9.6, 2.1312, 11, 0.55, 0.35],
            [12.25, 20, 16, 3.552, 14, 0.7, 0.6125],
        ];
        precastSlab.defaults().panels.forEach((p, i) => {
            const r = precastPanel(p);
            const [E, K, L, M, O, P, S] = expected[i] ?? [];
            const at = `row ${i + 8}`;
            expect(r.area, at).toBeCloseTo(E ?? NaN, 9);
            expect(r.wiremesh, at).toBeCloseTo(E ?? NaN, 9);
            expect(r.keyCount, at).toBe(K);
            expect(r.keyTotalLength, at).toBeCloseTo(L ?? NaN, 9);
            expect(r.keyWeight, at).toBeCloseTo(M ?? NaN, 9);
            expect(r.perimeter, at).toBeCloseTo(O ?? NaN, 9);
            expect(r.formwork, at).toBeCloseTo(P ?? NaN, 9);
            expect(r.concrete, at).toBeCloseTo(S ?? NaN, 9);
        });
    });

    it('an empty Excel row: K and L show "_" (null), M 0', () => {
        const r = precastPanel({ width: 0, length: 0, keySize: '', keySpacing: 0, keyBarLength: 0, topping: 0 });
        expect(r.keyCount).toBeNull();
        expect(r.keyTotalLength).toBeNull();
        expect(r.keyWeight).toBe(0);
        expect(r.area).toBe(0);
    });

    it('reproduces the totals row 6 (E6, G6, H6:L6, O6, R6)', () => {
        const t = precastSlabTotals(precastSlab.defaults());
        expect(t.area).toBeCloseTo(74.75, 9);
        expect(t.wiremesh).toBeCloseTo(74.75, 9);
        expect(t.shearKey.RB6).toBeCloseTo(26.9952, 9);
        expect([t.shearKey.RB9, t.shearKey.DB12, t.shearKey.DB16, t.shearKey.DB20]).toEqual([0, 0, 0, 0]);
        expect(t.formwork).toBeCloseTo(5.14, 9);
        expect(t.concrete).toBeCloseTo(3.7375, 9);
        const out = precastSlab.compute(precastSlab.defaults(), ctx);
        expect(out['rebar.RB6']).toBeCloseTo(26.9952, 9);
        expect(out.area).toBeCloseTo(74.75, 9);
    });

    it('feeds BOQ section 10 like Excel (R97–R104) and the section total', () => {
        const { row, section } = run();
        for (const key of ['R97', 'R98', 'R99', 'R101', 'R104']) {
            expect(row(key)?.qty, key).toBeCloseTo(goldenLines[key]?.E ?? NaN, 9);
            expect(row(key)?.grossQty, key).toBeCloseTo(goldenLines[key]?.H ?? NaN, 9);
            expect(row(key)?.total, key).toBeCloseTo(goldenLines[key]?.M ?? NaN, 6);
        }
        for (const key of ['R97', 'R99', 'R101', 'R104']) expect(row(key)?.fromCalc.qty, key).toBe(true);
        expect(section(10)?.total).toBeCloseTo(goldenSections['10']?.M ?? NaN, 2);
    });

    it('feeds the shear-key slot in section 8 (row 75): RB6 only, no tie wire; section 8 total unchanged', () => {
        const { row, rows, section } = run();
        const rb6 = row('precast-slab:shear-key:RB6');
        expect(rb6?.qty).toBeCloseTo(goldenLines.R75?.E ?? NaN, 9);
        expect(rb6?.grossQty).toBeCloseTo(goldenLines.R75?.H ?? NaN, 9);
        expect(rb6?.total).toBeCloseTo(goldenLines.R75?.M ?? NaN, 6);
        expect(rows.some(r => r.key === 'R75')).toBe(false);
        expect(rows.some(r => r.key === 'precast-slab:shear-key:tie-wire')).toBe(false);
        expect(section(8)?.rows.some(r => r.key === 'precast-slab:shear-key:RB6')).toBe(true);
        expect(section(8)?.total).toBeCloseTo(goldenSections['8']?.M ?? NaN, 2);
    });

    it('links area / wire mesh / formwork / concrete to BOQ R97 / R99 / R101 / R104 qty', () => {
        expect(precastSlab.boqLinks).toEqual([
            { line: 'R97', field: 'qty', output: 'area' },
            { line: 'R99', field: 'qty', output: 'wiremesh' },
            { line: 'R101', field: 'qty', output: 'formwork' },
            { line: 'R104', field: 'qty', output: 'concrete' },
        ]);
    });

    it('adding a 4 × 2 m panel and an RB9 shear key changes every total', () => {
        const extra: PrecastPanelRow = { width: 4, length: 2, keySize: 'RB9', keySpacing: 0.35, keyBarLength: 0.8, topping: 0.05 };
        // K = ROUNDUP(8/0.35) = 23 bars, L = 18.4 m, M = 18.4 × 0.499 = 9.1816 kg
        expect(precastPanel(extra).keyCount).toBe(23);
        expect(precastPanel(extra).keyWeight).toBeCloseTo(9.1816, 9);
        const panels = [...precastSlab.defaults().panels, extra];
        const out = precastSlab.compute({ panels }, ctx);
        expect(out.area).toBeCloseTo(74.75 + 8, 9);
        expect(out.wiremesh).toBeCloseTo(74.75 + 8, 9);
        expect(out.formwork).toBeCloseTo(5.14 + 12 * 0.05, 9);
        expect(out.concrete).toBeCloseTo(3.7375 + 0.4, 9);
        expect(out['rebar.RB6']).toBeCloseTo(26.9952, 9);
        expect(out['rebar.RB9']).toBeCloseTo(9.1816, 9);

        const { row, rows } = run({ panels });
        expect(rows.filter(r => r.key.startsWith('precast-slab:shear-key:')).map(r => r.key))
            .toEqual(['precast-slab:shear-key:RB6', 'precast-slab:shear-key:RB9']);
        expect(row('precast-slab:shear-key:RB9')?.grossQty).toBeCloseTo(9.1816 * 1.09, 9);
        // R98 ไม้ค้ำยัน = 0.1 × E97 (BOQ formula) follows the area
        expect(row('R98')?.qty).toBeCloseTo(8.275, 9);
        // concrete 4.1375 × 1.1 = 4.55125 → CEILING 0.25 = 4.75
        expect(row('R104')?.grossQty).toBeCloseTo(4.75, 9);
    });
});
