// Differential test: ถมดิน compute() + BOQ row 13 / section 1 vs the real Excel v5 formulas (evaluated by the
// oracle) on ~50 seeded random plots + named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import type { BoqLineOverride, BoqResult } from '../../boq/types';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { fill, type FillInput } from '.';

const SHEET = 'ถมดิน';
const BOQ = 'BOQ (Home)';

// ─── Input mapping ──────────────────────────────────────────────────────────
// Sheet 34 has no yellow cells: D4:D7 (white "theme0") are the inputs. `material` has no cell on the sheet; it is
// the BOQ note N13 (deck p7), typed text there.
const INPUT_CELLS: readonly [keyof FillInput, string][] = [
    ['width', 'D4'], ['length', 'D5'], ['height', 'D6'], ['settlementPct', 'D7'], ['material', `N13`],
];

/**
 * One case: the fill input plus, optionally, prices / waste typed on BOQ row 13 (Excel I13 / K13 / G13 = app
 * boqOverrides.R13). The sample row has I13 = K13 = 0 (customer supplies the fill), which would leave J/L/M at 0;
 * typed prices make H13 (waste) and the material-on-gross / labour-on-net bases visible.
 */
interface FillCase { input: FillInput; boq?: { mat: number; lab: number; waste?: number } }

function excelInputs({ input, boq }: FillCase): Record<string, OracleInput> {
    const out: Record<string, OracleInput> = {};
    for (const [field, c] of INPUT_CELLS) {
        const ref = c === 'N13' ? `${BOQ}!N13` : `${SHEET}!${c}`;
        const v = input[field];
        out[ref] = v === '' ? null : v;
    }
    if (boq) {
        out[`${BOQ}!I13`] = boq.mat;
        out[`${BOQ}!K13`] = boq.lab;
        if (boq.waste !== undefined) out[`${BOQ}!G13`] = boq.waste;
    }
    return out;
}

/** Every key compute() returns → its Excel cell. */
const OUTPUT_CELLS: Record<string, string> = { volume: `${SHEET}!D9` };

// ─── Random but plausible plots ─────────────────────────────────────────────
const MATERIALS = ['ลูกค้าจัดหาเอง', 'ดินถมทั่วไป', 'ดินลูกรัง', 'ทรายถม', ''];

function randomCase(seed: number): FillCase {
    const rng = seededRandom(seed);
    const input: FillInput = {
        width: rng.step(5, 60, 0.5),
        length: rng.step(5, 80, 0.5),
        height: rng.chance(0.1) ? 0 : rng.step(0.1, 1.5, 0.05),
        settlementPct: rng.pick([30, 30, 30, 20, 25, 0, 15, 40, 12.5]),
        material: rng.pick(MATERIALS),
    };
    return rng.chance(0.5)
        ? { input }
        : { input, boq: { mat: rng.step(150, 600, 10), lab: rng.step(0, 120, 5), waste: rng.chance(0.5) ? undefined : rng.pick([0, 0.05, 0.15]) } };
}

const sample = fill.defaults();
const CASES: [string, FillCase][] = [
    ['Excel sample', { input: sample }],
    ['zeros (no plot)', { input: { width: 0, length: 0, height: 0, settlementPct: 0, material: '' } }],
    ['no fill height', { input: { ...sample, height: 0 } }],
    ['no settlement allowance (0 %)', { input: { ...sample, settlementPct: 0 } }],
    ['large values (100 × 200 m, 2.5 m high, 50 %)', { input: { ...sample, width: 100, length: 200, height: 2.5, settlementPct: 50 } }],
    ['fractional values (17.35 × 23.8 m, 0.37 m, 27.5 %)', { input: { ...sample, width: 17.35, length: 23.8, height: 0.37, settlementPct: 27.5 } }],
    ['typed BOQ prices and waste on row 13', { input: sample, boq: { mat: 350, lab: 80, waste: 0.05 } }],
    ...Array.from({ length: 50 }, (_, k): [string, FillCase] => [`random #${k} (seed ${34_000 + k})`, randomCase(34_000 + k)]),
];

function appResult({ input, boq }: FillCase): ProjectResult {
    const p = createProject();
    p.calculators.fill = input;
    if (boq) {
        const ov: BoqLineOverride = { mat: boq.mat, lab: boq.lab };
        if (boq.waste !== undefined) ov.waste = boq.waste;
        p.boqOverrides.R13 = ov;
    }
    return computeProject(p);
}

function expectSection(oracle: ExcelOracle, boq: BoqResult, no: number, excelRow: number, label = ''): void {
    const s = boq.sections.find(x => x.no === no);
    expectClose(s?.matTotal, oracle.num(`${BOQ}!J${excelRow}`), `${label} section ${no} J${excelRow}`);
    expectClose(s?.labTotal, oracle.num(`${BOQ}!L${excelRow}`), `${label} section ${no} L${excelRow}`);
    expectClose(s?.total, oracle.num(`${BOQ}!M${excelRow}`), `${label} section ${no} M${excelRow}`);
}

describe('ถมดิน vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            `${SHEET}!D9`,
            ...[12, 13].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!J14`, `${BOQ}!L14`, `${BOQ}!M14`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        // E13 really is the link to the sheet (no D3 retype needed for this row)
        expect(oracle.formula(`${BOQ}!E13`)).toBe("'ถมดิน'!D9");
    });

    it('the cases cover zero height / settlement, fractional %, typed BOQ prices and waste', () => {
        const has = (p: (c: FillCase) => boolean) => CASES.filter(([, c]) => p(c)).length;
        expect(has(c => c.input.height === 0)).toBeGreaterThan(1);
        expect(has(c => c.input.settlementPct === 0)).toBeGreaterThan(1);
        expect(has(c => !Number.isInteger(c.input.settlementPct))).toBeGreaterThan(1);
        expect(has(c => c.boq !== undefined)).toBeGreaterThan(10);
        expect(has(c => c.boq?.waste !== undefined)).toBeGreaterThan(3);
        expect(has(c => c.boq === undefined && c.input.height > 0)).toBeGreaterThan(10);
    });

    it.each(CASES)('%s', (_name, c) => {
        oracle.replaceInputs(excelInputs(c));
        const res = appResult(c);
        const out = res.calcOutputs.fill ?? {};

        // 1. every output of compute()
        for (const [key, v] of Object.entries(out)) {
            const ref = OUTPUT_CELLS[key];
            if (ref === undefined) expect.fail(`output ${key} has no Excel mapping — add it to OUTPUT_CELLS`);
            else expectClose(v, oracle.num(ref), `output ${key} (${ref})`);
        }
        expect(Object.keys(out).sort()).toEqual(Object.keys(OUTPUT_CELLS).sort());

        // 2. BOQ row 13 (E13 = 'ถมดิน'!D9 is linked in Excel too) and its note N13 = the fill material
        expectBoqRow(oracle, res.boq, 'R13', 13);
        const note = oracle.get(`${BOQ}!N13`);
        expect(boqItem(res.boq, 'R13')?.note ?? '').toBe(note ?? '');

        // 3. Section 1. Excel J14/L14/M14 = SUM(row 13) only; the app sums R12 + R13 (D1). Demolition stays at its
        //    Excel sample (no work: R12 = 0 on both sides), so the sub-total matches exactly.
        expectBoqRow(oracle, res.boq, 'R12', 12);
        expectSection(oracle, res.boq, 1, 14);
    });
});
