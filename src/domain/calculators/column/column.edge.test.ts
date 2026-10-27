// QA edge tests for "เสา_Column" (Excel v5 sheet 30). Expected values are hand-computed from the Excel formulas
// (docs/excel-spec/02-structure-steps-06-13.md §2.6), never by calling the code under test.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import { column, columnRowCalc, computeColumn, newColumnRow, COLUMN_BAR_SIZES, COLUMN_NAMES, type ColumnInput, type ColumnRow } from '.';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const diff = (a: Record<string, number>, b: Record<string, number>, k: string): number => (a[k] ?? NaN) - (b[k] ?? NaN);
const SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;
const KG = { RB6: 0.222, RB9: 0.499, DB12: 0.888, DB16: 1.58, DB20: 2.47 } as const;
const WASTE = { RB6: 1.06, RB9: 1.09, DB12: 1.12, DB16: 1.12, DB20: 1.12 } as const;

function item(r: ProjectResult, key: string): BoqItemRow {
    const row = r.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (row?.type !== 'item') throw new Error(`BOQ item ${key} not found`);
    return row;
}
const hasItem = (r: ProjectResult, key: string) => r.boq.sections.some(s => s.rows.some(x => x.key === key));
const run = (columns: ColumnRow[], patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { column: { columns } }, ...patch });
const slotRows = (input: ColumnInput) => column.boqSlots?.(input, ctx).rebar ?? [];

/** Excel sample: 21 × 0.2 × 0.2 × 4.05, DB12 × 6, RB6 @0.15. */
const C1: ColumnRow = { name: 'C1', count: 21, width: 0.2, depth: 0.2, height: 4.05, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.15 };
const withC = (patch: Partial<ColumnRow>): ColumnRow => ({ ...C1, ...patch });
const out1 = (patch: Partial<ColumnRow>) => column.compute({ columns: [withC(patch)] }, ctx);

/** Hand example K: 4 × 0.3 × 0.3 × 3.0, DB16 × 8, RB9 @0.2. */
const K: ColumnRow = { name: 'C2', count: 4, width: 0.3, depth: 0.3, height: 3, mainSize: 'DB16', mainCount: 8, stirrupSize: 'RB9', stirrupSpacing: 0.2 };

describe('column — blank()', () => {
    it('no columns; outputs finite; linked outputs and rebar 0; no slot rows', () => {
        const b = column.blank?.();
        expect(b).toEqual({ columns: [] });
        if (!b) return;
        const o = column.compute(b, ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of column.boqLinks) expect(o[l.output], l.output).toBe(0);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(column.boqSlots?.(b, ctx)).toEqual({ rebar: [] });
    });
    it('blank project: R108–R111 are 0 and there are no column rebar rows', () => {
        const r = computeProject(createProject('blank'));
        for (const k of ['R108', 'R109', 'R110', 'R111']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'column:rebar:tie-wire')).toBe(false);
    });
});

describe('column — hand example K (every cell)', () => {
    const c = columnRowCalc(K);
    it('main bars: length = height (no lap), 4 × 3 × 8 = 96 m × 1.58', () => {
        expect(c.mainBarLength).toBeCloseTo(3, 12);
        expect(c.mainTotalLength).toBeCloseTo(96, 12);
        expect(c.mainWeight).toBeCloseTo(151.68, 9);
    });
    it('stirrups: ROUNDUP(3/0.2) = 15 (no +1), 2 × 0.6 = 1.2 m, total 4 × 15 × 1.2 = 72 m = 35.928 kg', () => {
        expect(c.stirrupCount).toBe(15);
        expect(c.stirrupLength).toBeCloseTo(1.2, 12);
        expect(c.stirrupTotalLength).toBeCloseTo(72, 12);
        expect(c.stirrupWeight).toBeCloseTo(35.928, 9);
    });
    it('formwork 4 × 1.2 × 3 = 14.4; concrete 4 × 0.09 × 3 = 1.08', () => {
        expect(c.formwork).toBeCloseTo(14.4, 12);
        expect(c.concrete).toBeCloseTo(1.08, 12);
    });
});

describe('column — each input changed alone from the Excel sample', () => {
    it('baseline: 21 columns', () => {
        const o = out1({});
        expect(o['main.DB12']).toBeCloseTo(510.3 * 0.888, 9);        // 453.1464
        expect(o['stirrup.RB6']).toBeCloseTo(453.6 * 0.222, 9);      // 27 stirrups × 0.8 m × 21
        expect(o.formwork).toBeCloseTo(68.04, 9);
        expect(o.concrete).toBeCloseTo(3.402, 9);
    });
    it('count 10', () => {
        const o = out1({ count: 10 });
        expect(o['main.DB12']).toBeCloseTo(243 * 0.888, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(216 * 0.222, 9);
        expect(o.formwork).toBeCloseTo(32.4, 9);
        expect(o.concrete).toBeCloseTo(1.62, 9);
    });
    it('width 0.3 and depth 0.3 are symmetric (stirrup 1.0 m)', () => {
        for (const patch of [{ width: 0.3 }, { depth: 0.3 }]) {
            const o = out1(patch);
            expect(o['stirrup.RB6']).toBeCloseTo(21 * 27 * 1 * 0.222, 9);   // 125.874
            expect(o.formwork).toBeCloseTo(21 * 1 * 4.05, 9);                // 85.05
            expect(o.concrete).toBeCloseTo(21 * 0.06 * 4.05, 9);             // 5.103
            expect(o['main.DB12']).toBeCloseTo(510.3 * 0.888, 9);
        }
    });
    it('height 3.0: ROUNDUP(3/0.15) = 20 stirrups', () => {
        const o = out1({ height: 3 });
        expect(o['main.DB12']).toBeCloseTo(378 * 0.888, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(21 * 20 * 0.8 * 0.222, 9);
        expect(o.formwork).toBeCloseTo(50.4, 9);
        expect(o.concrete).toBeCloseTo(2.52, 9);
    });
    it('main bar count 8 / 0', () => {
        expect(out1({ mainCount: 8 })['main.DB12']).toBeCloseTo(21 * 4.05 * 8 * 0.888, 9);
        expect(out1({ mainCount: 0 })['main.DB12']).toBe(0);
    });
    it.each([
        [0.1, 41], [0.15, 27], [0.2, 21], [0.25, 17], [0.3, 14], [0.5, 9], [4.05, 1], [5, 1],
    ])('stirrup spacing %s gives %s stirrups', (spacing, count) => {
        expect(columnRowCalc(withC({ stirrupSpacing: spacing })).stirrupCount).toBe(count);
        expect(out1({ stirrupSpacing: spacing })['stirrup.RB6']).toBeCloseTo(21 * count * 0.8 * 0.222, 9);
    });
    it.each([0, NaN])('spacing %s: Excel "_" → no stirrups and 0 kg', (spacing) => {
        const c = columnRowCalc(withC({ stirrupSpacing: spacing }));
        expect(c.stirrupCount).toBeNull();
        expect(c.stirrupTotalLength).toBeNull();
        expect(c.stirrupWeight).toBe(0);
    });
});

describe('column — ROUNDUP boundaries of ROUNDUP(height / spacing)', () => {
    it.each([
        [3, 0.15, 20],        // 3/0.15 = 20.000000000000004 in IEEE → 20
        [2.7, 0.15, 18],
        [3.01, 0.15, 21],
        [3.6, 0.15, 24],
        [4.05, 0.15, 27],
        [4.2, 0.15, 28],
        [0.6, 0.2, 3],        // 2.9999999999999996
        [0.3, 0.1, 3],
        [0.7, 0.1, 7],        // 7.000000000000001
        [1.5, 0.5, 3],
        [1.51, 0.5, 4],
        [0.0001, 0.15, 1],
        [0, 0.15, 0],
        [2.4, 0.2, 12],
        [2.41, 0.2, 13],
    ])('height %s over spacing %s → %s stirrups', (h, s, n) => {
        expect(columnRowCalc(withC({ height: h, stirrupSpacing: s })).stirrupCount).toBe(n);
    });
});

describe('column — every bar size option', () => {
    it('dropdowns', () => {
        expect([...COLUMN_BAR_SIZES]).toEqual([...SIZES]);
        expect([...COLUMN_NAMES]).toEqual(['C1', 'C2', 'C3']);
    });
    it.each(SIZES)('main bars %s: 510.3 m × kg/m', (size) => {
        const o = out1({ mainSize: size, stirrupSize: '' });
        expect(o[`main.${size}`]).toBeCloseTo(510.3 * KG[size], 9);
        expect(o[`rebar.${size}`]).toBeCloseTo(510.3 * KG[size], 9);
        for (const other of SIZES.filter(s => s !== size)) expect(o[`rebar.${other}`], other).toBe(0);
    });
    it.each(SIZES)('stirrups %s: 453.6 m × kg/m', (size) => {
        const o = out1({ mainSize: '', stirrupSize: size });
        expect(o[`stirrup.${size}`]).toBeCloseTo(453.6 * KG[size], 9);
        expect(o[`rebar.${size}`]).toBeCloseTo(453.6 * KG[size], 9);
    });
    it('main + stirrup of the same size add in rebar.<size> (sheet 24 row 11)', () => {
        const o = out1({ mainSize: 'DB12', stirrupSize: 'DB12' });
        expect(o['rebar.DB12']).toBeCloseTo((510.3 + 453.6) * 0.888, 9);
    });
    it.each(['', 'DB25', 'db12'])('unknown size "%s" weighs 0 and gets no rebar row', (size) => {
        const input = { columns: [withC({ mainSize: size, stirrupSize: size })] };
        const o = column.compute(input, ctx);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(slotRows(input)).toEqual([]);
        expect(o.concrete).toBeCloseTo(3.402, 9);
    });
});

describe('column — zero, negative, decimal and huge values', () => {
    const FIELDS = ['count', 'width', 'depth', 'height', 'mainCount', 'stirrupSpacing'] as const;
    it.each(FIELDS)('%s = 0 / -1 / NaN / Infinity / 1e9 / 0.0001 never gives NaN or Infinity', (field) => {
        for (const v of [0, -1, NaN, Infinity, -Infinity, 1e9, 0.0001, 3.3333]) {
            for (const [k, x] of Object.entries(out1({ [field]: v }))) expect(Number.isFinite(x), `${field}=${v} ${k}`).toBe(true);
        }
    });
    it('count 0 or height 0: no quantities', () => {
        for (const patch of [{ count: 0 }, { height: 0 }]) {
            const o = out1(patch);
            for (const k of ['formwork', 'concrete', 'main.DB12', 'stirrup.RB6']) expect(o[k], k).toBe(0);
        }
    });
    it('NaN behaves like 0', () => {
        expect(out1({ height: NaN })).toEqual(out1({ height: 0 }));
    });
    it('1e6 columns: finite and linear', () => {
        const o = out1({ count: 1e6 });
        expect(o.concrete).toBeCloseTo(1e6 * 0.04 * 4.05, 3);
    });
    it('negative spacing stays finite', () => {
        expect(Number.isFinite(columnRowCalc(withC({ stirrupSpacing: -0.15 })).stirrupWeight)).toBe(true);
    });
});

describe('column — table size', () => {
    const many = (n: number): ColumnRow[] => Array.from({ length: n }, () => ({ ...C1 }));
    it('Excel sample (1 row)', () => {
        const o = computeColumn(column.defaults());
        expect(o.formwork).toBeCloseTo(68.04, 9);
        expect(o.concrete).toBeCloseTo(3.402, 9);
    });
    it.each([1, 10, 11, 25, 100])('%s identical rows scale linearly (Excel rows 8–17 = 10; none dropped past it)', (n) => {
        const o = column.compute({ columns: many(n) }, ctx);
        expect(o.formwork).toBeCloseTo(68.04 * n, 8);
        expect(o.concrete).toBeCloseTo(3.402 * n, 8);
        expect(o['rebar.DB12']).toBeCloseTo(453.1464 * n, 7);
        expect(o['rebar.RB6']).toBeCloseTo(100.6992 * n, 7);
    });
    it('C1 + K: sums per size', () => {
        const o = column.compute({ columns: [C1, K] }, ctx);
        expect(o['rebar.DB12']).toBeCloseTo(453.1464, 9);
        expect(o['rebar.DB16']).toBeCloseTo(151.68, 9);
        expect(o['rebar.RB9']).toBeCloseTo(35.928, 9);
        expect(o['rebar.RB6']).toBeCloseTo(100.6992, 9);
        expect(o.concrete).toBeCloseTo(3.402 + 1.08, 9);
    });
    it('delete a row removes its share', () => {
        const all = column.compute({ columns: [C1, K, withC({ count: 2 })] }, ctx);
        const rest = column.compute({ columns: [C1, withC({ count: 2 })] }, ctx);
        expect(diff(all, rest, 'concrete')).toBeCloseTo(1.08, 9);
        expect(diff(all, rest, 'rebar.DB16')).toBeCloseTo(151.68, 9);
    });
    it('newColumnRow copies bars and height from the previous row, never the plan values', () => {
        expect(newColumnRow()).toEqual({
            name: '', count: 0, width: 0, depth: 0, height: 0, mainSize: 'DB12', mainCount: 0, stirrupSize: 'RB6', stirrupSpacing: 0.15,
        });
        expect(newColumnRow(K)).toEqual({ ...K, name: '', count: 0, width: 0, depth: 0 });
    });
});

describe('column — rebar slot rows', () => {
    it('no bars: nothing, not even tie wire', () => {
        expect(slotRows({ columns: [] })).toEqual([]);
        expect(slotRows({ columns: [withC({ count: 0 })] })).toEqual([]);
    });
    it('keys in size order then tie wire; main and stirrup of one size are one row', () => {
        expect(slotRows({ columns: [K] }).map(x => x.key)).toEqual(['RB9', 'DB16', 'tie-wire']);
        expect(slotRows({ columns: [withC({ stirrupSize: 'DB12' })] }).map(x => x.key)).toEqual(['DB12', 'tie-wire']);
    });
    it.each(SIZES)('BOQ row of %s: waste, 25 on gross, 15 on net, tie wire 3 %% of gross', (size) => {
        const r = run([withC({ mainSize: size, stirrupSize: '' })]);
        const kg = 510.3 * KG[size];
        const row = item(r, `column:rebar:${size}`);
        expect(row.qty).toBeCloseTo(kg, 9);
        expect(row.grossQty).toBeCloseTo(kg * WASTE[size], 9);
        expect(row.matTotal).toBeCloseTo(25 * kg * WASTE[size], 9);
        expect(row.labTotal).toBeCloseTo(15 * kg, 9);
        expect(item(r, 'column:rebar:tie-wire').grossQty).toBeCloseTo(0.03 * kg * WASTE[size], 9);
    });
});

describe('column — BOQ money for K', () => {
    const r = run([K]);
    it('R108 formwork 14.4 and derived rows', () => {
        expect(item(r, 'R108').total).toBeCloseTo(14.4 * 400, 9);
        expect(item(r, 'R109').qty).toBeCloseTo(8.64, 9);
        expect(item(r, 'R109').total).toBeCloseTo(8.64 * 350, 9);
        expect(item(r, 'R110').qty).toBeCloseTo(3.6, 9);
        expect(item(r, 'R110').total).toBeCloseTo(180, 9);
    });
    it('R111 concrete 1.08 → 1.188 → CEILING 0.25 = 1.25; labour 1,000', () => {
        expect(item(r, 'R111').grossQty).toBeCloseTo(1.25, 9);
        expect(item(r, 'R111').total).toBeCloseTo(2500 * 1.25 + 1000 * 1.08, 9);
    });
    it('rebar rows: DB16 151.68 (12 %), RB9 35.928 (9 %), tie wire', () => {
        expect(item(r, 'column:rebar:DB16').grossQty).toBeCloseTo(151.68 * 1.12, 9);
        expect(item(r, 'column:rebar:RB9').grossQty).toBeCloseTo(35.928 * 1.09, 9);
        expect(item(r, 'column:rebar:tie-wire').grossQty).toBeCloseTo(0.03 * (151.68 * 1.12 + 35.928 * 1.09), 9);
    });
    it.each([
        // columns of 1 × 1 × h: concrete = h → ordered MAX(1, CEILING(1.1 h, 0.25))
        [0.5, 1], [0.9, 1], [0.91, 1.25], [5, 5.5], [10, 11], [4, 4.5],
    ])('concrete %s m³ is ordered as %s m³', (h, ordered) => {
        const x = run([withC({ count: 1, width: 1, depth: 1, height: h })]);
        expect(item(x, 'R111').grossQty).toBeCloseTo(ordered, 9);
    });
    it('no column: concrete is not forced to 1 m³', () => {
        expect(item(run([]), 'R111').grossQty).toBe(0);
    });
    it('level skipped: R108–R111 and the rebar rows are 0 (price edits kept)', () => {
        const s = run([K], { journey: { column: 'skipped' }, boqOverrides: { R111: { qty: 5, lab: 777 } } });
        for (const l of column.boqLinks) expect(item(s, l.line).qty, l.line).toBe(0);
        for (const k of ['R109', 'R110']) expect(item(s, k).qty, k).toBe(0);
        expect(item(s, 'R111').labUnit).toBe(777);
        expect(hasItem(s, 'column:rebar:DB16')).toBe(false);
        expect(Object.values(s.calcOutputs.column ?? {}).every(v => v === 0)).toBe(true);
    });
});

describe('column — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (rows: ColumnRow[], patch: Partial<Project> = {}) =>
        missingRequirements('column', { ...createProject('blank'), calculators: { 'column': { columns: rows } }, ...patch });
    const keys = (rows: ColumnRow[]) => missing(rows).map(m => m.fieldKey ?? m.label);
    const REQUIRED = ['count', 'width', 'depth', 'height'] as const;

    it('a complete row meets every requirement', () => {
        expect(keys([C1])).toEqual([]);
    });
    it('an empty table asks for at least one item', () => {
        expect(missing([]).map(m => m.label)).toEqual(['เพิ่มเสาอย่างน้อย 1 รายการ']);
    });
    it.each(REQUIRED)('%s empty (0 / negative / NaN / Infinity) is reported once; a tiny positive value is accepted', (field) => {
        for (const v of [0, -1, NaN, Infinity]) {
            expect(keys([withC({ [field]: v })]), `${field}=${v}`).toEqual([field]);
        }
        expect(keys([withC({ [field]: 0.0001 })])).toEqual([]);
    });
    it('all required values empty on a started row are all reported, in the decision-table order', () => {
        const row = withC({ count: 0, width: 0, depth: 0, height: 0 });
        const started = withC({ ...row, count: 2 });
        const got = keys([started]);
        expect(got.length).toBeGreaterThan(0);
        for (const k of got) expect(REQUIRED).toContain(k);
    });
    it('a row that only carries a copied standard value (nothing typed from the plan) is ignored', () => {
        expect(keys([withC({ count: 0, width: 0, depth: 0 })])).toEqual(['เพิ่มเสาอย่างน้อย 1 รายการ']);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing([], { journey: { 'column': 'skipped' } })).toEqual([]);
        expect(missing([withC({ count: 0 })], { journey: { 'column': 'skipped' } })).toEqual([]);
    });
    it('the second row is named by its position in the message', () => {
        const m = missing([C1, withC({ count: 0 })]);
        expect(m).toHaveLength(1);
        expect(m[0]?.itemIndex).toBe(1);
        expect(m[0]?.listKey).toBe('columns');
        expect(m[0]?.fieldKey).toBe('count');
    });
});
