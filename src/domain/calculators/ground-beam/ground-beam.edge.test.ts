// QA edge tests for "คานคอดิน_Beam" (Excel v5 sheet 27). Expected values are hand-computed from the Excel formulas
// (docs/excel-spec/02-structure-steps-06-13.md §2.3), never by calling the code under test.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import {
    groundBeam, groundBeamRebar, groundBeamRow, groundBeamTotals, newGroundBeamRow, BEAM_BAR_SIZES, BEAM_NAMES,
    type GroundBeamInput, type GroundBeamRow,
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
const run = (beams: GroundBeamRow[], patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { 'ground-beam': { beams } }, ...patch });
const slotRows = (input: GroundBeamInput) => groundBeam.boqSlots?.(input, ctx).rebar ?? [];

const B1: GroundBeamRow = { name: 'B1', width: 0.2, depth: 0.5, length: 10, leanThickness: 0.05, mainSize: 'DB12', mainCount: 10, stirrupSize: 'RB6', stirrupSpacing: 0.15 };
const withB = (patch: Partial<GroundBeamRow>): GroundBeamRow => ({ ...B1, ...patch });
const out1 = (patch: Partial<GroundBeamRow>) => groundBeam.compute({ beams: [withB(patch)] }, ctx);

/** Hand example G: 0.2 × 0.4 × 10 m, DB12 × 6, RB6 @0.25. */
const G: GroundBeamRow = { name: 'B2', width: 0.2, depth: 0.4, length: 10, leanThickness: 0.05, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.25 };

describe('ground-beam — blank()', () => {
    it('no beams; all outputs finite; linked outputs and rebar are 0', () => {
        const b = groundBeam.blank?.();
        expect(b).toEqual({ beams: [] });
        if (!b) return;
        const o = groundBeam.compute(b, ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of groundBeam.boqLinks) expect(o[l.output], l.output).toBe(0);
        for (const s of SIZES) expect(o[`rebar.${s}`], s).toBe(0);
        expect(groundBeam.boqSlots?.(b, ctx)).toEqual({ rebar: [] });
    });
    it('blank project: R69, R77, R80 are 0 and there are no rebar rows', () => {
        const r = computeProject(createProject('blank'));
        for (const k of ['R69', 'R77', 'R78', 'R79', 'R80']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'ground-beam:rebar:tie-wire')).toBe(false);
    });
});

describe('ground-beam — hand example G (every cell)', () => {
    const c = groundBeamRow(G);
    it('lean, main bars', () => {
        expect(c.lean).toBeCloseTo(0.1, 12);          // 0.2 × 10 × 0.05
        expect(c.mainLength).toBeCloseTo(60, 12);     // 6 × 10, no lap
        expect(c.mainWeight).toBeCloseTo(53.28, 9);   // × 0.888
    });
    it('stirrups: ROUNDUP(10/0.25) = 40 (no +1), 2 × (0.2 + 0.4) = 1.2 m each', () => {
        expect(c.stirrupCount).toBe(40);
        expect(c.stirrupLength).toBeCloseTo(1.2, 12);
        expect(c.stirrupTotalLength).toBeCloseTo(48, 12);
        expect(c.stirrupWeight).toBeCloseTo(10.656, 9);
    });
    it('formwork = two sides only, concrete = C × D × E', () => {
        expect(c.formwork).toBeCloseTo(8, 12);        // 2 × 0.4 × 10
        expect(c.concrete).toBeCloseTo(0.8, 12);
    });
});

describe('ground-beam — each input changed alone from B1 (0.2 × 0.5 × 10, DB12 × 10, RB6 @0.15)', () => {
    it('baseline', () => {
        const o = out1({});
        expect(o.lean).toBeCloseTo(0.1, 9);
        expect(o['main.DB12']).toBeCloseTo(88.8, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(93.8 * 0.222, 9);   // 67 stirrups × 1.4 m
        expect(o.formwork).toBeCloseTo(10, 9);
        expect(o.concrete).toBeCloseTo(1, 9);
    });
    it('width 0.3: stirrup 1.6 m, lean 0.15, concrete 1.5, formwork unchanged', () => {
        const o = out1({ width: 0.3 });
        expect(o.lean).toBeCloseTo(0.15, 9);
        expect(o.concrete).toBeCloseTo(1.5, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(67 * 1.6 * 0.222, 9);   // 23.7984
        expect(o.formwork).toBeCloseTo(10, 9);
    });
    it('depth 0.6: stirrup 1.6 m, formwork 12, concrete 1.2, lean unchanged', () => {
        const o = out1({ depth: 0.6 });
        expect(o['stirrup.RB6']).toBeCloseTo(67 * 1.6 * 0.222, 9);
        expect(o.formwork).toBeCloseTo(12, 9);
        expect(o.concrete).toBeCloseTo(1.2, 9);
        expect(o.lean).toBeCloseTo(0.1, 9);
    });
    it('length 20: everything doubles except stirrups = ROUNDUP(133.33) = 134', () => {
        const o = out1({ length: 20 });
        expect(o.lean).toBeCloseTo(0.2, 9);
        expect(o['main.DB12']).toBeCloseTo(177.6, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(134 * 1.4 * 0.222, 9);   // 41.6472
        expect(o.formwork).toBeCloseTo(20, 9);
        expect(o.concrete).toBeCloseTo(2, 9);
    });
    it('lean thickness 0.1 doubles only the lean concrete', () => {
        const o = out1({ leanThickness: 0.1 });
        expect(o.lean).toBeCloseTo(0.2, 9);
        expect(o.concrete).toBeCloseTo(1, 9);
    });
    it('main bar count 5 / 0', () => {
        expect(out1({ mainCount: 5 })['main.DB12']).toBeCloseTo(44.4, 9);
        expect(out1({ mainCount: 0 })['main.DB12']).toBe(0);
    });
    it.each([
        [0.1, 100], [0.15, 67], [0.2, 50], [0.25, 40], [0.3, 34], [0.5, 20], [1, 10], [10, 1], [11, 1], [0.0123, 814],
    ])('stirrup spacing %s gives %s stirrups', (spacing, count) => {
        expect(groundBeamRow(withB({ stirrupSpacing: spacing })).stirrupCount).toBe(count);
        expect(out1({ stirrupSpacing: spacing })['stirrup.RB6']).toBeCloseTo(count * 1.4 * 0.222, 9);
    });
    it('spacing 0 / NaN: Excel "_" → no stirrups and 0 kg', () => {
        for (const s of [0, NaN]) {
            const c = groundBeamRow(withB({ stirrupSpacing: s }));
            expect(c.stirrupCount).toBeNull();
            expect(c.stirrupTotalLength).toBeNull();
            expect(c.stirrupWeight).toBe(0);
        }
    });
});

describe('ground-beam — ROUNDUP boundaries (length / spacing, no +1)', () => {
    it.each([
        [3, 0.15, 20],        // 3/0.15 = 20.000000000000004 in IEEE
        [0.9, 0.15, 6],       // 6.000000000000001
        [1.35, 0.15, 9],      // 9.000000000000002
        [10.5, 0.15, 70],
        [10.51, 0.15, 71],
        [10, 0.25, 40],
        [10.01, 0.25, 41],
        [0.15, 0.15, 1],
        [0.1, 0.15, 1],
        [0.0001, 0.15, 1],
        [0, 0.15, 0],
        [86, 0.15, 574],      // 573.33
        [3.2, 0.15, 22],      // 21.33
        [16, 0.15, 107],      // 106.67
        [0.6, 0.2, 3],        // 2.9999999999999996
        [2.1, 0.7, 3],        // 3.0000000000000004
    ])('length %s over spacing %s → %s stirrups', (len, sp, n) => {
        expect(groundBeamRow(withB({ length: len, stirrupSpacing: sp })).stirrupCount).toBe(n);
    });
});

describe('ground-beam — every bar size option', () => {
    it('the dropdown offers the five sizes', () => {
        expect([...BEAM_BAR_SIZES]).toEqual([...SIZES]);
        expect(BEAM_NAMES).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6']);
    });
    it.each(SIZES)('main bars %s: 100 m × kg/m', (size) => {
        const o = out1({ mainSize: size, stirrupSize: '' });
        expect(o[`main.${size}`]).toBeCloseTo(100 * KG[size], 9);
        expect(o[`rebar.${size}`]).toBeCloseTo(100 * KG[size], 9);
    });
    it.each(SIZES)('stirrups %s: 93.8 m × kg/m', (size) => {
        const o = out1({ mainSize: '', stirrupSize: size });
        expect(o[`stirrup.${size}`]).toBeCloseTo(93.8 * KG[size], 9);
        expect(o[`rebar.${size}`]).toBeCloseTo(93.8 * KG[size], 9);
    });
    it('main and stirrups of the same size add up in rebar.<size>', () => {
        const o = out1({ mainSize: 'RB6', stirrupSize: 'RB6' });
        expect(o['rebar.RB6']).toBeCloseTo(100 * 0.222 + 93.8 * 0.222, 9);
    });
    it.each(['', 'DB25', 'rb6', 'DB 12'])('unknown size "%s" weighs 0 and has no rebar row', (size) => {
        const beams = [withB({ mainSize: size, stirrupSize: size })];
        const o = groundBeam.compute({ beams }, ctx);
        for (const s of SIZES) expect(o[`rebar.${s}`], s).toBe(0);
        expect(slotRows({ beams })).toEqual([]);
        expect(groundBeamRow(beams[0] ?? B1).mainWeight).toBe(0);
    });
});

describe('ground-beam — zero, negative, decimal and huge values', () => {
    const FIELDS = ['width', 'depth', 'length', 'leanThickness', 'mainCount', 'stirrupSpacing'] as const;
    it.each(FIELDS)('%s = 0 / -1 / NaN / Infinity / 1e9 / 0.0001 never gives NaN or Infinity', (field) => {
        for (const v of [0, -1, NaN, Infinity, -Infinity, 1e9, 0.0001, 1.2345]) {
            for (const [k, x] of Object.entries(out1({ [field]: v }))) expect(Number.isFinite(x), `${field}=${v} ${k}`).toBe(true);
        }
    });
    it('length 0 gives no quantity at all', () => {
        const o = out1({ length: 0 });
        for (const k of ['lean', 'formwork', 'concrete', 'main.DB12', 'stirrup.RB6']) expect(o[k], k).toBe(0);
    });
    it('NaN length behaves like 0', () => {
        expect(out1({ length: NaN })).toEqual(out1({ length: 0 }));
    });
    it('width 0 still has stirrups (perimeter 2 × depth) and no concrete', () => {
        const o = out1({ width: 0 });
        expect(o.concrete).toBe(0);
        expect(o['stirrup.RB6']).toBeCloseTo(67 * 1.0 * 0.222, 9);
    });
    it('negative spacing stays finite (Excel would also count backwards)', () => {
        const c = groundBeamRow(withB({ stirrupSpacing: -0.15 }));
        expect(Number.isFinite(c.stirrupWeight)).toBe(true);
    });
    it('1e6 m of beam stays finite and linear', () => {
        const o = out1({ length: 1e6 });
        expect(o.concrete).toBeCloseTo(1e5, 3);
        expect(o.formwork).toBeCloseTo(1e6, 3);
    });
});

describe('ground-beam — table size (D1: every row counts, Excel ranges stop at row 17/18)', () => {
    const many = (n: number): GroundBeamRow[] => Array.from({ length: n }, () => ({ ...B1 }));
    it('1 row', () => {
        expect(groundBeamTotals({ beams: many(1) }).concrete).toBeCloseTo(1, 9);
    });
    it('default sample: 4 beams = Excel G6 / V6 / X6', () => {
        const t = groundBeamTotals(groundBeam.defaults());
        expect(t.lean).toBeCloseTo(1.152, 9);
        expect(t.formwork).toBeCloseTo(94.16, 9);
        expect(t.concrete).toBeCloseTo(9.416, 9);
    });
    it.each([10, 11, 14, 15, 30])('%s identical beams scale linearly (no row is dropped past Excel row 17/18/21)', (n) => {
        const o = groundBeam.compute({ beams: many(n) }, ctx);
        expect(o.lean).toBeCloseTo(0.1 * n, 9);
        expect(o.formwork).toBeCloseTo(10 * n, 9);
        expect(o.concrete).toBeCloseTo(1 * n, 9);
        expect(o['main.DB12']).toBeCloseTo(88.8 * n, 9);
        expect(o['stirrup.RB6']).toBeCloseTo(93.8 * 0.222 * n, 9);
    });
    it('deleting a beam removes exactly its share', () => {
        const beams = [B1, G, withB({ length: 5 })];
        const all = groundBeam.compute({ beams }, ctx);
        const rest = groundBeam.compute({ beams: [B1, withB({ length: 5 })] }, ctx);
        expect(diff(all, rest, 'concrete')).toBeCloseTo(0.8, 9);
        expect(diff(all, rest, 'formwork')).toBeCloseTo(8, 9);
        expect(diff(all, rest, 'stirrup.RB6')).toBeCloseTo(10.656, 9);
    });
    it('B1 + G: totals are the sum of both beams', () => {
        const o = groundBeam.compute({ beams: [B1, G] }, ctx);
        expect(o['main.DB12']).toBeCloseTo(88.8 + 53.28, 9);
        expect(o['rebar.RB6']).toBeCloseTo(93.8 * 0.222 + 10.656, 9);
        expect(o.lean).toBeCloseTo(0.2, 9);
    });
    it('groundBeamRebar = main + stirrup per size', () => {
        const r = groundBeamRebar({ beams: [B1, G] });
        expect(r.DB12).toBeCloseTo(142.08, 9);
        expect(r.RB6).toBeCloseTo(20.8236 + 10.656, 9);
        expect(r.RB9).toBe(0);
    });
});

describe('ground-beam — rebar slot rows and BOQ', () => {
    it('no bars: no rows (not even tie wire)', () => {
        expect(slotRows({ beams: [] })).toEqual([]);
        expect(slotRows({ beams: [withB({ mainCount: 0, stirrupSpacing: 0 })] })).toEqual([]);
    });
    it('row keys follow bar-size order then tie wire', () => {
        expect(slotRows({ beams: [G] }).map(x => x.key)).toEqual(['RB6', 'DB12', 'tie-wire']);
        const all: GroundBeamRow[] = SIZES.map(s => withB({ mainSize: s, stirrupSize: '' }));
        expect(slotRows({ beams: all }).map(x => x.key)).toEqual(['RB6', 'RB9', 'DB12', 'DB16', 'DB20', 'tie-wire']);
    });
    it.each(SIZES)('waste of %s in the BOQ and tie wire 3 %% of gross', (size) => {
        const r = run([withB({ mainSize: size, stirrupSize: '' })]);
        const kg = 100 * KG[size];
        const row = item(r, `ground-beam:rebar:${size}`);
        expect(row.qty).toBeCloseTo(kg, 9);
        expect(row.grossQty).toBeCloseTo(kg * WASTE[size], 9);
        expect(row.matTotal).toBeCloseTo(25 * kg * WASTE[size], 9);
        expect(row.labTotal).toBeCloseTo(15 * kg, 9);
        expect(item(r, 'ground-beam:rebar:tie-wire').grossQty).toBeCloseTo(kg * WASTE[size] * 0.03, 9);
    });
    describe('example G in the BOQ', () => {
        const r = run([G]);
        it('R69 lean 0.1: gross 0.11, 2,100 on gross + 1,000 on net', () => {
            expect(item(r, 'R69').grossQty).toBeCloseTo(0.11, 9);
            expect(item(r, 'R69').total).toBeCloseTo(231 + 100, 9);
        });
        it('R77 formwork 8 + ไม้คร่าว 4.8 + ตะปู 2', () => {
            expect(item(r, 'R77').total).toBeCloseTo(8 * 400, 9);
            expect(item(r, 'R78').total).toBeCloseTo(4.8 * 350, 9);
            expect(item(r, 'R79').total).toBeCloseTo(100, 9);
        });
        it('R80 concrete 0.8 → 0.88 → CEILING 0.25 = 1.0 → MAX(1, 1.0)', () => {
            expect(item(r, 'R80').grossQty).toBe(1);
            expect(item(r, 'R80').total).toBeCloseTo(2500 + 500 * 0.8, 9);
        });
        it('rebar rows DB12 53.28 kg and RB6 10.656 kg + tie wire', () => {
            expect(item(r, 'ground-beam:rebar:DB12').grossQty).toBeCloseTo(53.28 * 1.12, 9);
            expect(item(r, 'ground-beam:rebar:RB6').grossQty).toBeCloseTo(10.656 * 1.06, 9);
            expect(item(r, 'ground-beam:rebar:tie-wire').grossQty).toBeCloseTo(0.03 * (53.28 * 1.12 + 10.656 * 1.06), 9);
        });
    });
    it('R80 rounding boundaries: concrete 0.9 m³ → 1.0 (0.99), 0.91 → 1.25 (1.001)', () => {
        // 0.2 × 0.5 × L: L = 9 → 0.9; L = 9.1 → 0.91
        expect(item(run([withB({ length: 9 })]), 'R80').grossQty).toBeCloseTo(1, 9);
        expect(item(run([withB({ length: 9.1 })]), 'R80').grossQty).toBeCloseTo(1.25, 9);
        expect(item(run([withB({ length: 50 })]), 'R80').grossQty).toBeCloseTo(5.5, 9);   // 5 × 1.1 = 5.500000000000001
    });
    it('level skipped: BOQ lines and rebar rows 0, outputs 0', () => {
        const r = run([G], { journey: { 'ground-beam': 'skipped' }, boqOverrides: { R77: { qty: 77 } } });
        for (const l of groundBeam.boqLinks) expect(item(r, l.line).qty, l.line).toBe(0);
        for (const k of ['R78', 'R79']) expect(item(r, k).qty, k).toBe(0);
        expect(hasItem(r, 'ground-beam:rebar:DB12')).toBe(false);
        expect(Object.values(r.calcOutputs['ground-beam'] ?? {}).every(v => v === 0)).toBe(true);
    });
});

describe('ground-beam — newGroundBeamRow (journey helper)', () => {
    it('first beam: Excel standard bars and lean, plan values empty, name B1', () => {
        expect(newGroundBeamRow([])).toEqual({
            name: 'B1', width: 0, depth: 0, length: 0, leanThickness: 0.05, mainSize: 'DB12', mainCount: 0, stirrupSize: 'RB6', stirrupSpacing: 0.15,
        });
    });
    it('later beams copy the previous section, empty length, next free name', () => {
        const b = newGroundBeamRow([B1]);
        expect(b).toEqual({ ...B1, name: 'B2', length: 0 });
        expect(newGroundBeamRow([B1, G]).name).toBe('B3');
        const six = BEAM_NAMES.map(n => withB({ name: n }));
        expect(newGroundBeamRow(six).name).toBe('');
    });
    it('a new beam adds nothing until the length is typed', () => {
        const o = groundBeam.compute({ beams: [newGroundBeamRow([B1])] }, ctx);
        expect(o.concrete).toBe(0);
        expect(o.formwork).toBe(0);
    });
});

describe('ground-beam — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (rows: GroundBeamRow[], patch: Partial<Project> = {}) =>
        missingRequirements('ground-beam', { ...createProject('blank'), calculators: { 'ground-beam': { beams: rows } }, ...patch });
    const keys = (rows: GroundBeamRow[]) => missing(rows).map(m => m.fieldKey ?? m.label);
    const REQUIRED = ['width', 'depth', 'length'] as const;

    it('a complete row meets every requirement', () => {
        expect(keys([B1])).toEqual([]);
    });
    it('an empty table asks for at least one item', () => {
        expect(missing([]).map(m => m.label)).toEqual(['เพิ่มคานคอดินอย่างน้อย 1 รายการ']);
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
        expect(keys([withB({ width: 0, depth: 0, length: 0, mainCount: 0 })])).toEqual(['เพิ่มคานคอดินอย่างน้อย 1 รายการ']);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing([], { journey: { 'ground-beam': 'skipped' } })).toEqual([]);
        expect(missing([withB({ width: 0 })], { journey: { 'ground-beam': 'skipped' } })).toEqual([]);
    });
    it('the second row is named by its position in the message', () => {
        const m = missing([B1, withB({ width: 0 })]);
        expect(m).toHaveLength(1);
        expect(m[0]?.itemIndex).toBe(1);
        expect(m[0]?.listKey).toBe('beams');
        expect(m[0]?.fieldKey).toBe('width');
    });
});
