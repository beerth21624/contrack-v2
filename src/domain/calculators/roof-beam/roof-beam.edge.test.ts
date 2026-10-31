// QA edge tests for "คานดาดฟ้า_RoofBeam" (Excel v5 sheet 31). Expected values are hand-computed from the Excel
// formulas (docs/excel-spec/02-structure-steps-06-13.md §2.7) and the D1 fixes listed in the source header.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import {
    newRoofBeamRow, roofBeam, roofBeamRow, roofBeamTotals, ROOF_BEAM_BAR_SIZES, ROOF_BEAM_NAMES, type RoofBeamInput, type RoofBeamRow,
} from '.';
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
const run = (rows: RoofBeamRow[], patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { 'roof-beam': { rows } }, ...patch });
const slotRows = (input: RoofBeamInput) => roofBeam.boqSlots?.(input, ctx).rebar ?? [];

/** Excel row 8: B5 0.2 × 0.3 × 25 m, DB12 × 6, RB6 @0.15. */
const B5: RoofBeamRow = { name: 'B5', width: 0.2, depth: 0.3, length: 25, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.15 };
const withB = (patch: Partial<RoofBeamRow>): RoofBeamRow => ({ ...B5, ...patch });
const out1 = (patch: Partial<RoofBeamRow>) => roofBeam.compute({ rows: [withB(patch)] }, ctx);

/** Hand example R: 0.2 × 0.3 × 6 m, DB12 × 4, RB6 @0.2. */
const R: RoofBeamRow = { name: 'B1', width: 0.2, depth: 0.3, length: 6, mainSize: 'DB12', mainCount: 4, stirrupSize: 'RB6', stirrupSpacing: 0.2 };

describe('roof-beam — blank()', () => {
    it('no beams; outputs finite; linked outputs and rebar 0; no slot rows', () => {
        const b = roofBeam.blank?.();
        expect(b).toEqual({ rows: [] });
        if (!b) return;
        const o = roofBeam.compute(b, ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of roofBeam.boqLinks) expect(o[l.output], l.output).toBe(0);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(roofBeam.boqSlots?.(b, ctx)).toEqual({ rebar: [] });
    });
    it('blank project: R119–R124 are 0', () => {
        const r = computeProject(createProject('blank'));
        for (const k of ['R119', 'R121', 'R122', 'R123', 'R124']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'roof-beam:rebar:tie-wire')).toBe(false);
    });
});

describe('roof-beam — hand example R (every cell)', () => {
    const c = roofBeamRow(R);
    it('main bars 4 × 6 = 24 m × 0.888 = 21.312', () => {
        expect(c.mainLength).toBeCloseTo(24, 12);
        expect(c.mainKg).toBeCloseTo(21.312, 9);
    });
    it('stirrups ROUNDUP(6/0.2) = 30 (no +1) × 2 × (0.2 + 0.3) = 1.0 m = 30 m = 6.66 kg', () => {
        expect(c.stirrupCount).toBe(30);
        expect(c.stirrupPerimeter).toBeCloseTo(1, 12);
        expect(c.stirrupLength).toBeCloseTo(30, 12);
        expect(c.stirrupKg).toBeCloseTo(6.66, 9);
    });
    it('props ROUNDUP(6/0.6) = 10', () => {
        expect(c.props).toBe(10);
    });
    it('formwork (D1 fix) = 2·D·E + C·E = 3.6 + 1.2 = 4.8; Excel\'s own 2·D·E + C = 3.8 is still reported', () => {
        expect(c.formwork).toBeCloseTo(4.8, 12);
        expect(c.formworkExcel).toBeCloseTo(3.8, 12);
    });
    it('concrete 0.2 × 0.3 × 6 = 0.36', () => {
        expect(c.concrete).toBeCloseTo(0.36, 12);
    });
});

describe('roof-beam — each input changed alone from Excel row 8 (B5 0.2 × 0.3 × 25)', () => {
    it('baseline', () => {
        const o = out1({});
        expect(o['main.DB12']).toBeCloseTo(150 * 0.888, 9);        // 133.2
        expect(o['stirrup.RB6']).toBeCloseTo(167 * 1 * 0.222, 9);  // ROUNDUP(166.67) = 167
        expect(o.props).toBe(42);
        expect(o.formwork).toBeCloseTo(20, 9);
        expect(o.formworkExcel).toBeCloseTo(15.2, 9);
        expect(o.concrete).toBeCloseTo(1.5, 9);
    });
    it('width 0.3: stirrup 1.2 m, formwork 15 + 7.5, concrete 2.25', () => {
        const o = out1({ width: 0.3 });
        expect(o['stirrup.RB6']).toBeCloseTo(167 * 1.2 * 0.222, 9);   // 44.4888
        expect(o.formwork).toBeCloseTo(22.5, 9);
        expect(o.formworkExcel).toBeCloseTo(15.3, 9);
        expect(o.concrete).toBeCloseTo(2.25, 9);
        expect(o.props).toBe(42);
    });
    it('depth 0.4: stirrup 1.2 m, formwork 20 + 5 = 25, concrete 2', () => {
        const o = out1({ depth: 0.4 });
        expect(o['stirrup.RB6']).toBeCloseTo(167 * 1.2 * 0.222, 9);
        expect(o.formwork).toBeCloseTo(25, 9);
        expect(o.formworkExcel).toBeCloseTo(20.2, 9);
        expect(o.concrete).toBeCloseTo(2, 9);
    });
    it('length 30: 200 stirrups, 50 props', () => {
        const o = out1({ length: 30 });
        expect(o['main.DB12']).toBeCloseTo(180 * 0.888, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(200 * 1 * 0.222, 9);
        expect(o.props).toBe(50);
        expect(o.formwork).toBeCloseTo(24, 9);
        expect(o.concrete).toBeCloseTo(1.8, 9);
    });
    it('main bar count 4 / 0', () => {
        expect(out1({ mainCount: 4 })['main.DB12']).toBeCloseTo(100 * 0.888, 9);
        expect(out1({ mainCount: 0 })['main.DB12']).toBe(0);
    });
    it.each([[0.1, 250], [0.15, 167], [0.2, 125], [0.25, 100], [0.3, 84], [0.5, 50], [25, 1], [30, 1]])('stirrup spacing %s gives %s stirrups', (spacing, count) => {
        expect(roofBeamRow(withB({ stirrupSpacing: spacing })).stirrupCount).toBe(count);
        expect(out1({ stirrupSpacing: spacing })['stirrup.RB6']).toBeCloseTo(count * 0.222, 9);
    });
    it.each([0, -0.15, NaN])('spacing %s: no stirrups (Excel "_"), 0 kg', (spacing) => {
        const c = roofBeamRow(withB({ stirrupSpacing: spacing }));
        expect(c.stirrupCount).toBeNull();
        expect(c.stirrupLength).toBeNull();
        expect(c.stirrupKg).toBe(0);
    });
});

describe('roof-beam — ROUNDUP boundaries', () => {
    it.each([
        // length, stirrup spacing, expected stirrups
        [25, 0.15, 167], [30, 0.15, 200], [0.9, 0.15, 6], [1.35, 0.15, 9], [6, 0.2, 30], [0.6, 0.2, 3], [2.1, 0.7, 3],
        [10.5, 0.15, 70], [10.51, 0.15, 71], [0.0001, 0.15, 1], [0, 0.15, 0],
    ])('length %s over spacing %s → %s stirrups', (len, sp, n) => {
        expect(roofBeamRow(withB({ length: len, stirrupSpacing: sp })).stirrupCount).toBe(n);
    });
    it.each([
        // length, props = ROUNDUP(length / 0.6)
        [0.6, 1], [1.2, 2], [1.8, 3], [3, 5], [0.61, 2], [0, 0], [0.0001, 1], [6, 10], [24, 40], [24.01, 41], [25, 42], [3.6, 6], [4.2, 7], [0.3, 1],
    ])('length %s needs %s props (÷ 0.6)', (len, props) => {
        expect(roofBeamRow(withB({ length: len })).props).toBe(props);
    });
    it('props are rounded per beam, then added: two 0.7 m beams need 2 + 2 = 4, not ROUNDUP(1.4/0.6) = 3', () => {
        expect(roofBeam.compute({ rows: [withB({ length: 0.7 }), withB({ length: 0.7 })] }, ctx).props).toBe(4);
    });
});

describe('roof-beam — every bar size option', () => {
    it('dropdowns', () => {
        expect([...ROOF_BEAM_BAR_SIZES]).toEqual([...SIZES]);
        expect([...ROOF_BEAM_NAMES]).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6']);
    });
    it.each(SIZES)('main bars %s: 150 m × kg/m', (size) => {
        const o = out1({ mainSize: size, stirrupSize: '' });
        expect(o[`main.${size}`]).toBeCloseTo(150 * KG[size], 9);
        expect(o[`rebar.${size}`]).toBeCloseTo(150 * KG[size], 9);
    });
    it.each(SIZES)('stirrups %s: 167 m × kg/m', (size) => {
        const o = out1({ mainSize: '', stirrupSize: size });
        expect(o[`stirrup.${size}`]).toBeCloseTo(167 * KG[size], 9);
        expect(o[`rebar.${size}`]).toBeCloseTo(167 * KG[size], 9);
    });
    it('same size in main and stirrup is added in rebar.<size>', () => {
        expect(out1({ stirrupSize: 'DB12' })['rebar.DB12']).toBeCloseTo((150 + 167) * 0.888, 9);
    });
    it.each(['', 'DB25', 'rb6'])('unknown size "%s": 0 kg, no slot row, concrete kept', (size) => {
        const input = { rows: [withB({ mainSize: size, stirrupSize: size })] };
        const o = roofBeam.compute(input, ctx);
        for (const s of SIZES) expect(o[`rebar.${s}`]).toBe(0);
        expect(slotRows(input)).toEqual([]);
        expect(o.concrete).toBeCloseTo(1.5, 9);
    });
});

describe('roof-beam — zero, negative, decimal and huge values', () => {
    const FIELDS = ['width', 'depth', 'length', 'mainCount', 'stirrupSpacing'] as const;
    it.each(FIELDS)('%s = 0 / -1 / NaN / Infinity / 1e9 / 0.0001 never gives NaN or Infinity', (field) => {
        for (const v of [0, -1, NaN, Infinity, -Infinity, 1e9, 0.0001, 1.2345]) {
            for (const [k, x] of Object.entries(out1({ [field]: v }))) expect(Number.isFinite(x), `${field}=${v} ${k}`).toBe(true);
        }
    });
    it('length 0 gives no quantity', () => {
        const o = out1({ length: 0 });
        for (const k of ['props', 'formwork', 'concrete', 'main.DB12', 'stirrup.RB6']) expect(o[k], k).toBe(0);
    });
    it('NaN behaves like 0', () => {
        expect(out1({ length: NaN })).toEqual(out1({ length: 0 }));
    });
    it('1e6 m: finite and linear', () => {
        const o = out1({ length: 1e6 });
        expect(o.concrete).toBeCloseTo(6e4, 3);
        expect(o.props).toBe(1666667);   // ROUNDUP(1e6 / 0.6) = ROUNDUP(1666666.67)
    });
});

describe('roof-beam — table size (D1: every row counts, Excel S6/T6/V6 stop at row 17)', () => {
    const many = (n: number): RoofBeamRow[] => Array.from({ length: n }, () => ({ ...B5 }));
    it('Excel sample (2 beams 25 m + 9 m): props 57, formwork 20.8 (D1) vs Excel 15.4 + …, concrete 2.04', () => {
        const t = roofBeamTotals(roofBeam.defaults());
        expect(t.props).toBe(42 + 15);           // ROUNDUP(25/0.6) + ROUNDUP(9/0.6)
        expect(t.formwork).toBeCloseTo(20 + (2 * 0.3 * 9 + 0.2 * 9), 9);   // 20 + 7.2 = 27.2
        expect(t.formworkExcel).toBeCloseTo((15 + 0.2) + (5.4 + 0.2), 9);  // 20.8 — Excel's cached value
        expect(t.concrete).toBeCloseTo(2.04, 9);
    });
    it.each([1, 14, 15, 30])('%s identical beams scale linearly (Excel rows 8–21 = 14; none dropped)', (n) => {
        const o = roofBeam.compute({ rows: many(n) }, ctx);
        expect(o.props).toBe(42 * n);
        expect(o.formwork).toBeCloseTo(20 * n, 9);
        expect(o.concrete).toBeCloseTo(1.5 * n, 9);
        expect(o['rebar.DB12']).toBeCloseTo(133.2 * n, 9);
        expect(o['rebar.RB6']).toBeCloseTo(167 * 0.222 * n, 9);
    });
    it('beam R + B5: sums', () => {
        const o = roofBeam.compute({ rows: [B5, R] }, ctx);
        expect(o['main.DB12']).toBeCloseTo(133.2 + 21.312, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(37.074 + 6.66, 9);
        expect(o.props).toBe(52);
        expect(o.formwork).toBeCloseTo(24.8, 9);
        expect(o.concrete).toBeCloseTo(1.86, 9);
    });
    it('delete a beam removes its share', () => {
        const all = roofBeam.compute({ rows: [B5, R, withB({ length: 5 })] }, ctx);
        const rest = roofBeam.compute({ rows: [B5, withB({ length: 5 })] }, ctx);
        expect(diff(all, rest, 'props')).toBe(10);
        expect(diff(all, rest, 'concrete')).toBeCloseTo(0.36, 9);
    });
    it('newRoofBeamRow copies section and bars, never the length', () => {
        expect(newRoofBeamRow()).toEqual({ name: '', width: 0, depth: 0, length: 0, mainSize: 'DB12', mainCount: 0, stirrupSize: 'RB6', stirrupSpacing: 0.15 });
        expect(newRoofBeamRow(R)).toEqual({ ...R, name: '', length: 0 });
        expect(roofBeam.compute({ rows: [newRoofBeamRow(R)] }, ctx).concrete).toBe(0);
    });
});

describe('roof-beam — rebar slot rows (waste per size: RB6 6 %, DB12 12 % — Excel\'s swap fixed, D1)', () => {
    it('no bars: nothing; otherwise size order then tie wire', () => {
        expect(slotRows({ rows: [] })).toEqual([]);
        expect(slotRows({ rows: [withB({ mainCount: 0, stirrupSpacing: 0 })] })).toEqual([]);
        expect(slotRows({ rows: [B5] }).map(x => x.key)).toEqual(['RB6', 'DB12', 'tie-wire']);
    });
    it.each(SIZES)('BOQ row of %s: waste, 25 on gross, 15 on net, tie wire 3 %%', (size) => {
        const r = run([withB({ mainSize: size, stirrupSize: '' })]);
        const kg = 150 * KG[size];
        const row = item(r, `roof-beam:rebar:${size}`);
        expect(row.qty).toBeCloseTo(kg, 9);
        expect(row.grossQty).toBeCloseTo(kg * WASTE[size], 9);
        expect(row.matTotal).toBeCloseTo(25 * kg * WASTE[size], 9);
        expect(row.labTotal).toBeCloseTo(15 * kg, 9);
        expect(item(r, 'roof-beam:rebar:tie-wire').grossQty).toBeCloseTo(0.03 * kg * WASTE[size], 9);
    });
    it('RB6 stirrups are 6 % and DB12 main 12 % (not swapped)', () => {
        const r = run([R]);
        expect(item(r, 'roof-beam:rebar:RB6').grossQty).toBeCloseTo(6.66 * 1.06, 9);
        expect(item(r, 'roof-beam:rebar:DB12').grossQty).toBeCloseTo(21.312 * 1.12, 9);
    });
});

describe('roof-beam — BOQ money for R', () => {
    const r = run([R]);
    it('R119 props 10 ต้น × (150 + 50)', () => {
        expect(item(r, 'R119').total).toBeCloseTo(2000, 9);
    });
    it('R121 formwork 4.8 + R122 ไม้คร่าว 2.88 + R123 ตะปู 1.2', () => {
        expect(item(r, 'R121').total).toBeCloseTo(4.8 * 400, 9);
        expect(item(r, 'R122').qty).toBeCloseTo(2.88, 9);
        expect(item(r, 'R122').total).toBeCloseTo(2.88 * 350, 9);
        expect(item(r, 'R123').total).toBeCloseTo(60, 9);
    });
    it('R124 concrete is plain E × 1.1 (Excel exception: no CEILING, no MAX(1,…))', () => {
        expect(item(r, 'R124').grossQty).toBeCloseTo(0.396, 9);
        expect(item(r, 'R124').total).toBeCloseTo(2500 * 0.396 + 500 * 0.36, 9);
    });
    it('level skipped: every line and the rebar rows are 0', () => {
        const s = run([R], { journey: { 'roof-beam': 'skipped' }, boqOverrides: { R124: { qty: 4 } } });
        for (const l of roofBeam.boqLinks) expect(item(s, l.line).qty, l.line).toBe(0);
        for (const k of ['R122', 'R123']) expect(item(s, k).qty, k).toBe(0);
        expect(hasItem(s, 'roof-beam:rebar:DB12')).toBe(false);
        expect(Object.values(s.calcOutputs['roof-beam'] ?? {}).every(v => v === 0)).toBe(true);
    });
});

describe('roof-beam — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (rows: RoofBeamRow[], patch: Partial<Project> = {}) =>
        missingRequirements('roof-beam', { ...createProject('blank'), calculators: { 'roof-beam': { rows: rows } }, ...patch });
    const keys = (rows: RoofBeamRow[]) => missing(rows).map(m => m.fieldKey ?? m.label);
    const REQUIRED = ['width', 'depth', 'length'] as const;

    it('a complete row meets every requirement', () => {
        expect(keys([B5])).toEqual([]);
    });
    it('an empty table asks for at least one item', () => {
        expect(missing([]).map(m => m.label)).toEqual(['เพิ่มคานดาดฟ้า / คานหลังคาอย่างน้อย 1 รายการ']);
    });
    it.each(REQUIRED)('%s empty (0 / negative / NaN / Infinity) is reported once; a tiny positive value is accepted', (field) => {
        for (const v of [0, -1, NaN, Infinity]) {
            expect(keys([withB({ [field]: v })]), `${field}=${v}`).toEqual([field]);
        }
        expect(keys([withB({ [field]: 0.0001 })])).toEqual([]);
    });
    it('all required values empty on a started row are all reported, in the decision-table order', () => {
        const row = withB({ width: 0, depth: 0, length: 0 });
        const started = withB({ ...row, mainCount: 4 });
        const got = keys([started]);
        expect(got.length).toBeGreaterThan(0);
        for (const k of got) expect(REQUIRED).toContain(k);
    });
    it('a row that only carries a copied standard value (nothing typed from the plan) is ignored', () => {
        expect(keys([withB({ width: 0, depth: 0, length: 0, mainCount: 0 })])).toEqual(['เพิ่มคานดาดฟ้า / คานหลังคาอย่างน้อย 1 รายการ']);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing([], { journey: { 'roof-beam': 'skipped' } })).toEqual([]);
        expect(missing([withB({ width: 0 })], { journey: { 'roof-beam': 'skipped' } })).toEqual([]);
    });
    it('the second row is named by its position in the message', () => {
        const m = missing([B5, withB({ width: 0 })]);
        expect(m).toHaveLength(1);
        expect(m[0]?.itemIndex).toBe(1);
        expect(m[0]?.listKey).toBe('rows');
        expect(m[0]?.fieldKey).toBe('width');
    });
});
