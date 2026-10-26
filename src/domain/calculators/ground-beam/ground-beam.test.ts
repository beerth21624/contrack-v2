import { describe, expect, it } from 'vitest';
import { groundBeam, groundBeamRow, groundBeamTotals, type GroundBeamRow } from '.';
import { precastSlab } from '../precast-slab';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const goldenSections = golden.sections as Record<string, { M: number }>;
const goldenLines = golden.lines as Record<string, { E?: number; H?: number; M: number }>;

const run = (input?: unknown) => {
    const project = createProject();
    if (input !== undefined) project.calculators['ground-beam'] = input;
    const res = computeProject(project, [groundBeam]);
    const section = res.boq.sections.find(s => s.no === 8);
    const row = (key: string) => section?.rows.find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { section, row };
};

const emptyRow: GroundBeamRow = {
    name: '', width: 0, depth: 0, length: 0, leanThickness: 0, mainSize: '', mainCount: 0, stirrupSize: '', stirrupSpacing: 0,
};

describe('คานคอดิน_Beam (sheet 27)', () => {
    it('Excel sample inputs (rows 8–11; E11 typed =14+2)', () => {
        const d = groundBeam.defaults();
        expect(d.beams.map(b => b.name)).toEqual(['B1', 'B2', 'B3', 'B4']);
        expect(d.beams.map(b => [b.width, b.depth, b.length, b.leanThickness])).toEqual([
            [0.2, 0.5, 10, 0.05], [0.2, 0.4, 86, 0.05], [0.2, 0.4, 3.2, 0.05], [0.2, 0.4, 16, 0.05],
        ]);
        expect(d.beams.map(b => [b.mainSize, b.mainCount, b.stirrupSize, b.stirrupSpacing])).toEqual([
            ['DB12', 10, 'RB6', 0.15], ['DB12', 6, 'RB6', 0.15], ['DB12', 7, 'RB6', 0.15], ['DB12', 10, 'RB6', 0.15],
        ]);
    });

    it('reproduces every cached row value (H, L, M, Q, R, S, T, V, X of rows 8–11)', () => {
        const expected = [
            { lean: 0.1, mainLength: 100, mainWeight: 88.8, stirrupCount: 67, stirrupLength: 1.4, stirrupTotalLength: 93.8, stirrupWeight: 20.8236, formwork: 10, concrete: 1 },
            { lean: 0.86, mainLength: 516, mainWeight: 458.208, stirrupCount: 574, stirrupLength: 1.2, stirrupTotalLength: 688.8, stirrupWeight: 152.9136, formwork: 68.8, concrete: 6.88 },
            { lean: 0.032, mainLength: 22.4, mainWeight: 19.8912, stirrupCount: 22, stirrupLength: 1.2, stirrupTotalLength: 26.4, stirrupWeight: 5.8608, formwork: 2.56, concrete: 0.256 },
            { lean: 0.16, mainLength: 160, mainWeight: 142.08, stirrupCount: 107, stirrupLength: 1.2, stirrupTotalLength: 128.4, stirrupWeight: 28.5048, formwork: 12.8, concrete: 1.28 },
        ];
        groundBeam.defaults().beams.forEach((b, i) => {
            const got = groundBeamRow(b);
            for (const [k, v] of Object.entries(expected[i] ?? {})) {
                expect(got[k as keyof typeof got], `row ${i + 8} ${k}`).toBeCloseTo(v, 9);
            }
        });
    });

    it('an empty Excel row: Q and S show "_" (null), weights 0', () => {
        const r = groundBeamRow(emptyRow);
        expect(r.stirrupCount).toBeNull();
        expect(r.stirrupTotalLength).toBeNull();
        expect(r.stirrupWeight).toBe(0);
        expect(r.mainWeight).toBe(0);
        expect(r.formwork).toBe(0);
    });

    it('reproduces the totals row 6 (G6, J6:S6, V6, X6)', () => {
        const t = groundBeamTotals(groundBeam.defaults());
        expect(t.lean).toBeCloseTo(1.152, 9);
        expect(t.main.DB12).toBeCloseTo(708.9792, 9);
        expect([t.main.RB6, t.main.RB9, t.main.DB16, t.main.DB20]).toEqual([0, 0, 0, 0]);
        expect(t.stirrup.RB6).toBeCloseTo(208.1028, 9);
        expect([t.stirrup.RB9, t.stirrup.DB12, t.stirrup.DB16, t.stirrup.DB20]).toEqual([0, 0, 0, 0]);
        expect(t.formwork).toBeCloseTo(94.16, 9);
        expect(t.concrete).toBeCloseTo(9.416, 9);

        const out = groundBeam.compute(groundBeam.defaults(), ctx);
        expect(out['rebar.RB6']).toBeCloseTo(208.1028, 9);
        expect(out['rebar.DB12']).toBeCloseTo(708.9792, 9);
        expect(out['rebar.RB9']).toBe(0);
        expect(out.lean).toBeCloseTo(1.152, 9);
    });

    it('feeds BOQ section 8 like Excel (R69, R71–R73, R77, R80) and the section total', () => {
        const { section, row } = run();
        for (const key of ['R69', 'R77', 'R80']) {
            expect(row(key)?.qty, key).toBeCloseTo(goldenLines[key]?.E ?? NaN, 9);
            expect(row(key)?.grossQty, key).toBeCloseTo(goldenLines[key]?.H ?? NaN, 9);
            expect(row(key)?.fromCalc.qty, key).toBe(true);
        }
        // Slot rows replace Excel rows 71–73.
        const rb6 = row('ground-beam:rebar:RB6');
        const db12 = row('ground-beam:rebar:DB12');
        const wire = row('ground-beam:rebar:tie-wire');
        expect(rb6?.qty).toBeCloseTo(goldenLines.R71?.E ?? NaN, 9);
        expect(rb6?.total).toBeCloseTo(goldenLines.R71?.M ?? NaN, 6);
        expect(db12?.qty).toBeCloseTo(goldenLines.R72?.E ?? NaN, 9);
        expect(db12?.total).toBeCloseTo(goldenLines.R72?.M ?? NaN, 6);
        expect(wire?.grossQty).toBeCloseTo(goldenLines.R73?.H ?? NaN, 6);
        expect(section?.rows.some(r => r.key === 'R71')).toBe(false);
        expect(section?.total).toBeCloseTo(goldenSections['8']?.M ?? NaN, 2);
    });

    it('with the precast-slab shear key in the same section, section 8 still equals Excel M81', () => {
        const res = computeProject(createProject(), [groundBeam, precastSlab]);
        const s8 = res.boq.sections.find(s => s.no === 8);
        expect(s8?.rows.filter(r => r.key.includes(':')).map(r => r.key)).toEqual([
            'ground-beam:rebar:RB6', 'ground-beam:rebar:DB12', 'ground-beam:rebar:tie-wire', 'precast-slab:shear-key:RB6',
        ]);
        expect(s8?.total).toBeCloseTo(goldenSections['8']?.M ?? NaN, 2);
    });

    it('links lean / formwork / concrete to BOQ R69 / R77 / R80 qty', () => {
        expect(groundBeam.boqLinks).toEqual([
            { line: 'R69', field: 'qty', output: 'lean' },
            { line: 'R77', field: 'qty', output: 'formwork' },
            { line: 'R80', field: 'qty', output: 'concrete' },
        ]);
    });

    it('D1: a 15th beam row (beyond Excel rows 8–21 and the short V6/X6/G6 ranges) is counted', () => {
        const extra: GroundBeamRow = {
            name: 'B5', width: 0.2, depth: 0.4, length: 5, leanThickness: 0.05,
            mainSize: 'DB16', mainCount: 4, stirrupSize: 'RB9', stirrupSpacing: 0.2,
        };
        const beams = [...groundBeam.defaults().beams, ...Array.from({ length: 10 }, () => emptyRow), extra];
        expect(beams).toHaveLength(15);
        const out = groundBeam.compute({ beams }, ctx);
        // lean 0.2·5·0.05 = 0.05; formwork 2·0.4·5 = 4; concrete 0.2·0.4·5 = 0.4
        expect(out.lean).toBeCloseTo(1.152 + 0.05, 9);
        expect(out.formwork).toBeCloseTo(94.16 + 4, 9);
        expect(out.concrete).toBeCloseTo(9.416 + 0.4, 9);
        // main 4 × 5 m × 1.58 = 31.6 kg DB16; stirrups ceil(5/0.2) = 25 × 1.2 m × 0.499 = 14.97 kg RB9
        expect(out['rebar.DB16']).toBeCloseTo(31.6, 9);
        expect(out['rebar.RB9']).toBeCloseTo(14.97, 9);

        const { row, section } = run({ beams });
        const keys = section?.rows.map(r => r.key).filter(k => k.startsWith('ground-beam:rebar:'));
        expect(keys).toEqual(['RB6', 'RB9', 'DB12', 'DB16', 'tie-wire'].map(k => `ground-beam:rebar:${k}`));
        const gross = 208.1028 * 1.06 + 14.97 * 1.09 + 708.9792 * 1.12 + 31.6 * 1.12;
        expect(row('ground-beam:rebar:tie-wire')?.grossQty).toBeCloseTo(gross * 0.03, 6);
        expect(row('R77')?.qty).toBeCloseTo(98.16, 9);
        // concrete 9.816 × 1.1 = 10.7976 → CEILING 0.25 = 11
        expect(row('R80')?.grossQty).toBeCloseTo(11, 9);
    });

    it('stirrup count = ROUNDUP(L/s) with no +1: 3 m @ 0.15 = 20 ปลอก, 3.1 m @ 0.15 = 21', () => {
        const base = { ...emptyRow, width: 0.2, depth: 0.4, stirrupSize: 'RB6', stirrupSpacing: 0.15 };
        expect(groundBeamRow({ ...base, length: 3 }).stirrupCount).toBe(20);
        expect(groundBeamRow({ ...base, length: 3.1 }).stirrupCount).toBe(21);
    });

    it('removing every beam leaves no rebar rows in the slot', () => {
        const { section } = run({ beams: [] });
        expect(section?.rows.some(r => r.key.startsWith('ground-beam:rebar:'))).toBe(false);
        expect(section?.rows.some(r => r.key === 'R71')).toBe(false);
    });
});
