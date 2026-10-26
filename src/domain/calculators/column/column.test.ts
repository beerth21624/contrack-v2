import { describe, expect, it } from 'vitest';
import { column, columnRowCalc, type ColumnRow } from '.';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const lines = golden.lines as Record<string, { E?: number; H?: number; M?: number }>;
const sections = golden.sections as Record<string, { M: number }>;

const project = (columns?: ColumnRow[]) => {
    const p = createProject();
    if (columns) p.calculators.column = { columns };
    return computeProject(p, [column]);
};
const items = (r: ReturnType<typeof project>, no: number) =>
    (r.boq.sections.find(s => s.no === no)?.rows ?? []).filter((x): x is BoqItemRow => x.type === 'item');
const item = (r: ReturnType<typeof project>, no: number, key: string) => items(r, no).find(x => x.key === key);

const C1 = (): ColumnRow => {
    const row = column.defaults().columns[0];
    if (!row) throw new Error('no sample row');
    return row;
};

describe('เสา_Column (sheet 30)', () => {
    it('Excel sample row 8: C1 × 21, 0.20 × 0.20, H = 0.55 + 3.5, 6-DB12, RB6 @0.15', () => {
        expect(column.defaults().columns).toHaveLength(1);
        expect(C1()).toMatchObject({
            name: 'C1', count: 21, width: 0.2, depth: 0.2, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.15,
        });
        expect(C1().height).toBeCloseTo(4.05, 12);
    });

    it('row 8 formulas reproduce Excel cached values', () => {
        const c = columnRowCalc(C1());
        expect(c.mainBarLength).toBeCloseTo(4.05, 9);        // J8
        expect(c.mainTotalLength).toBeCloseTo(510.3, 9);     // K8
        expect(c.mainWeight).toBeCloseTo(453.1464, 9);       // L8
        expect(c.stirrupCount).toBe(27);                     // O8
        expect(c.stirrupLength).toBeCloseTo(0.8, 9);         // P8
        expect(c.stirrupTotalLength).toBeCloseTo(453.6, 9);  // Q8
        expect(c.stirrupWeight).toBeCloseTo(100.6992, 9);    // R8
        expect(c.formwork).toBeCloseTo(68.04, 9);            // T8
        expect(c.concrete).toBeCloseTo(3.402, 9);            // V8
    });

    it('totals row 6: main J6 DB12 453.1464, stirrup M6 RB6 100.6992, T6 68.04, V6 3.402', () => {
        const o = column.compute(column.defaults(), ctx);
        expect(o['main.DB12']).toBeCloseTo(453.1464, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(100.6992, 9);
        for (const s of ['RB6', 'RB9', 'DB16', 'DB20']) expect(o[`main.${s}`]).toBe(0);
        for (const s of ['RB9', 'DB12', 'DB16', 'DB20']) expect(o[`stirrup.${s}`]).toBe(0);
        // Sheet 24 row 11 (I11..M11 = main + stirrup)
        expect(o['rebar.RB6']).toBeCloseTo(100.6992, 9);
        expect(o['rebar.RB9']).toBe(0);
        expect(o['rebar.DB12']).toBeCloseTo(453.1464, 9);
        expect(o['rebar.DB16']).toBe(0);
        expect(o['rebar.DB20']).toBe(0);
        expect(o.formwork).toBeCloseTo(68.04, 9);
        expect(o.concrete).toBeCloseTo(3.402, 9);
    });

    it('feeds BOQ section 11 (R108, R111) and the section total matches M112', () => {
        const r = project();
        for (const key of ['R108', 'R111']) {
            const row = item(r, 11, key);
            expect(row?.fromCalc.qty).toBe(true);
            expect(row?.qty).toBeCloseTo(lines[key]?.E ?? NaN, 9);
            expect(row?.grossQty).toBeCloseTo(lines[key]?.H ?? NaN, 9);
            expect(row?.total).toBeCloseTo(lines[key]?.M ?? NaN, 6);
        }
        expect(item(r, 11, 'R109')?.qty).toBeCloseTo(lines.R109?.E ?? NaN, 9);
        expect(item(r, 11, 'R110')?.qty).toBeCloseTo(lines.R110?.E ?? NaN, 9);
        expect(r.boq.sections.find(s => s.no === 11)?.total).toBeCloseTo(sections['11']?.M ?? NaN, 2);
    });

    it('feeds the rebar block 6.7 in section 6 (R51 RB6, R52 DB12, R53 tie wire) and section 6 matches M59', () => {
        const r = project();
        const rb6 = item(r, 6, 'column:rebar:RB6');
        const db12 = item(r, 6, 'column:rebar:DB12');
        const wire = item(r, 6, 'column:rebar:tie-wire');
        expect(item(r, 6, 'R51')).toBeUndefined();
        expect(rb6?.qty).toBeCloseTo(lines.R51?.E ?? NaN, 9);
        expect(rb6?.grossQty).toBeCloseTo(lines.R51?.H ?? NaN, 9);
        expect(rb6?.total).toBeCloseTo(lines.R51?.M ?? NaN, 6);
        expect(db12?.qty).toBeCloseTo(lines.R52?.E ?? NaN, 9);
        expect(db12?.grossQty).toBeCloseTo(lines.R52?.H ?? NaN, 9);
        expect(db12?.total).toBeCloseTo(lines.R52?.M ?? NaN, 6);
        expect(wire?.grossQty).toBeCloseTo(lines.R53?.H ?? NaN, 9);
        expect(wire?.total).toBeCloseTo(lines.R53?.M ?? NaN, 6);
        expect(r.boq.sections.find(s => s.no === 6)?.total).toBeCloseTo(sections['6']?.M ?? NaN, 2);
    });

    it('adding a C2 row (4 × 0.25 × 0.25, H 3.0, 4-DB16, RB9 @0.2) adds its quantities and a DB16 BOQ row', () => {
        const c2: ColumnRow = {
            name: 'C2', count: 4, width: 0.25, depth: 0.25, height: 3,
            mainSize: 'DB16', mainCount: 4, stirrupSize: 'RB9', stirrupSpacing: 0.2,
        };
        // main 4 × 3 × 4 = 48 m × 1.58 = 75.84 kg; stirrups ceil(3/0.2) = 15 × 1.0 m × 4 = 60 m × 0.499 = 29.94 kg
        // formwork 4 × 1.0 × 3 = 12 m²; concrete 4 × 0.0625 × 3 = 0.75 m³
        const c = columnRowCalc(c2);
        expect(c.stirrupCount).toBe(15);
        expect(c.mainWeight).toBeCloseTo(75.84, 9);
        expect(c.stirrupWeight).toBeCloseTo(29.94, 9);
        const input = { columns: [C1(), c2] };
        const o = column.compute(input, ctx);
        expect(o.formwork).toBeCloseTo(80.04, 9);
        expect(o.concrete).toBeCloseTo(4.152, 9);
        expect(o['rebar.DB16']).toBeCloseTo(75.84, 9);
        expect(o['rebar.RB9']).toBeCloseTo(29.94, 9);
        const r = project(input.columns);
        expect(items(r, 6).filter(x => x.key.startsWith('column:rebar:')).map(x => x.desc))
            .toEqual(['- เหล็ก RB6', '- เหล็ก RB9', '- เหล็ก DB12', '- เหล็ก DB16', '- ลวดผูกเหล็ก']);
        expect(item(r, 6, 'column:rebar:DB16')?.grossQty).toBeCloseTo(75.84 * 1.12, 9);   // D12: DB16 12 %
        expect(item(r, 11, 'R111')?.grossQty).toBe(4.75);   // MAX(1, CEILING(4.152 × 1.1, 0.25))
    });

    it('changing the height to 3.5 m: 24 stirrups, formwork 58.8 m², concrete 2.94 m³', () => {
        const c = columnRowCalc({ ...C1(), height: 3.5 });
        expect(c.stirrupCount).toBe(24);   // ROUNDUP(3.5/0.15) = 24
        expect(c.formwork).toBeCloseTo(58.8, 9);
        expect(c.concrete).toBeCloseTo(2.94, 9);
    });

    it('IFERROR edge cases: zero stirrup spacing → "_" (null) and 0 kg; blank size → 0 kg', () => {
        const c = columnRowCalc({ ...C1(), stirrupSpacing: 0 });
        expect(c.stirrupCount).toBeNull();
        expect(c.stirrupTotalLength).toBeNull();
        expect(c.stirrupWeight).toBe(0);
        expect(columnRowCalc({ ...C1(), mainSize: '' }).mainWeight).toBe(0);
    });
});
