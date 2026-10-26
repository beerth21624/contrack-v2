// Differential test: piles (งานเสาเข็ม) vs the Excel v5 workbook (evaluated by the oracle) on ~50 seeded random
// inputs + named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// Excel has no calculator sheet for section 5: the inputs ARE BOQ (Home) E35 (piles) and K35 (lump price per pile,
// labour column), so they map straight onto those cells. Compared: the outputs (= E35 / K35), BOQ row 35, row 39
// ตัดหัวเสาเข็ม (E39 = E35), section 5 (J36/L36/M36) and section 6 (J59/L59/M59, which holds row 39; every other
// structure calculator stays at its Excel sample on both sides). The spec fields only compose the note N35 (text):
// the Excel sample note is compared verbatim; other notes have no Excel counterpart (free text typed in N35).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import type { BoqResult } from '../../boq/types';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { composePileSpec, PILE_SECTION_GROUPS, PILE_TYPES, piles, type PilesInput } from '.';

const BOQ = 'BOQ (Home)';

function excelInputs(input: PilesInput): Record<string, OracleInput> {
    return { [`${BOQ}!E35`]: input.count, [`${BOQ}!K35`]: input.pricePerPile };
}

/** Every key compute() returns → its Excel cell. */
const OUTPUT_CELLS: Record<string, string> = { count: `${BOQ}!E35`, pricePerPile: `${BOQ}!K35` };

// ─── Random but plausible pile specs ────────────────────────────────────────
const SECTIONS = PILE_SECTION_GROUPS.flatMap(g => g.options);

function randomInput(seed: number): PilesInput {
    const rng = seededRandom(seed);
    return {
        pileType: rng.pick(PILE_TYPES),
        section: rng.pick(SECTIONS),
        length: rng.step(3, 21, 0.5),
        count: rng.chance(0.08) ? 0 : rng.int(4, 80),
        pricePerPile: rng.chance(0.15) ? 2500 : rng.step(800, 12000, 50),
        extraSpec: rng.chance(0.2) ? 'รับน้ำหนัก 20 ตัน/ต้น' : '',
    };
}

const sample = piles.defaults();
const CASES: [string, PilesInput][] = [
    ['Excel sample (21 × 2,500)', sample],
    ['zeros (no piles, price 0)', { ...sample, count: 0, pricePerPile: 0 }],
    ['no piles at the Excel price', { ...sample, count: 0 }],
    ['large values (400 piles × 25,000)', { ...sample, count: 400, pricePerPile: 25000 }],
    ['fractional values (21.5 × 2,499.75)', { ...sample, count: 21.5, pricePerPile: 2499.75 }],
    ['empty spec (count and price only)', { ...sample, pileType: '', section: '', length: 0 }],
    ...Array.from({ length: 50 }, (_, k): [string, PilesInput] => [`random #${k} (seed ${5_000 + k})`, randomInput(5_000 + k)]),
];

function appResult(input: PilesInput): ProjectResult {
    const p = createProject();
    p.calculators.piles = input;
    return computeProject(p);
}

function expectSection(oracle: ExcelOracle, boq: BoqResult, no: number, excelRow: number, label = ''): void {
    const s = boq.sections.find(x => x.no === no);
    expectClose(s?.matTotal, oracle.num(`${BOQ}!J${excelRow}`), `${label} section ${no} J${excelRow}`);
    expectClose(s?.labTotal, oracle.num(`${BOQ}!L${excelRow}`), `${label} section ${no} L${excelRow}`);
    expectClose(s?.total, oracle.num(`${BOQ}!M${excelRow}`), `${label} section ${no} M${excelRow}`);
}

describe('งานเสาเข็ม vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live; E39 reads E35', () => {
        oracle.reset();
        const refs = [
            ...[35, 39].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            ...[36, 59].flatMap(r => ['J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        expect(oracle.formula(`${BOQ}!E39`)).toBe('E35');
    });

    it('the Excel sample spec composes the Excel note N35 verbatim', () => {
        oracle.reset();
        expect(composePileSpec(sample)).toBe(oracle.get(`${BOQ}!N35`));
        expect(boqItem(appResult(sample).boq, 'R35')?.note).toBe(oracle.get(`${BOQ}!N35`));
    });

    it('the cases cover 0 piles, the Excel price, other prices and fractional values', () => {
        const has = (p: (i: PilesInput) => boolean) => CASES.filter(([, i]) => p(i)).length;
        expect(has(i => i.count === 0)).toBeGreaterThan(2);
        expect(has(i => i.pricePerPile === 2500)).toBeGreaterThan(4);
        expect(has(i => i.pricePerPile !== 2500)).toBeGreaterThan(20);
        expect(has(i => !Number.isInteger(i.count) || !Number.isInteger(i.pricePerPile))).toBeGreaterThan(0);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs.piles ?? {};
        for (const [key, v] of Object.entries(out)) {
            const ref = OUTPUT_CELLS[key];
            if (ref === undefined) expect.fail(`output ${key} has no Excel mapping — add it to OUTPUT_CELLS`);
            else expectClose(v, oracle.num(ref), `output ${key} (${ref})`);
        }
        expect(Object.keys(out).sort()).toEqual(Object.keys(OUTPUT_CELLS).sort());
        expectBoqRow(oracle, res.boq, 'R35', 35);
        expectBoqRow(oracle, res.boq, 'R39', 39);
        expectSection(oracle, res.boq, 5, 36);
        expectSection(oracle, res.boq, 6, 59);
        expect(boqItem(res.boq, 'R35')?.note).toBe(composePileSpec(input));
    });
});
