import { describe, expect, it } from 'vitest';
import { stair, stairRow, stairTotals, type StairRow } from '.';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const g = golden.lines;

function section13(input?: unknown) {
    const project = createProject();
    if (input !== undefined) project.calculators.stair = input;
    const sec = computeProject(project, [stair]).boq.sections.find(s => s.no === 13);
    const row = (key: string) => sec?.rows.find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { sec, row };
}

describe('บันได_Stair (sheet 33)', () => {
    it('Excel sample rows 8–10: every computed cell', () => {
        const rows = stair.defaults().rows.map(stairRow);
        const cached = [
            {
                G: 1.00623059, N: 22, O: 48.53707298, P: 24.21999942, S: 7, T: 23.1, U: 11.5269, X: 22, Y: 29.7, Z: 14.8203,
                AC: 6, AD: 19.8, AE: 9.8802, AG: 6, AH: 3.320560947, AI: 0.2817445652, AJ: 0.301869177, AK: 1.485,
                AL: 5.389174689, AN: 0.4648785325, AO: 0.22275, AP: 0.6876285325,
            },
            {
                G: 1.00623059, N: 14, O: 30.88722826, P: 15.4127269, S: 7, T: 14, U: 6.986, X: 14, Y: 18.9, Z: 9.4311,
                AC: 6, AD: 12, AE: 5.988, AG: 4, AH: 2.01246118, AI: 0.2817445652, AJ: 0.301869177, AK: 0.9,
                AL: 3.496074922, AN: 0.2817445652, AO: 0.135, AP: 0.4167445652,
            },
            {
                G: 1.00623059, N: 20, O: 44.1246118, P: 22.01818129, S: 7, T: 20.3, U: 10.1297, X: 20, Y: 27, Z: 13.473,
                AC: 6, AD: 17.4, AE: 8.6826, AG: 5, AH: 2.918068711, AI: 0.2817445652, AJ: 0.301869177, AK: 1.305,
                AL: 4.806682453, AN: 0.4085296195, AO: 0.19575, AP: 0.6042796195,
            },
        ];
        expect(rows).toHaveLength(3);
        rows.forEach((r, i) => {
            const c = cached[i];
            if (!c) throw new Error('missing fixture');
            expect(r.inclined).toBeCloseTo(c.G, 8);
            expect(r.waistMain.count).toBe(c.N);
            expect(r.waistMain.length).toBeCloseTo(c.O, 7);
            expect(r.waistMain.kg).toBeCloseTo(c.P, 7);
            expect(r.waistTemp.count).toBe(c.S);
            expect(r.waistTemp.length).toBeCloseTo(c.T, 9);
            expect(r.waistTemp.kg).toBeCloseTo(c.U, 9);
            expect(r.stepMain.count).toBe(c.X);
            expect(r.stepMain.length).toBeCloseTo(c.Y, 9);
            expect(r.stepMain.kg).toBeCloseTo(c.Z, 9);
            expect(r.stepTemp.count).toBe(c.AC);
            expect(r.stepTemp.length).toBeCloseTo(c.AD, 9);
            expect(r.stepTemp.kg).toBeCloseTo(c.AE, 9);
            expect(r.props).toBe(c.AG);
            expect(r.soffit).toBeCloseTo(c.AH, 8);
            expect(r.waistSides).toBeCloseTo(c.AI, 9);
            expect(r.stepSides).toBeCloseTo(c.AJ, 8);
            expect(r.risers).toBeCloseTo(c.AK, 9);
            expect(r.formwork).toBeCloseTo(c.AL, 8);
            expect(r.waistConcrete).toBeCloseTo(c.AN, 9);
            expect(r.stepConcrete).toBeCloseTo(c.AO, 9);
            expect(r.concrete).toBeCloseTo(c.AP, 9);
        });
    });

    it('Excel sample row 6 totals: M6, R6, W6, AB6 (RB9), AG6 15, AH6 13.692, AN6 1.7087', () => {
        const t = stairTotals(stair.defaults());
        expect(t.groups.waistMain.RB9).toBeCloseTo(61.6509076, 7);
        expect(t.groups.waistTemp.RB9).toBeCloseTo(28.6426, 9);
        expect(t.groups.stepMain.RB9).toBeCloseTo(37.7244, 9);
        expect(t.groups.stepTemp.RB9).toBeCloseTo(24.5508, 9);
        expect(t.rebar.RB9).toBeCloseTo(g.R138.E, 7);
        expect(t.rebar.RB6 + t.rebar.DB12 + t.rebar.DB16 + t.rebar.DB20).toBe(0);
        expect(t.props).toBe(15);
        expect(t.formwork).toBeCloseTo(13.69193206, 8);
        expect(t.concrete).toBeCloseTo(1.708652717, 9);
    });

    it('feeds BOQ section 13 exactly like Excel', () => {
        const { sec, row } = section13();
        expect(row('R140')?.qty).toBe(g.R140.E);
        expect(row('R142')?.qty).toBeCloseTo(g.R142.E, 8);
        expect(row('R145')?.qty).toBeCloseTo(g.R145.E, 9);
        expect(row('R145')?.grossQty).toBe(g.R145.H);     // MAX(1, CEILING(1.88, 0.25)) = 2 (template rule)
        const rb9 = row('stair:rebar:RB9'), wire = row('stair:rebar:tie-wire');
        expect(row('R138')).toBeUndefined();
        expect(rb9?.qty).toBeCloseTo(g.R138.E, 7);
        expect(rb9?.waste).toBe(0.09);
        expect(wire?.grossQty).toBeCloseTo(g.R139.H, 7);
        expect(sec?.total).toBeCloseTo(golden.sections['13'].M, 2);
    });

    it('standard outputs', () => {
        const out = stair.compute(stair.defaults(), ctx);
        expect(Object.keys(out).sort()).toEqual(
            ['concrete', 'formwork', 'props', 'rebar.DB12', 'rebar.DB16', 'rebar.DB20', 'rebar.RB6', 'rebar.RB9'],
        );
        expect(out['rebar.RB9']).toBeCloseTo(152.5687076, 7);
    });

    it('a 4th stair with DB12 main bars and a blank spacing', () => {
        const extra: StairRow = {
            name: 'บันไดข้างบ้าน', width: 1.2, waist: 0.15, rise: 0.6, run: 0.8, steps: 4, riser: 0.15, tread: 0.2,
            waistMainSize: 'DB12', waistMainSpacing: 0.2, waistTempSize: 'RB9', waistTempSpacing: 0,
            stepMainSize: 'RB9', stepMainSpacing: 0.3, stepTempSize: 'RB6', stepTempSpacing: 0.15,
        };
        const input = stair.defaults();
        input.rows.push(extra);
        const r = stairRow(extra);
        // G = √(0.64 + 0.36) = 1; N = ROUNDUP(1.2/0.2) = 6, O = (1 + 1.2)·6 = 13.2 m → 11.7216 kg DB12
        expect(r.inclined).toBeCloseTo(1, 12);
        expect(r.waistMain.count).toBe(6);
        expect(r.waistMain.kg).toBeCloseTo(13.2 * 0.888, 9);
        // R blank → S/T "_", U 0
        expect(r.waistTemp).toEqual({ count: null, length: null, kg: 0 });
        // X = ROUNDUP(1.2/0.3) = 4, Y = 4·(0.8 + 0.6) = 5.6 m → 2.7944 kg RB9
        expect(r.stepMain.kg).toBeCloseTo(5.6 * 0.499, 9);
        // AC = 2·4 = 8 (spacing ignored), AD = 9.6 m → 2.1312 kg RB6
        expect(r.stepTemp).toMatchObject({ count: 8 });
        expect(r.stepTemp.kg).toBeCloseTo(9.6 * 0.222, 9);
        // soffit 1.2 → props ROUNDUP(2) = 2; formwork 1.2 + 0.3 + 0.3 + 0.72 = 2.52; concrete 0.18 + 0.072
        expect(r.props).toBe(2);
        expect(r.formwork).toBeCloseTo(2.52, 9);
        expect(r.concrete).toBeCloseTo(0.252, 9);

        const out = stair.compute(input, ctx);
        expect(out.props).toBe(17);
        expect(out['rebar.DB12']).toBeCloseTo(11.7216, 9);
        expect(out['rebar.RB6']).toBeCloseTo(2.1312, 9);
        expect(out['rebar.RB9']).toBeCloseTo(152.5687076 + 2.7944, 7);
        const { row } = section13(input);
        expect(row('stair:rebar:RB6')?.waste).toBe(0.06);
        expect(row('stair:rebar:DB12')?.waste).toBe(0.12);
        expect(row('R140')?.qty).toBe(17);
    });

    it('links', () => {
        expect(stair.boqLinks).toEqual([
            { line: 'R140', field: 'qty', output: 'props' },
            { line: 'R142', field: 'qty', output: 'formwork' },
            { line: 'R145', field: 'qty', output: 'concrete' },
        ]);
    });
});
