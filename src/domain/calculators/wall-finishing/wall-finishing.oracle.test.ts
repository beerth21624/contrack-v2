// Differential test: wall-finishing compute() + BOQ section 22 (and the outputs the paint sheet reads) vs the real
// Excel v5 formulas (evaluated by the oracle) on ~50 seeded random moulding / slat schedules.
// Guide: docs/rebuild/ORACLE_TESTS.md.
//
// D1 (oddity O-2, D19; index.ts header; KNOWN_DELTAS[22] = +684 in project-golden.test.ts): Excel's E218 (บัว 0.3,
// 400/200) SUMIFs the 0.1 moulding and E219 (บัว 0.1, 180/100) the 0.3 moulding. The app swaps them back, so
// app R218 = Excel E219 and app R219 = Excel E218, priced with each row's own G/I/K. The comparison is exact
// whenever the two moulding lengths are equal (the swap is then invisible), else the delta is asserted.
//
// Excel's formula depends on the row (F = D+E only on rows 5–6, G = D*E only on rows 7–15), so a case has at most
// 2 moulding rows and 9 other rows (D5: the app takes any number; more cannot be typed into the Excel sheet).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    randomWallFinishingInput, WF_AREA_ROWS, WF_MOULDING_ROWS, WF_SHEET, wallFinishingExcelInputs, wallFinishingExcelRows,
} from '../../../test-utils/oracle-finishes';
import { boqItem, expectBoqRow, expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import { computeProject, createProject, type ProjectResult } from '../../project';
import {
    MOULDING_0_1, MOULDING_0_3, MOULDINGS, SLAT_WALL, wallFinishing, wallFinishingArea, wallFinishingKind,
    wallFinishingLength, type WallFinishingInput,
} from '.';

const BOQ = 'BOQ (Home)';

/** Σ F of one moulding item = SUMIF(WF!C:C, item, WF!F:F) (the criterion Excel's E218/E219 use, crossed). */
const mouldingSumif = (o: ExcelOracle, item: string) => {
    const v = o.evaluate(`=SUMIF('${WF_SHEET}'!C:C,"${item}",'${WF_SHEET}'!F:F)`);
    if (typeof v !== 'number') throw new Error(`SUMIF ${item}: ${JSON.stringify(v)}`);
    return v;
};

// ─── Output mapping ─────────────────────────────────────────────────────────
function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    for (const m of MOULDINGS) {
        if (key === `moulding.${m.item}` || key === `moulding.${m.key}`) return mouldingSumif(o, m.item);
    }
    if (key === 'slatWallArea' || key === 'R220') return o.num(`${BOQ}!E220`);
    // D1: the app's R218 (0.3) is Excel's E219 and R219 (0.1) is Excel's E218 (both SUMIF the other item).
    if (key === 'R218') return o.num(`${BOQ}!E219`);
    if (key === 'R219') return o.num(`${BOQ}!E218`);
    // No Excel cell: paint C11 types `=(0.5*13)+(0.3*11)` by hand (O-4, D20 not approved). Compared with the same
    // girth × Excel length (girth = face + 2 × thickness: 0.5 for บัว 0.3×0.1, 0.3 for บัว 0.1×0.1).
    if (key === 'mouldingPaintArea') return 0.5 * mouldingSumif(o, MOULDING_0_3) + 0.3 * mouldingSumif(o, MOULDING_0_1);
    return undefined;
}

// ─── Cases ──────────────────────────────────────────────────────────────────
const sample = wallFinishing.defaults();
const slat = (width: number, length: number) => ({ code: 'P4', item: SLAT_WALL, width, length, location: '' });
const CASES: [string, WallFinishingInput][] = [
    ['Excel sample (D1 swap: +684 on section 22)', sample],
    ['nothing', { rows: [] }],
    ['only the 0.3 moulding', { rows: [{ code: 'P2', item: MOULDING_0_3, width: 0, length: 17.5, location: '' }] }],
    ['only the 0.1 moulding, with a D (F = D + E)', { rows: [{ code: 'P2', item: MOULDING_0_1, width: 1.5, length: 9, location: '' }] }],
    ['both mouldings the same length (D1 swap invisible: exact)', {
        rows: [
            { code: 'P2', item: MOULDING_0_1, width: 0, length: 12, location: '' },
            { code: 'P2', item: MOULDING_0_3, width: 2, length: 10, location: '' },
        ],
    }],
    ['two rows of the same moulding', {
        rows: [
            { code: 'P1', item: MOULDING_0_3, width: 0, length: 8, location: '' },
            { code: 'P3', item: MOULDING_0_3, width: 0, length: 4.4, location: '' },
        ],
    }],
    ['every Excel row: 2 mouldings + 9 slat walls', {
        rows: [
            ...Array.from({ length: WF_AREA_ROWS.length }, (_, i) => slat(1 + i * 0.15, 2 + i * 0.35)),
            { code: 'P2', item: MOULDING_0_1, width: 0, length: 6.6, location: '' },
            { code: 'P2', item: MOULDING_0_3, width: 0, length: 21, location: '' },
        ],
    }],
    ['slat walls only; a row with no item; a padded item text', {
        rows: [slat(1.65, 2), { code: '', item: '', width: 3, length: 3, location: 'no item' }, { ...slat(1.2, 4), item: `${SLAT_WALL} ` }],
    }],
    ...Array.from({ length: 50 }, (_, k): [string, WallFinishingInput] => [`random #${k} (seed ${18_000 + k})`, randomWallFinishingInput(seededRandom(18_000 + k))]),
];

function appResult(input: WallFinishingInput): ProjectResult {
    const p = createProject();
    p.calculators['wall-finishing'] = input;
    return computeProject(p);
}

describe('ตกแต่งผนัง_Wall Finishing vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...WF_MOULDING_ROWS.map(r => `${WF_SHEET}!F${r}`), ...WF_AREA_ROWS.map(r => `${WF_SHEET}!G${r}`),
            ...[218, 219, 220].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            ...['J', 'L', 'M'].map(c => `${BOQ}!${c}221`),
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover each moulding, equal and different lengths (D1), D ≠ 0, slat rows, rows with no item and the full table', () => {
        const len = (i: WallFinishingInput, item: string) => i.rows.filter(r => r.item === item).reduce((s, r) => s + r.width + r.length, 0);
        const has = (p: (input: WallFinishingInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        expect(has(i => len(i, MOULDING_0_3) > 0 && len(i, MOULDING_0_1) === 0)).toBeGreaterThan(3);
        expect(has(i => len(i, MOULDING_0_1) > 0 && len(i, MOULDING_0_3) === 0)).toBeGreaterThan(3);
        expect(has(i => len(i, MOULDING_0_1) > 0 && len(i, MOULDING_0_3) > 0)).toBeGreaterThan(5);
        expect(has(i => len(i, MOULDING_0_1) !== len(i, MOULDING_0_3))).toBeGreaterThan(20);
        expect(has(i => len(i, MOULDING_0_1) === len(i, MOULDING_0_3) && len(i, MOULDING_0_1) > 0)).toBeGreaterThan(0);
        expect(has(i => i.rows.some(r => wallFinishingKind(r) === 'moulding' && r.width !== 0))).toBeGreaterThan(3);
        expect(has(i => i.rows.some(r => wallFinishingKind(r) === 'slat'))).toBeGreaterThan(20);
        expect(has(i => i.rows.some(r => wallFinishingKind(r) === 'other'))).toBeGreaterThan(2);
        expect(has(i => i.rows.filter(r => wallFinishingKind(r) !== 'moulding').length === WF_AREA_ROWS.length)).toBeGreaterThan(1);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(wallFinishingExcelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['wall-finishing'] ?? {};
        const rows = wallFinishingExcelRows(input);

        // 1. per row: F (moulding rows 5–6) and G (slat rows 7–15); unused rows stay 0 / blank
        input.rows.forEach((r, i) => {
            const er = rows[i] ?? 0;
            if (wallFinishingKind(r) === 'moulding') expectClose(wallFinishingLength(r) ?? NaN, oracle.num(`${WF_SHEET}!F${er}`), `row ${i} F${er}`);
            else if (wallFinishingKind(r) === 'slat') expectClose(wallFinishingArea(r) ?? NaN, oracle.num(`${WF_SHEET}!G${er}`), `row ${i} G${er}`);
            else expect(wallFinishingArea(r), `row ${i}: no item → no area (Excel G${er} matches no SUMIF)`).toBeNull();
        });
        for (const r of WF_MOULDING_ROWS.filter(x => !rows.includes(x))) expect(oracle.num(`${WF_SHEET}!F${r}`), `unused F${r}`).toBe(0);
        for (const r of WF_AREA_ROWS.filter(x => !rows.includes(x))) expect(oracle.num(`${WF_SHEET}!G${r}`), `unused G${r}`).toBe(0);

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v, excel, `output ${key}`);
        }

        // 3. BOQ (Home) section 22. R220 is exact; R218/R219 are exact unless D1's swap changes them.
        expectBoqRow(oracle, res.boq, 'R220', 220);
        const len03 = mouldingSumif(oracle, MOULDING_0_3);
        const len01 = mouldingSumif(oracle, MOULDING_0_1);
        expectClose(oracle.num(`${BOQ}!E218`), len01, 'Excel E218 sums the 0.1 moulding');
        expectClose(oracle.num(`${BOQ}!E219`), len03, 'Excel E219 sums the 0.3 moulding');
        let delta = 0;
        for (const [er, appLen, excelLen] of [[218, len03, len01], [219, len01, len03]] as const) {
            if (appLen === excelLen) { expectBoqRow(oracle, res.boq, `R${er}`, er); continue; }
            // D1: the row's own waste and prices (Excel G/I/K), applied to the other moulding's length
            const g = oracle.num(`${BOQ}!G${er}`);
            const i = oracle.num(`${BOQ}!I${er}`);
            const k = oracle.num(`${BOQ}!K${er}`);
            const row = boqItem(res.boq, `R${er}`);
            expectClose(row?.qty, appLen, `E${er} app = its own moulding`);
            expectClose(row?.grossQty ?? NaN, appLen * (1 + g), `H${er} = E×(1+G)`);
            expectClose(row?.matTotal, i * appLen * (1 + g), `J${er} = I×H`);
            expectClose(row?.labTotal, k * appLen, `L${er} = K×E`);
            const rowDelta = (i * (1 + g) + k) * (appLen - excelLen);
            expectClose((row?.total ?? NaN) - oracle.num(`${BOQ}!M${er}`), rowDelta, `M${er} delta = (I(1+G)+K)·ΔE`);
            delta += rowDelta;
        }
        const s = res.boq.sections.find(x => x.no === 22);
        const sumOf = (col: string, f: (r: ReturnType<typeof boqItem>) => number) =>
            [218, 219, 220].reduce((t, r) => t + f(boqItem(res.boq, `R${r}`)) - oracle.num(`${BOQ}!${col}${r}`), 0);
        expectClose((s?.matTotal ?? NaN) - oracle.num(`${BOQ}!J221`), sumOf('J', r => r?.matTotal ?? NaN), 'J221 − row deltas');
        expectClose((s?.labTotal ?? NaN) - oracle.num(`${BOQ}!L221`), sumOf('L', r => r?.labTotal ?? NaN), 'L221 − row deltas');
        expectClose((s?.total ?? NaN) - oracle.num(`${BOQ}!M221`), delta, 'M221 delta (D1)');
    });

    it('D1 on the Excel sample is the documented +684 (KNOWN_DELTAS[22])', () => {
        oracle.replaceInputs(wallFinishingExcelInputs(sample));
        const s = appResult(sample).boq.sections.find(x => x.no === 22);
        expect(oracle.num(`${BOQ}!M221`)).toBeCloseTo(15_693, 6);
        expectClose((s?.total ?? NaN) - oracle.num(`${BOQ}!M221`), 684, 'section 22 app − Excel');
    });
});
