import { describe, expect, it } from 'vitest';
import { roofing, roofingOp, roofingQty, roofingTakeoffs, slopeArea, type RoofingInput } from '.';
import { roofStructure } from '../roof-structure';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const goldenLines: Record<string, { E?: number; H?: number; M?: number } | undefined> = golden.lines;
const BOQ_ROWS = Array.from({ length: 15 }, (_, i) => `R${162 + i}`);

const section16 = (calcInput?: RoofingInput) => {
    const project = createProject();
    if (calcInput !== undefined) project.calculators.roofing = calcInput;
    const res = computeProject(project, [roofing, roofStructure]);
    const sec = res.boq.sections.find(s => s.no === 16);
    const row = (key: string) => sec?.rows.find(r => r.key === key) as BoqItemRow;
    return { sec, row, res };
};

describe('มุงหลังคา_Roofing (sheet 23)', () => {
    it('Excel sample: K7 พื้นที่ตามแนวลาดเอียง = 113 / COS(RADIANS(40)) = 147.5110237', () => {
        const input = roofing.defaults();
        expect(input.planArea).toBe(113);
        expect(input.slopeDeg).toBe(40);
        expect(slopeArea(input)).toBeCloseTo(147.5110237, 6);
        expect(roofing.compute(input, ctx).slopeArea).toBeCloseTo(147.5110237, 6);
    });

    it('Excel sample: E5…E17 ปริมาณถอดแบบ', () => {
        const e = roofingTakeoffs(roofing.defaults());
        const expected = [147.5110237, 19.1, 44.51438857, 7.2, 8, 5, 1, 19.1, 7.2, 10.18, 22.6, 62.3, 147.5110237];
        expect(e).toHaveLength(13);
        expected.forEach((v, i) => expect(e[i]).toBeCloseTo(v, 6));
    });

    it('Excel sample: G5…G17 ปริมาณ BOQ = 1623, 64, 134, 22, 8, 5, 1, 7, 2, 6, 46, 16, 2', () => {
        const out = roofing.compute(roofing.defaults(), ctx);
        expect(Array.from({ length: 13 }, (_, i) => out[`qty.${i}`]))
            .toEqual([1623, 64, 134, 22, 8, 5, 1, 7, 2, 6, 46, 16, 2]);
    });

    it('multiply / divide follows the factor unit and matches Excel G5:G11 (×) and G12:G17 (÷)', () => {
        const ops = roofing.defaults().rows.map(r => roofingOp(r.factorUnit));
        expect(ops).toEqual([...Array<string>(7).fill('mul'), ...Array<string>(6).fill('div')]);
        expect(roofingOp('')).toBe('mul');   // blank rows 18–21: ROUNDUP(E*C)
        const blank = { key: 'x', item: '', factor: 0, factorUnit: '', takeoff: { kind: 'lengths' as const, lengths: [] }, takeoffUnit: '', unit: '' };
        expect(roofingQty(blank, 0)).toBe(0);
        expect(roofingQty({ ...blank, factorUnit: 'ม./แผ่น' }, 10)).toBe(0);  // ÷ empty factor → 0, not #DIV/0!
    });

    it('feeds BOQ section 16 exactly like Excel (E162…E176, H, M and the subtotal)', () => {
        const { sec, row } = section16();
        for (const key of BOQ_ROWS) {
            const g = goldenLines[key];
            expect(g, key).toBeDefined();
            if (!g) continue;
            const r = row(key);
            expect(r.qty, key).toBeCloseTo(g.E ?? NaN, 6);
            expect(r.grossQty, key).toBe(g.H);
            expect(r.total, key).toBeCloseTo(g.M ?? NaN, 4);
            expect(r.fromCalc.qty, key).toBe(true);
        }
        expect(row('R175').qty).toBeCloseTo(147.5110237, 6);
        expect(row('R176').qty).toBe(62.3);
        expect(sec?.matTotal).toBeCloseTo(golden.sections['16'].J, 4);
        expect(sec?.labTotal).toBeCloseTo(golden.sections['16'].L, 4);
        expect(sec?.total).toBeCloseTo(golden.sections['16'].M, 4);
    });

    it('BOQ descriptions D162…D174 follow the item chosen in column B', () => {
        const input = roofing.defaults();
        input.rows = input.rows.map((r, i) => (i === 6 ? { ...r, item: 'ครอบโค้ง 3 ทาง' } : r));
        expect(section16(input).row('R168').desc).toBe('ครอบโค้ง 3 ทาง');
        expect(section16().row('R162').desc).toBe('กระเบื้องหลังคาซีแพคโมเนีย');
    });

    it('changing the pitch to 30°: K7 = 130.48 → tiles 1436, foil 2 rolls, roofing labour on 130.48 m²', () => {
        const input = { ...roofing.defaults(), slopeDeg: 30 };
        const out = roofing.compute(input, ctx);
        expect(out.slopeArea).toBeCloseTo(130.4811608, 6);
        expect(out.R162).toBe(1436);
        expect(out.R174).toBe(2);
        expect(out.R175).toBeCloseTo(130.4811608, 6);
        // The rake caps keep their own 40° (Excel hard-codes it in E7; oddity 14).
        expect(out.R164).toBe(134);
    });

    it('DRYTECH follows the ridge length (E12 = E6): ridge 22 m → 73 caps, 8 DRYTECH sets', () => {
        const input = roofing.defaults();
        input.rows = input.rows.map(r => (r.key === 'ridge' ? { ...r, takeoff: { kind: 'lengths', lengths: [22] } } : r));
        const out = roofing.compute(input, ctx);
        expect(out.R163).toBe(73);   // ROUNDUP(22 × 3.3)
        expect(out.R169).toBe(8);    // ROUNDUP(22 / 3)
    });

    it('fascia length E16 → BOQ R176 (ค่าแรงติดตั้งไม้เชิงชาย) and ROUNDUP(E16/4) sheets', () => {
        const input = roofing.defaults();
        input.rows = input.rows.map(r => (r.key === 'fascia' ? { ...r, takeoff: { kind: 'lengths', lengths: [30, 20.5] } } : r));
        const out = roofing.compute(input, ctx);
        expect(roofing.compute(roofing.defaults(), ctx).fasciaLength).toBe(62.3);
        expect(out.R176).toBe(50.5);
        expect(out.fasciaLength).toBe(50.5);
        expect(out.R173).toBe(13);
    });

    it('added rows compute G but do not reach the BOQ (Excel rows 18–21)', () => {
        const input = roofing.defaults();
        input.rows = [...input.rows, {
            key: 'extra', item: 'ครอบโค้ง 3 ทาง', factor: 1, factorUnit: 'แผ่น',
            takeoff: { kind: 'lengths', lengths: [3] }, takeoffUnit: 'จุด', unit: 'แผ่น',
        }];
        const out = roofing.compute(input, ctx);
        expect(out['qty.13']).toBe(3);
        expect(section16(input).sec?.total).toBeCloseTo(golden.sections['16'].M, 4);
    });

    it('a reference to a missing row counts as 0', () => {
        const input = roofing.defaults();
        input.rows = input.rows.map(r => (r.key === 'drytech' ? { ...r, takeoff: { kind: 'row', ref: 'nope' } } : r));
        expect(roofing.compute(input, ctx).R169).toBe(0);
    });
});
