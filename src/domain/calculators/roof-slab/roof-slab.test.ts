import { describe, expect, it } from 'vitest';
import { roofSlab, roofSlabRow, roofSlabTotals } from '.';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const g = golden.lines;

function section12(input?: unknown) {
    const project = createProject();
    if (input !== undefined) project.calculators['roof-slab'] = input;
    const sec = computeProject(project, [roofSlab]).boq.sections.find(s => s.no === 12);
    const row = (key: string) => sec?.rows.find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { sec, row };
}

describe('พื้นดาดฟ้า_RoofSlab (sheet 32)', () => {
    it('Excel sample rows 8–11: every computed cell', () => {
        const rows = roofSlab.defaults().rows.map(roofSlabRow);
        const cached = [
            { J: 90, K: 44.91, M: 8, N: 4.5, P: 0.45 },
            { J: 210, K: 104.79, M: 18, N: 10.5, P: 1.05 },
            { J: 90, K: 44.91, M: 8, N: 4.5, P: 0.45 },
            { J: 90, K: 44.91, M: 8, N: 4.5, P: 0.45 },
        ];
        expect(rows).toHaveLength(4);
        rows.forEach((r, i) => {
            const c = cached[i];
            expect(r.barLength).toBeCloseTo(c?.J ?? NaN, 9);
            expect(r.kg).toBeCloseTo(c?.K ?? NaN, 9);
            expect(r.props).toBe(c?.M);
            expect(r.formwork).toBeCloseTo(c?.N ?? NaN, 9);
            expect(r.concrete).toBeCloseTo(c?.P ?? NaN, 9);
        });
    });

    it('Excel sample row 6 totals: H6 RB9 239.52, M6 42, N6 24, P6 2.4', () => {
        const t = roofSlabTotals(roofSlab.defaults());
        expect(t.rebar.RB9).toBeCloseTo(239.52, 9);
        expect(t.rebar.RB6 + t.rebar.DB12 + t.rebar.DB16 + t.rebar.DB20).toBe(0);
        expect(t.props).toBe(42);
        expect(t.formwork).toBeCloseTo(24, 9);
        expect(t.concrete).toBeCloseTo(2.4, 9);
    });

    it('feeds BOQ section 12 (งานพื้นดาดฟ้า) exactly like Excel', () => {
        const { sec, row } = section12();
        expect(row('R129')?.qty).toBe(g.R129.E);
        expect(row('R131')?.qty).toBeCloseTo(g.R131.E, 9);
        expect(row('R134')?.qty).toBeCloseTo(g.R134.E, 9);
        expect(row('R134')?.grossQty).toBe(g.R134.H);     // MAX(1, CEILING(2.64, 0.25)) = 2.75 (template rule)
        const rb9 = row('roof-slab:rebar:RB9'), wire = row('roof-slab:rebar:tie-wire');
        expect(row('R127')).toBeUndefined();
        expect(rb9?.qty).toBeCloseTo(g.R127.E, 9);
        expect(rb9?.total).toBeCloseTo(g.R127.M, 6);
        expect(wire?.grossQty).toBeCloseTo(g.R128.H, 9);
        expect(wire?.total).toBeCloseTo(g.R128.M, 6);
        expect(sec?.total).toBeCloseTo(golden.sections['12'].M, 2);
    });

    it('standard outputs', () => {
        expect(roofSlab.compute(roofSlab.defaults(), ctx)).toEqual({
            props: 42, formwork: expect.closeTo(24, 9) as number, concrete: expect.closeTo(2.4, 9) as number,
            'rebar.RB6': 0, 'rebar.RB9': expect.closeTo(239.52, 9) as number, 'rebar.DB12': 0, 'rebar.DB16': 0, 'rebar.DB20': 0,
        });
    });

    it('every row counts (Excel M6/N6 stop at row 17) and a 1-layer DB12 panel adds its own BOQ rebar row', () => {
        const input = roofSlab.defaults();
        for (let i = 0; i < 6; i++) input.rows.push({ name: 'S2', width: 2, length: 3, thickness: 0.12, size: 'RB9', layers: 2, spacing: 0.2 });
        input.rows.push({ name: 'S2', width: 2, length: 3, thickness: 0.12, size: 'DB12', layers: 1, spacing: 0.25 });
        // 11 rows → the last one is Excel row 18, outside M6/N6 = SUM(M8:M17)
        // RB9 panel: area 6 → J = 6/0.2·2·2 = 120 m → 59.88 kg; props ROUNDUP(10) = 10; concrete 0.72
        // DB12 panel: J = 6/0.25·2·1 = 48 m → 42.624 kg
        const out = roofSlab.compute(input, ctx);
        expect(out.props).toBe(42 + 70);
        expect(out.formwork).toBeCloseTo(24 + 42, 9);
        expect(out.concrete).toBeCloseTo(2.4 + 7 * 0.72, 9);
        expect(out['rebar.RB9']).toBeCloseTo(239.52 + 6 * 59.88, 9);
        expect(out['rebar.DB12']).toBeCloseTo(42.624, 9);
        const { row } = section12(input);
        expect(row('roof-slab:rebar:DB12')?.waste).toBe(0.12);
        expect(row('R129')?.qty).toBe(112);
    });

    it('no spacing → ยาวรวม 0 (Excel IFERROR "0")', () => {
        const r = roofSlabRow({ name: 'S1', width: 2, length: 2, thickness: 0.1, size: 'RB9', layers: 2, spacing: 0 });
        expect(r.barLength).toBe(0);
        expect(r.kg).toBe(0);
        expect(r.props).toBe(7);   // ROUNDUP(4/0.6) = ROUNDUP(6.67)
    });

    it('links', () => {
        expect(roofSlab.boqLinks).toEqual([
            { line: 'R129', field: 'qty', output: 'props' },
            { line: 'R131', field: 'qty', output: 'formwork' },
            { line: 'R134', field: 'qty', output: 'concrete' },
        ]);
    });
});
