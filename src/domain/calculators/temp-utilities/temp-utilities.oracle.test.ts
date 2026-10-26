// Differential test: น้ำไฟชั่วคราว compute() + BOQ section 2 vs the real Excel v5 formulas (evaluated by the
// oracle) on ~50 seeded random site inputs + named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import type { BoqResult } from '../../boq/types';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { CABLE_ROLL_M, PVC_STICK_M, tempUtilities, type TempUtilitiesInput, type TempUtilitiesPrices } from '.';

const SHEET = 'น้ำไฟชั่วคราว';
const BOQ = 'BOQ (Home)';
const cell = (c: string) => `${SHEET}!${c}`;

// ─── Input mapping: every yellow cell of sheet 37 ───────────────────────────
const TEXT_INPUTS: readonly [keyof TempUtilitiesInput, string][] = [
    ['projectName', 'C5'], ['calculatedBy', 'F5'], ['calcDate', 'C6'], ['remark', 'F6'],
];
const NUMBER_INPUTS: readonly [keyof TempUtilitiesInput, string][] = [
    ['powerDistance', 'C9'], ['waterDistance', 'C10'], ['waterPoints', 'C11'], ['powerPoints', 'C12'],
    ['waste', 'C13'], ['waterFittingsPct', 'C14'], ['electricalAccPct', 'C15'],
];
/** Unit prices, column F (F20 / F24 are yellow but no formula reads them). */
const PRICE_INPUTS: readonly [keyof TempUtilitiesPrices, string][] = [
    ['pvcPipe', 'F18'], ['faucet', 'F19'], ['powerBox', 'F21'], ['cable', 'F22'], ['lightPlug', 'F23'],
];

function excelInputs(input: TempUtilitiesInput): Record<string, OracleInput> {
    const out: Record<string, OracleInput> = {};
    for (const [field, c] of TEXT_INPUTS) {
        const v = input[field];
        out[cell(c)] = typeof v === 'string' && v !== '' ? v : null;
    }
    for (const [field, c] of NUMBER_INPUTS) out[cell(c)] = input[field] as number;
    for (const [field, c] of PRICE_INPUTS) out[cell(c)] = input.prices[field];
    return out;
}

// ─── Output mapping: every key compute() returns → its Excel cell ───────────
const OUTPUT_CELLS: Record<string, string> = {
    pipeQty: 'C18', faucetQty: 'C19', powerBoxQty: 'C21', cableQty: 'C22', lightPlugQty: 'C23',
    pipeTotal: 'G18', faucetTotal: 'G19', waterFittings: 'G20', powerBoxTotal: 'G21', cableTotal: 'G22',
    lightPlugTotal: 'G23', electricalAcc: 'G24', waterMaterial: 'C27', powerMaterial: 'C28', total: 'C30',
};

// ─── Random but plausible sites ─────────────────────────────────────────────
const SAMPLE_PRICES = tempUtilities.defaults().prices;

function randomInput(seed: number): TempUtilitiesInput {
    const rng = seededRandom(seed);
    // Distances: on a 0.5 m grid, sometimes an exact multiple of a stick / roll (CEILING boundary), sometimes 0.
    const distance = (per: number) => (rng.chance(0.15) ? 0 : rng.chance(0.2) ? per * rng.int(1, 6) : rng.step(1, 150, 0.5));
    const price = (v: number) => (rng.chance(0.1) ? 0 : rng.chance(0.5) ? v : rng.step(v * 0.5, v * 2, 5));
    return {
        projectName: rng.chance(0.3) ? `บ้าน ${rng.int(1, 99)}` : '',
        calculatedBy: rng.chance(0.2) ? 'วิศวกร' : '',
        calcDate: '',
        remark: '',
        powerDistance: distance(CABLE_ROLL_M),
        waterDistance: distance(PVC_STICK_M),
        waterPoints: rng.int(0, 10),
        powerPoints: rng.int(0, 20),
        waste: rng.pick([0, 0.05, 0.1, 0.1, 0.07, 0.15]),
        waterFittingsPct: rng.pick([0.3, 0.3, 0.2, 0.25, 0]),
        electricalAccPct: rng.pick([0.15, 0.15, 0.1, 0.2, 0]),
        prices: {
            pvcPipe: price(SAMPLE_PRICES.pvcPipe), faucet: price(SAMPLE_PRICES.faucet), powerBox: price(SAMPLE_PRICES.powerBox),
            cable: price(SAMPLE_PRICES.cable), lightPlug: price(SAMPLE_PRICES.lightPlug),
        },
    };
}

const sample = tempUtilities.defaults();
const ZERO_PRICES: TempUtilitiesPrices = { pvcPipe: 0, faucet: 0, powerBox: 0, cable: 0, lightPlug: 0 };
const CASES: [string, TempUtilitiesInput][] = [
    ['Excel sample', sample],
    ['zeros: no distances, no points, no waste, no % rows', {
        ...sample, powerDistance: 0, waterDistance: 0, waterPoints: 0, powerPoints: 0, waste: 0, waterFittingsPct: 0, electricalAccPct: 0,
    }],
    ['all prices 0', { ...sample, prices: ZERO_PRICES }],
    ['exact multiples, waste 0 (24 m = 6 sticks, 100 m = 2 rolls)', { ...sample, waterDistance: 24, powerDistance: 100, waste: 0 }],
    ['float boundary: 40 m × 1.1 = 11.000000000000002 sticks, 500 m × 1.1 = 11.000000000000002 rolls',
        { ...sample, waterDistance: 40, powerDistance: 500, waste: 0.1 }],
    ['large values (2 km runs, 200 points, 10× prices)', {
        ...sample, powerDistance: 2000, waterDistance: 2000, waterPoints: 200, powerPoints: 200,
        prices: { pvcPipe: 600, faucet: 1200, powerBox: 12000, cable: 25000, lightPlug: 2000 },
    }],
    ['fractional values (12.35 m, 7.5 % waste, 33.3 % fittings)', {
        ...sample, powerDistance: 12.35, waterDistance: 7.85, waste: 0.075, waterFittingsPct: 0.333, electricalAccPct: 0.125,
        prices: { pvcPipe: 59.5, faucet: 119.75, powerBox: 1199.99, cable: 2499.5, lightPlug: 199.25 },
    }],
    ['header text filled (no formula reads it)', { ...sample, projectName: 'บ้านทดสอบ', calculatedBy: 'ก', calcDate: '1/1/2026', remark: 'x' }],
    ...Array.from({ length: 50 }, (_, k): [string, TempUtilitiesInput] => [`random #${k} (seed ${37_000 + k})`, randomInput(37_000 + k)]),
];

function appResult(input: TempUtilitiesInput): ProjectResult {
    const p = createProject();
    p.calculators['temp-utilities'] = input;
    return computeProject(p);
}

/** Section sub-total row: app section J/L/M vs Excel J/L/M of the `รวม >>` row. */
function expectSection(oracle: ExcelOracle, boq: BoqResult, no: number, excelRow: number, label = ''): void {
    const s = boq.sections.find(x => x.no === no);
    expectClose(s?.matTotal, oracle.num(`${BOQ}!J${excelRow}`), `${label} section ${no} J${excelRow}`);
    expectClose(s?.labTotal, oracle.num(`${BOQ}!L${excelRow}`), `${label} section ${no} L${excelRow}`);
    expectClose(s?.total, oracle.num(`${BOQ}!M${excelRow}`), `${label} section ${no} M${excelRow}`);
}

describe('น้ำไฟชั่วคราว vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...Object.values(OUTPUT_CELLS).map(cell),
            ...['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}16`), `${BOQ}!J17`, `${BOQ}!L17`, `${BOQ}!M17`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every rounding / zero branch of the sheet', () => {
        const raw = (d: number, per: number, w: number) => Number(((d / per) * (1 + w)).toPrecision(15));
        const kinds = (i: TempUtilitiesInput) => {
            const k: string[] = [];
            for (const [name, d, per] of [['pipe', i.waterDistance, PVC_STICK_M], ['cable', i.powerDistance, CABLE_ROLL_M]] as const) {
                const r = raw(d, per, i.waste);
                k.push(r === 0 ? `${name} 0` : Number.isInteger(r) ? `${name} exact` : `${name} rounded up`);
                if ((d / per) * (1 + i.waste) !== r) k.push(`${name} float noise`);
            }
            if (i.waste === 0) k.push('waste 0');
            if (i.waterFittingsPct === 0) k.push('fittings 0');
            if (i.electricalAccPct === 0) k.push('accessories 0');
            if (Object.values(i.prices).some(v => v === 0)) k.push('a price 0');
            if (i.waterPoints === 0 || i.powerPoints === 0) k.push('points 0');
            return k;
        };
        const seen = new Set(CASES.flatMap(([, i]) => kinds(i)));
        expect([...seen].sort()).toEqual([
            'a price 0', 'accessories 0', 'cable 0', 'cable exact', 'cable float noise', 'cable rounded up', 'fittings 0',
            'pipe 0', 'pipe exact', 'pipe float noise', 'pipe rounded up', 'points 0', 'waste 0',
        ]);
        // random cases alone already hit the main branches (not only the named ones)
        const randomSeen = new Set(CASES.filter(([n]) => n.startsWith('random')).flatMap(([, i]) => kinds(i)));
        for (const k of ['pipe exact', 'pipe rounded up', 'pipe 0', 'cable exact', 'cable rounded up', 'cable 0', 'waste 0']) {
            expect(randomSeen.has(k), k).toBe(true);
        }
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['temp-utilities'] ?? {};

        // 1. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const ref = OUTPUT_CELLS[key];
            if (ref === undefined) expect.fail(`output ${key} has no Excel mapping — add it to OUTPUT_CELLS`);
            else expectClose(v, oracle.num(cell(ref)), `output ${key} (${ref})`);
        }
        expect(Object.keys(out).sort()).toEqual(Object.keys(OUTPUT_CELLS).sort());

        // 2. D3 (temp-utilities/index.ts, project-golden KNOWN_DELTAS[2]): Excel BOQ I16 is a typed 6,500, the app
        //    links C30. Before the user retypes it, R16 differs by exactly (C30 − I16) × H16 of material.
        const c30 = oracle.num(cell('C30'));
        const row = boqItem(res.boq, 'R16');
        expectClose(row?.matUnit, c30, 'app I16 = C30');
        const typedDelta = (c30 - oracle.num(`${BOQ}!I16`)) * oracle.num(`${BOQ}!H16`);
        expectClose((row?.matTotal ?? NaN) - oracle.num(`${BOQ}!J16`), typedDelta, 'J16 − D3 delta');
        expectClose(row?.labTotal, oracle.num(`${BOQ}!L16`), 'L16 (typed 1,500, not linked)');
        const s2 = res.boq.sections.find(s => s.no === 2);
        expectClose((s2?.total ?? NaN) - oracle.num(`${BOQ}!M17`), typedDelta, 'section 2 M17 − D3 delta');

        // 3. With C30 typed into I16 (what the Excel user does), BOQ row 16 and section 2 match exactly.
        oracle.setInputs({ [`${BOQ}!I16`]: c30 });
        expectBoqRow(oracle, res.boq, 'R16', 16);
        expectSection(oracle, res.boq, 2, 17);
    });
});
