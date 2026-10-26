import { describe, expect, it } from 'vitest';
import { tempUtilities } from '.';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';

const ctx = { outputs: () => undefined };
const run = (patch: Partial<ReturnType<typeof tempUtilities.defaults>> = {}) =>
    tempUtilities.compute({ ...tempUtilities.defaults(), ...patch }, ctx);

describe('น้ำไฟชั่วคราว (sheet 37)', () => {
    it('Excel sample reproduces every cached cell', () => {
        const o = run();
        // Quantities C18–C23
        expect(o.pipeQty).toBe(7);        // C18 CEILING(25/4 × 1.1) = CEILING(6.875)
        expect(o.faucetQty).toBe(3);      // C19
        expect(o.powerBoxQty).toBe(1);    // C21
        expect(o.cableQty).toBe(1);       // C22 CEILING(25/50 × 1.1) = CEILING(0.55)
        expect(o.lightPlugQty).toBe(6);   // C23
        // Totals G18–G24
        expect(o.pipeTotal).toBe(420);
        expect(o.faucetTotal).toBe(360);
        expect(o.waterFittings).toBeCloseTo(234, 9);
        expect(o.powerBoxTotal).toBe(1200);
        expect(o.cableTotal).toBe(2500);
        expect(o.lightPlugTotal).toBe(1200);
        expect(o.electricalAcc).toBeCloseTo(555, 9);
        // Summary C27, C28, C30
        expect(o.waterMaterial).toBeCloseTo(1014, 9);
        expect(o.powerMaterial).toBeCloseTo(5455, 9);
        expect(o.total).toBeCloseTo(6469, 9);
    });

    it('feeds BOQ I16 (material of เดินน้ำ-ไฟชั่วคราว) only; labour K16 stays typed', () => {
        expect(tempUtilities.boqLinks).toEqual([{ line: 'R16', field: 'mat', output: 'total' }]);
    });

    it('D3: linked material is 6,469 vs Excel retyped 6,500 → section 2 = 7,969 (−31)', () => {
        expect(golden.lines.R16.I).toBe(6500);
        expect(golden.lines.R16.K).toBe(1500);
        const result = computeProject(createProject(), [tempUtilities]);
        const s2 = result.boq.sections.find(s => s.no === 2);
        expect(s2?.total).toBeCloseTo(7969, 6);
        expect((s2?.total ?? 0) - golden.sections['2'].M).toBeCloseTo(-31, 6);
    });

    it('longer runs round up to whole sticks / rolls', () => {
        // water 40 m: 40/4 × 1.1 = 11 → 11 sticks; power 60 m: 60/50 × 1.1 = 1.32 → 2 rolls
        const o = run({ waterDistance: 40, powerDistance: 60 });
        expect(o.pipeQty).toBe(11);
        expect(o.cableQty).toBe(2);
        // water = (11×60 + 360) × 1.3 = 1,326; power = 1,200 + (2×2,500 + 1,200) × 1.15 = 8,330
        expect(o.waterMaterial).toBeCloseTo(1326, 9);
        expect(o.powerMaterial).toBeCloseTo(8330, 9);
        expect(o.total).toBeCloseTo(9656, 9);
    });

    it('exact multiples do not round up an extra stick / roll; 0 distance orders none', () => {
        // 24 m, waste 0: 24/4 = 6 sticks; 100 m: 100/50 = 2 rolls
        expect(run({ waterDistance: 24, powerDistance: 100, waste: 0 })).toMatchObject({ pipeQty: 6, cableQty: 2 });
        const zero = run({ waterDistance: 0, powerDistance: 0 });
        expect(zero).toMatchObject({ pipeQty: 0, cableQty: 0, pipeTotal: 0, cableTotal: 0 });
        expect(Object.is(zero.pipeQty, 0)).toBe(true);
    });

    it('blank project: distances and points 0, prices and % kept; only the 30A box (1 ชุด) stays', () => {
        const blank = tempUtilities.blank?.();
        expect(blank).toBeDefined();
        if (!blank) return;
        const sample = tempUtilities.defaults();
        expect(blank).toEqual({ ...sample, powerDistance: 0, waterDistance: 0, waterPoints: 0, powerPoints: 0 });
        const o = tempUtilities.compute(blank, ctx);
        expect(Object.values(o).every(Number.isFinite)).toBe(true);
        expect(o).toMatchObject({ pipeQty: 0, faucetQty: 0, cableQty: 0, lightPlugQty: 0, waterMaterial: 0 });
        expect(o.powerMaterial).toBe(1200);
        expect(o.total).toBe(1200);
        // BOQ R16: material 1,200 (linked) + typed labour 1,500
        const s2 = computeProject(createProject('blank'), [tempUtilities]).boq.sections.find(s => s.no === 2);
        expect(s2?.total).toBeCloseTo(2700, 6);
    });

    it('points and prices drive faucets, lights and their % rows', () => {
        const input = tempUtilities.defaults();
        input.waterPoints = 5;
        input.powerPoints = 10;
        input.prices = { ...input.prices, lightPlug: 250 };
        input.electricalAccPct = 0.2;
        const o = tempUtilities.compute(input, ctx);
        // water = (420 + 5×120) × 1.3 = 1,326
        expect(o.waterFittings).toBeCloseTo(306, 9);
        expect(o.waterMaterial).toBeCloseTo(1326, 9);
        // power = 1,200 + (2,500 + 10×250) × 1.2 = 7,200 — the 30A box is outside the % base
        expect(o.electricalAcc).toBeCloseTo(1000, 9);
        expect(o.powerMaterial).toBeCloseTo(7200, 9);
    });
});
