// Differential test: toilet-tile compute() + BOQ section 21 vs the real Excel v5 formulas (evaluated by the oracle)
// on ~50 seeded random bathroom schedules. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// Oracle semantics (read this): I5:I15 = IF(COUNTA(E:G)=0,"",PRODUCT(IF(E=" ",1,E),IF(F=" ",1,F),IF(G=" ",1,G)) − H).
// Google Sheets (where the cached values come from) lets PRODUCT skip a blank IF(…) result, so a floor row (G blank)
// gives E·F and a wall row (E blank) gives F·G. Excel desktop returns 0 for the blank IF(…) instead, so there every
// row with a blank dimension gives 0 − H (E210 = 0, E211 = −4.6 with the sample). The app follows the cached Google
// Sheets values, and the oracle reproduces Google Sheets (`productSkipsBlankIf` in excel-oracle.ts): this test
// compares against the oracle as it is.
//
// D1 (engine.ts: "Sub-totals sum every item row of the section"): Excel's J216/L216 sum only rows 210–211 and leave
// out the water-pipe rows 213–215 of the same section (oddity O-7); M216 sums them all. The test asserts the delta.
import { beforeAll, describe, expect, it } from 'vitest';
import { isOracleError, loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { computeProject, createProject, type ProjectResult } from '../../project';
import {
    SAMPLE_OPENINGS, TOILET_TILE_ITEMS, toiletTile, toiletTileArea, type ToiletTileInput, type ToiletTileRow,
} from '.';

const SHEET = 'ปูกระเบื้องห้องน้ำ_Toilet';
const BOQ = 'BOQ (Home)';
/** Excel table rows 5–15. */
const FIRST_ROW = 5;
const EXCEL_ROWS = 11;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

// ─── Input mapping ──────────────────────────────────────────────────────────
/** F7:F8 and H7:H8 hold typed arithmetic (`=2*(2.3+3)`, `=(0.7*2)+(0.5*1.8)`), so they are inputs too. */
const INPUT_COLUMNS: readonly [keyof ToiletTileRow, string][] = [
    ['code', 'B'], ['surface', 'C'], ['item', 'D'], ['width', 'E'], ['length', 'F'], ['height', 'G'], ['openings', 'H'], ['location', 'J'],
];

function excelInputs(input: ToiletTileInput): Record<string, OracleInput> {
    if (input.rows.length > EXCEL_ROWS) throw new Error(`Excel has ${EXCEL_ROWS} toilet rows`);
    const out: Record<string, OracleInput> = {};
    for (let i = 0; i < EXCEL_ROWS; i++) {
        const r = input.rows[i];
        for (const [field, col] of INPUT_COLUMNS) {
            const v = r?.[field];
            out[at(col, i)] = v === undefined || v === '' ? null : v;
        }
    }
    return out;
}

// ─── Output mapping ─────────────────────────────────────────────────────────
function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    const direct: Record<string, string> = {
        floorArea: `${BOQ}!E210`, wallArea: `${BOQ}!E211`, R210: `${BOQ}!E210`, R211: `${BOQ}!E211`,
    };
    return direct[key] ? o.num(direct[key]) : undefined;
}

/** I of one Excel row: a number, or blank ("" — COUNTA(E:G) = 0). */
function excelArea(o: ExcelOracle, i: number): number | null {
    const v = o.get(at('I', i));
    if (v === null || v === '') return null;
    if (typeof v === 'number') return v;
    throw new Error(`I${FIRST_ROW + i} is ${isOracleError(v) ? v.error : JSON.stringify(v)}`);
}

const OWN_BOQ_ROWS = [210, 211];
/** Water-pipe rows of section 21 (sheet 06): they stay at the sample on both sides. */
const PIPE_ROWS = [213, 214, 215];
const SUBTOTAL_ROW = 216;

// ─── Random but plausible bathroom schedules ────────────────────────────────
function floorRow(rng: Random, name: string, w: number, l: number): ToiletTileRow {
    const row: ToiletTileRow = { code: 'F3', surface: 'พื้น', item: TOILET_TILE_ITEMS[0], width: w, length: l, location: name };
    if (rng.chance(0.08)) row.openings = rng.step(0.1, 0.5, 0.05);   // e.g. a shower tray left out
    return row;
}

function wallRow(rng: Random, name: string, w: number, l: number): ToiletTileRow {
    const row: ToiletTileRow = {
        code: 'P3', surface: 'ผนัง', item: TOILET_TILE_ITEMS[1],
        // perimeter 2·(W+L) as in the sample, or a length read off the plan
        length: rng.chance(0.7) ? 2 * (w + l) : rng.step(4, 14, 0.05),
        height: rng.pick([2.4, 2.4, 1.2, 1.5, 2, 2.6]),
        location: name,
    };
    const o = rng.next();
    if (o < 0.5) row.openings = SAMPLE_OPENINGS;
    else if (o < 0.85) row.openings = rng.step(0.5, 3.5, 0.05);
    if (rng.chance(0.05)) row.width = rng.step(0.5, 1, 0.05);   // a typed width on a wall row: W·L·H
    return row;
}

function randomInput(seed: number): ToiletTileInput {
    const rng = seededRandom(seed);
    const rows: ToiletTileRow[] = [];
    const bathrooms = rng.chance(0.1) ? 6 : rng.pick([1, 1, 2, 2, 3]);   // 6 bathrooms fill the 11 Excel rows
    for (let b = 0; b < bathrooms; b++) {
        const name = `ห้องน้ำ ${b + 1}`;
        const w = rng.step(1.2, 3, 0.05);
        const l = rng.step(1.5, 3.5, 0.05);
        if (rng.chance(0.9)) rows.push(floorRow(rng, name, w, l));
        if (rng.chance(0.9)) rows.push(wallRow(rng, name, w, l));
    }
    if (rows.length < EXCEL_ROWS && rng.chance(0.12)) {
        // a row with only the openings typed: COUNTA(E:G) = 0 → "" (no area)
        rows.push({ code: 'P3', surface: 'ผนัง', item: TOILET_TILE_ITEMS[1], openings: 1.4, location: 'ห้องน้ำ X' });
    }
    if (rows.length < EXCEL_ROWS && rng.chance(0.12)) {
        // a row with no code: it has an area but feeds no BOQ line
        rows.push({ code: '', surface: '', item: '', width: rng.step(1, 2, 0.05), length: rng.step(1, 2, 0.05), location: '' });
    }
    return { rows: rows.slice(0, EXCEL_ROWS) };
}

const sample = toiletTile.defaults();
const CASES: [string, ToiletTileInput][] = [
    ['Excel sample', sample],
    ['no bathrooms', { rows: [] }],
    ['every row of the Excel table (11 rows)', {
        rows: Array.from({ length: EXCEL_ROWS }, (_, i): ToiletTileRow => (i % 2 === 0
            ? { code: 'F3', surface: 'พื้น', item: TOILET_TILE_ITEMS[0], width: 1.5 + i * 0.1, length: 2 + i * 0.05, location: `ห้องน้ำ ${i}` }
            : { code: 'P3', surface: 'ผนัง', item: TOILET_TILE_ITEMS[1], length: 7 + i * 0.1, height: 2.4, openings: SAMPLE_OPENINGS, location: `ห้องน้ำ ${i - 1}` })),
    }],
    ['edge rows: openings only, zero height, openings > tiled area, W·L·H, lower-case and padded codes, no code', {
        rows: [
            { code: 'P3', surface: 'ผนัง', item: TOILET_TILE_ITEMS[1], openings: 2.3, location: 'openings only' },
            { code: 'P3', surface: 'ผนัง', item: TOILET_TILE_ITEMS[1], length: 8, height: 0, openings: 1.4, location: 'zero height' },
            { code: 'P3', surface: 'ผนัง', item: TOILET_TILE_ITEMS[1], length: 1, height: 1.2, openings: 2.3, location: 'negative' },
            { code: 'P3', surface: 'ผนัง', item: TOILET_TILE_ITEMS[1], width: 0.8, length: 4, height: 2.4, location: 'W·L·H' },
            { code: 'p3', surface: 'ผนัง', item: TOILET_TILE_ITEMS[1], length: 6, height: 2, location: 'lower case' },
            { code: 'F3 ', surface: 'พื้น', item: TOILET_TILE_ITEMS[0], width: 1.5, length: 2, location: 'trailing space' },
            { code: '', surface: '', item: '', width: 2, length: 2, location: 'no code' },
            { code: 'F3', surface: 'พื้น', item: TOILET_TILE_ITEMS[0], length: 2.5, location: 'one dimension' },
        ],
    }],
    ...Array.from({ length: 50 }, (_, k): [string, ToiletTileInput] => [`random #${k} (seed ${17_000 + k})`, randomInput(17_000 + k)]),
];

function appResult(input: ToiletTileInput): ProjectResult {
    const p = createProject();
    p.calculators['toilet-tile'] = input;
    return computeProject(p);
}

const dims = (r: ToiletTileRow) => [r.width, r.length, r.height].filter(v => v !== undefined).length;

describe('ปูกระเบื้องห้องน้ำ_Toilet vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...Array.from({ length: EXCEL_ROWS }, (_, i) => at('I', i)),
            ...[...OWN_BOQ_ROWS, ...PIPE_ROWS].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            ...['J', 'L', 'M'].map(c => `${BOQ}!${c}${SUBTOTAL_ROW}`),
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the oracle gives the Google Sheets results the workbook caches (PRODUCT skips the blank dimension)', () => {
        oracle.reset();
        for (let i = 0; i < 4; i++) {
            const cached = oracle.cached(at('I', i));
            expectClose(excelArea(oracle, i) ?? NaN, typeof cached === 'number' ? cached : NaN, `I${FIRST_ROW + i} = cached`);
        }
        expect(oracle.num(`${BOQ}!E210`)).toBeCloseTo(10.5, 9);
        expect(oracle.num(`${BOQ}!E211`)).toBeCloseTo(39.08, 9);
    });

    it('the cases cover floor / wall rows, blank and typed openings, 1–3 dimensions, blank rows, odd codes and the full table', () => {
        const has = (p: (r: ToiletTileRow) => boolean) => CASES.filter(([, input]) => input.rows.some(p)).length;
        expect(has(r => r.code === 'F3')).toBeGreaterThan(20);
        expect(has(r => r.code === 'P3')).toBeGreaterThan(20);
        expect(has(r => r.openings === undefined && dims(r) > 0)).toBeGreaterThan(20);
        expect(has(r => r.openings !== undefined && r.openings !== SAMPLE_OPENINGS && dims(r) > 0)).toBeGreaterThan(10);
        for (const n of [0, 1, 2, 3]) expect(has(r => dims(r) === n), `${n} dimensions`).toBeGreaterThan(0);
        expect(has(r => r.code === '')).toBeGreaterThan(2);
        expect(has(r => r.code !== r.code.trim().toUpperCase())).toBeGreaterThan(0);
        expect(has(r => (toiletTileArea(r) ?? 0) < 0)).toBeGreaterThan(0);
        expect(CASES.filter(([, i]) => i.rows.length === EXCEL_ROWS).length).toBeGreaterThan(1);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['toilet-tile'] ?? {};

        // 1. I of every used row (blank ↔ null), and the unused rows stay blank
        input.rows.forEach((r, i) => {
            const app = toiletTileArea(r);
            const excel = excelArea(oracle, i);
            if (app === null || excel === null) expect(app, `row ${i} I${FIRST_ROW + i} blank`).toBe(excel);
            else expectClose(app, excel, `row ${i} I${FIRST_ROW + i}`);
        });
        for (let i = input.rows.length; i < EXCEL_ROWS; i++) expect(excelArea(oracle, i), `unused I${FIRST_ROW + i}`).toBeNull();

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v, excel, `output ${key}`);
        }

        // 3. BOQ (Home) section 21: rows 210–211 (+ the water-pipe rows 213–215, unchanged)
        for (const r of [...OWN_BOQ_ROWS, ...PIPE_ROWS]) expectBoqRow(oracle, res.boq, `R${r}`, r);
        const s = res.boq.sections.find(x => x.no === 21);
        expectClose(s?.total, oracle.num(`${BOQ}!M${SUBTOTAL_ROW}`), 'M216 = SUM(M210:M215)');
        // D1: J216/L216 = SUM(J210:J211)/SUM(L210:L211) in Excel; the app's subtotals include rows 213–215.
        const pipe = (col: string) => PIPE_ROWS.reduce((t, r) => t + oracle.num(`${BOQ}!${col}${r}`), 0);
        expectClose((s?.matTotal ?? NaN) - oracle.num(`${BOQ}!J${SUBTOTAL_ROW}`), pipe('J'), 'J216 delta = ΣJ213:J215');
        expectClose((s?.labTotal ?? NaN) - oracle.num(`${BOQ}!L${SUBTOTAL_ROW}`), pipe('L'), 'L216 delta = ΣL213:L215');
    });
});
