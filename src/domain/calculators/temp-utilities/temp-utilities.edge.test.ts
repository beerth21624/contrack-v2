import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import { CABLE_ROLL_M, PVC_STICK_M, tempUtilities, type TempUtilitiesInput } from '.';

const ctx = { outputs: () => undefined };
const blankInput = (): TempUtilitiesInput => tempUtilities.blank?.() ?? tempUtilities.defaults();
const out = (i: Partial<TempUtilitiesInput>, base: 'defaults' | 'blank' = 'defaults') =>
    tempUtilities.compute({ ...(base === 'blank' ? blankInput() : tempUtilities.defaults()), ...i }, ctx);
const withPrices = (p: Partial<TempUtilitiesInput['prices']>): Partial<TempUtilitiesInput> => ({ prices: { ...tempUtilities.defaults().prices, ...p } });

function boqRow(res: ProjectResult, key: string) {
    const r = res.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (r?.type !== 'item') throw new Error(`row ${key} missing`);
    return r;
}
const section = (res: ProjectResult, no: number) => {
    const s = res.boq.sections.find(x => x.no === no);
    if (!s) throw new Error(`section ${String(no)} missing`);
    return s;
};
function projectWith(input: Partial<TempUtilitiesInput>, start: 'blank' | 'sample' = 'blank'): Project {
    const p = createProject(start);
    p.calculators['temp-utilities'] = { ...(start === 'blank' ? blankInput() : tempUtilities.defaults()), ...input };
    return p;
}

describe('temp-utilities edge — defaults (Excel sample) and blank', () => {
    it('defaults: every line of the sample by hand', () => {
        // pipe ⌈25/4 × 1.1⌉ = ⌈6.875⌉ = 7 ; cable ⌈25/50 × 1.1⌉ = ⌈0.55⌉ = 1
        expect(out({})).toEqual({
            pipeQty: 7, faucetQty: 3, powerBoxQty: 1, cableQty: 1, lightPlugQty: 6,
            pipeTotal: 420, faucetTotal: 360, waterFittings: 234,
            powerBoxTotal: 1200, cableTotal: 2500, lightPlugTotal: 1200, electricalAcc: 555,
            waterMaterial: 1014, powerMaterial: 5455, total: 6469,
        });
    });

    it('constants: 4 m per PVC stick, 50 m per cable roll', () => {
        expect(PVC_STICK_M).toBe(4);
        expect(CABLE_ROLL_M).toBe(50);
    });

    it('blank: all site quantities 0 except the 1 ชุด power box (1,200 บาท)', () => {
        const o = out({}, 'blank');
        expect(o.pipeQty).toBe(0);
        expect(o.cableQty).toBe(0);
        expect(o.faucetQty).toBe(0);
        expect(o.lightPlugQty).toBe(0);
        expect(o.powerBoxQty).toBe(1);
        expect(o.waterMaterial).toBe(0);
        expect(o.powerMaterial).toBe(1200);
        expect(o.total).toBe(1200);
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
        expect(Object.is(o.pipeQty, 0)).toBe(true);
        expect(Object.is(o.cableQty, 0)).toBe(true);
    });

    it('blank keeps waste 10 %, fittings 30 %, accessories 15 % and the Excel prices', () => {
        const b = blankInput();
        expect(b.waste).toBe(0.1);
        expect(b.waterFittingsPct).toBe(0.3);
        expect(b.electricalAccPct).toBe(0.15);
        expect(b.prices).toEqual(tempUtilities.defaults().prices);
    });

    it('blank project: R16 = 1 เหมา × (1,200 material + 1,500 labour) = 2,700; section 2 = 2,700', () => {
        const res = computeProject(createProject('blank'));
        const r16 = boqRow(res, 'R16');
        expect(r16.qty).toBe(1);
        expect(r16.matUnit).toBe(1200);
        expect(r16.labUnit).toBe(1500);
        expect(r16.total).toBe(2700);
        expect(section(res, 2).total).toBe(2700);
    });

    it('sample project: R16 material = 6,469 (D3 links C30), labour stays 1,500', () => {
        const r16 = boqRow(computeProject(createProject('sample')), 'R16');
        expect(r16.matUnit).toBe(6469);
        expect(r16.matTotal).toBe(6469);
        expect(r16.total).toBe(7969);
    });
});

describe('temp-utilities edge — each input alone (hand computed)', () => {
    it('waterDistance 40 m: ⌈10 × 1.1⌉ = 11 sticks (float noise 11.000000000000002 must not give 12)', () => {
        const o = out({ waterDistance: 40 });
        expect(o.pipeQty).toBe(11);
        expect(o.pipeTotal).toBe(660);
        // fittings (660 + 360) × 0.3 = 306; water = 660 + 360 + 306 = 1326; total 1326 + 5455
        expect(o.total).toBe(6781);
    });

    it('waterPoints 5: faucets 600, fittings (420 + 600) × 0.3 = 306, water 1,326, total 6,781', () => {
        const o = out({ waterPoints: 5 });
        expect(o.faucetTotal).toBe(600);
        expect(o.waterFittings).toBeCloseTo(306, 9);
        expect(o.waterMaterial).toBeCloseTo(1326, 9);
        expect(o.total).toBeCloseTo(6781, 9);
    });

    it('powerDistance 100 m: ⌈2 × 1.1⌉ = 3 rolls → cable 7,500, acc (7,500 + 1,200) × 0.15 = 1,305, total 12,219', () => {
        const o = out({ powerDistance: 100 });
        expect(o.cableQty).toBe(3);
        expect(o.cableTotal).toBe(7500);
        expect(o.electricalAcc).toBeCloseTo(1305, 9);
        expect(o.total).toBeCloseTo(12219, 9);
    });

    it('powerDistance 50 m: ⌈1 × 1.1⌉ = 2 rolls → total 9,344', () => {
        const o = out({ powerDistance: 50 });
        expect(o.cableQty).toBe(2);
        expect(o.total).toBeCloseTo(9344, 9);
    });

    it('powerPoints 10: lights 2,000, acc (2,500 + 2,000) × 0.15 = 675, power 6,375, total 7,389', () => {
        const o = out({ powerPoints: 10 });
        expect(o.lightPlugTotal).toBe(2000);
        expect(o.electricalAcc).toBeCloseTo(675, 9);
        expect(o.powerMaterial).toBeCloseTo(6375, 9);
        expect(o.total).toBeCloseTo(7389, 9);
    });

    it('waste 0: ⌈6.25⌉ = 7 and ⌈0.5⌉ = 1 → total unchanged 6,469', () => {
        const o = out({ waste: 0 });
        expect(o.pipeQty).toBe(7);
        expect(o.cableQty).toBe(1);
        expect(o.total).toBe(6469);
    });

    it('waste 100 %: ⌈12.5⌉ = 13 sticks, ⌈1.0⌉ = 1 roll → total 6,937', () => {
        const o = out({ waste: 1 });
        expect(o.pipeQty).toBe(13);
        expect(o.cableQty).toBe(1);
        expect(o.total).toBeCloseTo(6937, 9);
    });

    it('waterFittingsPct 0 → water 780, total 6,235; 100 % → fittings 780, water 1,560, total 7,015', () => {
        expect(out({ waterFittingsPct: 0 }).total).toBeCloseTo(6235, 9);
        const o = out({ waterFittingsPct: 1 });
        expect(o.waterFittings).toBe(780);
        expect(o.total).toBeCloseTo(1560 + 5455, 9);
    });

    it('electricalAccPct 0 → power 4,900, total 5,914', () => {
        const o = out({ electricalAccPct: 0 });
        expect(o.electricalAcc).toBe(0);
        expect(o.total).toBeCloseTo(5914, 9);
    });

    it('each unit price alone', () => {
        // pvc 100: pipe 700, fittings (700+360)×0.3 = 318, water 1,378, total 6,833
        expect(out(withPrices({ pvcPipe: 100 })).total).toBeCloseTo(6833, 9);
        // faucet 0: fittings 420×0.3 = 126, water 546, total 6,001
        expect(out(withPrices({ faucet: 0 })).total).toBeCloseTo(6001, 9);
        // power box 0: power 4,255, total 5,269
        expect(out(withPrices({ powerBox: 0 })).total).toBeCloseTo(5269, 9);
        // cable 0: acc 1,200×0.15 = 180, power 2,580, total 3,594
        expect(out(withPrices({ cable: 0 })).total).toBeCloseTo(3594, 9);
        // light 0: acc 2,500×0.15 = 375, power 4,075, total 5,089
        expect(out(withPrices({ lightPlug: 0 })).total).toBeCloseTo(5089, 9);
    });

    it('text fields (name, date, remark) never change the money', () => {
        expect(out({ projectName: 'ก', calculatedBy: 'ข', calcDate: '2026-10-27', remark: 'ค' }).total).toBe(6469);
    });

    it('power box quantity is always 1, whatever the site', () => {
        expect(out({ powerDistance: 0, powerPoints: 0 }).powerBoxQty).toBe(1);
        expect(out({ powerDistance: 1e6, powerPoints: 999 }).powerBoxQty).toBe(1);
    });
});

describe('temp-utilities edge — CEILING boundaries', () => {
    it('pipe sticks (waste 0): 0 m → 0, 0.01 m → 1, 4 m → 1, 4.001 m → 2, 8 m → 2, 8.4 m → 3', () => {
        const q = (d: number) => out({ waste: 0, waterDistance: d }).pipeQty;
        expect([q(0), q(0.01), q(4), q(4.001), q(8), q(8.4)]).toEqual([0, 1, 1, 2, 2, 3]);
    });

    it('cable rolls (waste 0): 0 → 0, 1 m → 1, 50 m → 1, 50.01 m → 2, 100 m → 2, 100.5 m → 3', () => {
        const q = (d: number) => out({ waste: 0, powerDistance: d }).cableQty;
        expect([q(0), q(1), q(50), q(50.01), q(100), q(100.5)]).toEqual([0, 1, 1, 2, 2, 3]);
    });

    it('float noise on exact products: 40 m × 10 % → 11, 500 m cable × 10 % → 11', () => {
        expect(out({ waste: 0.1, waterDistance: 40 }).pipeQty).toBe(11);
        expect(out({ waste: 0.1, powerDistance: 500 }).cableQty).toBe(11);
    });

    it('exact half: 8 m with 25 % waste is 2.5 sticks → 3', () => {
        expect(out({ waste: 0.25, waterDistance: 8 }).pipeQty).toBe(3);
    });

    it('just above an integer after waste rounds up: 36.4 m × 1.1 / 4 = 10.01 → 11', () => {
        expect(out({ waste: 0.1, waterDistance: 36.4 }).pipeQty).toBe(11);
    });
});

describe('temp-utilities edge — zero, decimal, negative, huge', () => {
    it('all site values 0 gives the blank result', () => {
        const o = out({ powerDistance: 0, waterDistance: 0, waterPoints: 0, powerPoints: 0 });
        expect(o.total).toBe(1200);
        expect(o.pipeQty).toBe(0);
    });

    it('decimal points are used as typed (no rounding on counts): 2.5 faucets = 300', () => {
        expect(out({ waterPoints: 2.5 }).faucetTotal).toBe(300);
    });

    it('NaN and Infinity inputs count as 0 for every numeric field', () => {
        for (const bad of [NaN, Infinity, -Infinity]) {
            const o = out({ powerDistance: bad, waterDistance: bad, waterPoints: bad, powerPoints: bad, waste: bad, waterFittingsPct: bad, electricalAccPct: bad });
            for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), `${k} with ${String(bad)}`).toBe(true);
            expect(o.total).toBe(1200);
        }
        const p = out(withPrices({ pvcPipe: NaN, faucet: Infinity, powerBox: NaN, cable: -Infinity, lightPlug: NaN }));
        for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
        expect(p.total).toBe(0);
    });

    it('huge 1e6 m: pipes ⌈250,000 × 1.1⌉ = 275,000 sticks, cable ⌈20,000 × 1.1⌉ = 22,000 rolls', () => {
        const o = out({ waterDistance: 1e6, powerDistance: 1e6 });
        expect(o.pipeQty).toBe(275000);
        expect(o.pipeTotal).toBe(16500000);
        expect(o.cableQty).toBe(22000);
        expect(o.cableTotal).toBe(55000000);
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
    });

    it('huge prices and points stay finite', () => {
        const o = out({ waterPoints: 1e6, powerPoints: 1e6, ...withPrices({ faucet: 1e6, lightPlug: 1e6 }) });
        expect(o.faucetTotal).toBe(1e12);
        expect(o.lightPlugTotal).toBe(1e12);
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
    });

    it('negative values never produce NaN/Infinity', () => {
        const o = out({ waterDistance: -10, powerDistance: -10, waterPoints: -1, powerPoints: -1, waste: -0.5 });
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
    });
});

describe('temp-utilities edge — BOQ link and skipping', () => {
    it('links only the total into R16 material', () => {
        expect(tempUtilities.boqLinks).toEqual([{ line: 'R16', field: 'mat', output: 'total' }]);
    });

    it('a changed total lands in R16 material and nowhere else in section 2', () => {
        const res = computeProject(projectWith({ waterDistance: 40, waterPoints: 5 }));
        // water (660 + 600) × 1.3 = 1,638, plus the 1,200 power box = 2,838
        const r16 = boqRow(res, 'R16');
        expect(r16.matUnit).toBeCloseTo(2838, 9);
        expect(r16.labUnit).toBe(1500);
        expect(r16.total).toBeCloseTo(4338, 9);
        expect(section(res, 2).total).toBeCloseTo(4338, 9);
        expect(section(res, 2).rows.filter(r => r.type === 'item')).toHaveLength(1);
    });

    it('other sections do not move when only temp utilities change', () => {
        const a = computeProject(createProject('blank'));
        const b = computeProject(projectWith({ waterDistance: 80, powerDistance: 80 }));
        for (const s of a.boq.sections.filter(x => x.no !== 2)) {
            expect(section(b, s.no).total, `section ${String(s.no)}`).toBe(s.total);
        }
    });

    it('marked "ไม่มีในโครงการนี้": outputs 0 (even the 1 ชุด box), R16 quantity 0, section 2 = 0', () => {
        for (const start of ['blank', 'sample'] as const) {
            const p = projectWith({ waterDistance: 40 }, start);
            p.journey = { 'temp-utilities': 'skipped' };
            const res = computeProject(p);
            expect(Object.values(res.calcOutputs['temp-utilities'] ?? {}).every(v => v === 0)).toBe(true);
            expect(res.calcOutputs['temp-utilities']?.powerBoxQty).toBe(0);
            expect(boqRow(res, 'R16').qty).toBe(0);
            expect(section(res, 2).total).toBe(0);
        }
    });

    it('skipped keeps the typed labour price on the row for when the work comes back', () => {
        const p = createProject('blank');
        p.boqOverrides = { R16: { qty: 4, lab: 999 } };
        p.journey = { 'temp-utilities': 'skipped' };
        const r16 = boqRow(computeProject(p), 'R16');
        expect(r16.qty).toBe(0);
        expect(r16.total).toBe(0);
        expect(r16.labUnit).toBe(999);
    });
});
