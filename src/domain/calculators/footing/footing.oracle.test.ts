// Differential test: footing compute() + BOQ vs the real Excel v5 formulas (evaluated by the oracle) on ~50
// seeded random footing schedules. How to write one: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { closeTo, isOracleError, loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { REBAR_SIZES, REBAR_WASTE, TIE_WIRE_RATIO } from '../../boq/slots';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { footing, footingRow, type FootingInput, type FootingRow, type FootingRowResult } from '.';

const SHEET = 'ฐานราก_Footing';
const SUMMARY = 'ตารางสรุปวัสดุงานโครงสร้าง';
const PEDESTAL = 'เสาตอม่อ_Footing Column';
const BOQ = 'BOQ (Home)';
/** Excel table rows 8–18. */
const FIRST_ROW = 8;
const EXCEL_ROWS = 11;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

// ─── Input mapping: FootingRow field → yellow input column of the row ───────
const INPUT_COLUMNS: readonly [keyof FootingRow, string][] = [
    ['name', 'B'], ['count', 'C'], ['width', 'D'], ['length', 'E'], ['depth', 'F'], ['excavationDepth', 'H'],
    ['sandThickness', 'J'], ['leanThickness', 'L'], ['shortBarSize', 'O'], ['shortBarCount', 'P'],
    ['longBarSize', 'T'], ['longBarCount', 'U'], ['ringBarSize', 'Y'], ['ringBarCount', 'Z'],
];

/** The cells a user would type in Excel for this input (unused table rows are cleared). */
function excelInputs(input: FootingInput): Record<string, OracleInput> {
    if (input.rows.length > EXCEL_ROWS) throw new Error(`Excel has ${EXCEL_ROWS} footing rows`);
    const out: Record<string, OracleInput> = {};
    for (let i = 0; i < EXCEL_ROWS; i++) {
        const row = input.rows[i];
        for (const [field, col] of INPUT_COLUMNS) {
            const v = row?.[field];
            out[at(col, i)] = v === undefined || v === '' ? null : v;
        }
    }
    return out;
}

// ─── Output mapping ─────────────────────────────────────────────────────────
/** footingRow() field → computed column of the same Excel row. */
const ROW_OUTPUTS: readonly [keyof FootingRowResult, string][] = [
    ['excavation', 'I'], ['sand', 'K'], ['lean', 'M'],
    ['shortLength', 'Q'], ['shortTotal', 'R'], ['shortKg', 'S'],
    ['longLength', 'V'], ['longTotal', 'W'], ['longKg', 'X'],
    ['ringLength', 'AA'], ['ringTotal', 'AB'], ['ringKg', 'AC'],
    ['formwork', 'AE'], ['concrete', 'AG'],
];
/** Excel AI = I − K − M − AG − pedestal V; the app's backfillGross is AI before the pedestal concrete. */
const backfillGrossOf = (o: ExcelOracle, i: number) => o.num(at('AI', i)) + o.num(`${PEDESTAL}!V${FIRST_ROW + i}`);

/** Total row 6 per bar size (columns RB6…DB20). */
const SIZE_COLUMNS = { short: ['O', 'P', 'Q', 'R', 'S'], long: ['T', 'U', 'V', 'W', 'X'], ring: ['Y', 'Z', 'AA', 'AB', 'AC'] } as const;

/** Output keys with no Excel cell (checked against the input instead). */
const NOT_IN_EXCEL = new Set(['rows']);

/** The Excel value an output key stands for (undefined = unmapped: the test fails, so new outputs get mapped). */
function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    const direct: Record<string, string> = {
        excavation: `${SHEET}!H6`, sand: `${SHEET}!J6`, lean: `${SHEET}!L6`,
        formwork: `${SHEET}!AE6`, concrete: `${SHEET}!AG6`,
    };
    if (direct[key]) return o.num(direct[key]);
    if (key === 'backfillGross') return Array.from({ length: EXCEL_ROWS }, (_, i) => backfillGrossOf(o, i)).reduce((s, v) => s + v, 0);
    const bySize = /^(short|long|ring|rebar)\.(RB6|RB9|DB12|DB16|DB20)$/.exec(key);
    if (bySize?.[1] && bySize[2]) {
        const k = REBAR_SIZES.indexOf(bySize[2] as typeof REBAR_SIZES[number]);
        if (bySize[1] === 'rebar') return o.num(`${SUMMARY}!${'IJKLM'.charAt(k)}6`);   // sheet 24 row 6
        return o.num(`${SHEET}!${SIZE_COLUMNS[bySize[1] as keyof typeof SIZE_COLUMNS][k] ?? ''}6`);
    }
    const perRow = /^row\.(\d+)\.(width|depth|backfillGross)$/.exec(key);
    if (perRow?.[1] && perRow[2]) {
        const i = Number(perRow[1]);
        if (perRow[2] === 'width') return o.num(at('D', i));
        if (perRow[2] === 'depth') return o.num(at('F', i));
        return backfillGrossOf(o, i);
    }
    return undefined;
}

/** BOQ (Home) rows the footing sheet feeds directly (plus ไม้คร่าว/ตะปู derived from ไม้แบบ, and R68 via pedestal). */
const BOQ_ROWS = [38, 40, 41, 55, 56, 57, 58, 68] as const;

// ─── Random but plausible footing schedules ─────────────────────────────────
const NAMES = ['F1', 'F2', 'F4'];

function randomRow(rng: Random, i: number): FootingRow {
    const mainBar = () => (rng.chance(0.75) ? 'DB12' : rng.pick(['DB16', 'DB20', 'RB9']));
    return {
        name: NAMES[i] ?? '',
        count: rng.int(1, 30),
        width: rng.step(0.5, 2.5, 0.05),
        length: rng.step(0.5, 2.5, 0.05),
        depth: rng.step(0.25, 0.8, 0.05),
        excavationDepth: rng.step(0.8, 2.0, 0.05),
        sandThickness: rng.pick([0.05, 0.05, 0.1, 0]),
        leanThickness: rng.pick([0.05, 0.05, 0.1]),
        shortBarSize: mainBar(), shortBarCount: rng.int(3, 12),
        longBarSize: mainBar(), longBarCount: rng.int(3, 12),
        ringBarSize: rng.chance(0.8) ? 'RB9' : rng.pick(['RB6', 'DB12']), ringBarCount: rng.int(1, 4),
    };
}

function randomInput(seed: number): FootingInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.05) ? EXCEL_ROWS : rng.pick([1, 1, 2, 2, 3, 4]);
    return { rows: Array.from({ length: n }, (_, i) => randomRow(rng, i)) };
}

const sample = footing.defaults();
const sampleRow = sample.rows[0] ?? randomRow(seededRandom(1), 0);
const CASES: [string, FootingInput][] = [
    ['Excel sample', sample],
    ['one bar size only (all DB12)', { rows: [{ ...sampleRow, ringBarSize: 'DB12' }] }],
    ['three bar sizes (RB6 ring, DB12, DB16)', { rows: [{ ...sampleRow, ringBarSize: 'RB6', longBarSize: 'DB16' }] }],
    ['RB6 + DB12 (Excel row 43 keeps 9 % waste)', { rows: [{ ...sampleRow, ringBarSize: 'RB6' }] }],
    ...Array.from({ length: 50 }, (_, k): [string, FootingInput] => [`random #${k} (seed ${20261026 + k})`, randomInput(20261026 + k)]),
];

function appResult(input: FootingInput): ProjectResult {
    const p = createProject();
    p.calculators.footing = input;
    return computeProject(p);
}

describe('ฐานราก_Footing vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['H6', 'J6', 'L6', 'AE6', 'AG6', 'AI6', 'O6', 'S6', 'Y6', 'AC6'].map(c => `${SHEET}!${c}`),
            `${SUMMARY}!I6`, `${SUMMARY}!M6`,
            ...BOQ_ROWS.flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!M43`, `${BOQ}!M44`, `${BOQ}!M45`, `${BOQ}!M59`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs.footing ?? {};

        // 1. every computed cell of every used row (columns I…AG), and the unused rows stay 0
        input.rows.forEach((row, i) => {
            const r = footingRow(row);
            for (const [field, col] of ROW_OUTPUTS) expectClose(r[field], oracle.num(at(col, i)), `row ${i} ${col}${FIRST_ROW + i} ${field}`);
            expectClose(r.backfillGross, backfillGrossOf(oracle, i), `row ${i} AI+pedestal V`);
        });
        for (let i = input.rows.length; i < EXCEL_ROWS; i++) expect(oracle.num(at('I', i)), `unused row ${FIRST_ROW + i}`).toBe(0);

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            if (NOT_IN_EXCEL.has(key)) continue;
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping — add it to excelValueOf or NOT_IN_EXCEL`);
            else expectClose(v, excel, `output ${key}`);
        }
        expect(out.rows).toBe(input.rows.length);

        // 3. BOQ (Home) rows fed by the sheet: E, H, J, L, M
        for (const r of BOQ_ROWS) expectBoqRow(oracle, res.boq, `R${r}`, r);

        // 4. rebar slot 6.5 (Excel R43–R45) and the section 6 subtotal (Excel J59/L59/M59)
        const sizes = REBAR_SIZES.filter(s => (out[`rebar.${s}`] ?? 0) > 0);
        const slot = (k: string) => boqItem(res.boq, `footing:rebar:${k}`);
        const appBlock = [...sizes, 'tie-wire'].reduce((s, k) => s + (slot(k)?.total ?? 0), 0);
        const excelBlock = [43, 44, 45].reduce((s, r) => s + oracle.num(`${BOQ}!M${r}`), 0);
        if (sizes.length <= 2) {
            sizes.forEach((size, k) => {
                const er = 43 + k;
                const row = slot(size);
                const qty = oracle.num(`${BOQ}!E${er}`);
                expect(oracle.get(`${BOQ}!D${er}`)).toBe(`- เหล็ก ${size}`);
                expectClose(row?.qty, qty, `E${er} ${size}`);
                expectClose(row?.labTotal, oracle.num(`${BOQ}!L${er}`), `L${er} ${size}`);
                const excelWaste = oracle.num(`${BOQ}!G${er}`);
                if (closeTo(excelWaste, REBAR_WASTE[size])) {
                    expectBoqRow(oracle, res.boq, `footing:rebar:${size}`, er);
                } else {
                    // D5/D12: the app gives each bar size its own waste (RB6 6 %, RB9 9 %, DB12–DB20 12 %); Excel's
                    // fixed rows keep the waste typed for the sample's bar in that position (G43 9 %, G44 12 %).
                    expectClose(row?.grossQty ?? NaN, qty * (1 + REBAR_WASTE[size]), `H${er} app (per-size waste)`);
                    expectClose(oracle.num(`${BOQ}!H${er}`), qty * (1 + excelWaste), `H${er} Excel (per-row waste)`);
                    expectClose((row?.matTotal ?? NaN) - oracle.num(`${BOQ}!J${er}`), qty * (REBAR_WASTE[size] - excelWaste) * 25, `J${er} delta`);
                }
            });
            // tie wire: 3 % of the gross rebar of the block, ×50 ฿ (Excel H45 = (H43+H44)·3 %)
            const appGross = sizes.reduce((s, k) => s + (slot(k)?.grossQty ?? 0), 0);
            if (sizes.length) expectClose(slot('tie-wire')?.grossQty ?? NaN, appGross * TIE_WIRE_RATIO, 'app tie wire');
            expectClose(oracle.num(`${BOQ}!H45`), (oracle.num(`${BOQ}!H43`) + oracle.num(`${BOQ}!H44`)) * TIE_WIRE_RATIO, 'Excel H45');
            if (sizes.every((s, k) => closeTo(oracle.num(`${BOQ}!G${43 + k}`), REBAR_WASTE[s]))) {
                expectClose(appBlock, excelBlock, 'rebar block M43:M45');
            }
        } else {
            // D5: Excel has two rebar rows here; a third size makes the FILTER spill fail (#SPILL! — Google Sheets
            // shows #REF!), E43/E44 fall back to 0 and the footing rebar drops out of the Excel BOQ. The app adds one
            // BOQ row per size (unlimited slot) and still matches the per-size weights of sheet 24 (checked above).
            const d43 = oracle.get(`${BOQ}!D43`);
            expect(isOracleError(d43) && d43.error).toBe('#SPILL!');
            expect(excelBlock).toBe(0);
            expect(appBlock).toBeGreaterThan(0);
        }
        // Section 6 differs from Excel by exactly the rebar-block difference (0 whenever the block matches).
        const s6 = res.boq.sections.find(s => s.no === 6);
        expectClose((s6?.total ?? NaN) - oracle.num(`${BOQ}!M59`), appBlock - excelBlock, 'section 6 M59 − rebar delta');
        const appMat = [...sizes, 'tie-wire'].reduce((s, k) => s + (slot(k)?.matTotal ?? 0), 0);
        const excelMat = [43, 44, 45].reduce((s, r) => s + oracle.num(`${BOQ}!J${r}`), 0);
        expectClose((s6?.matTotal ?? NaN) - oracle.num(`${BOQ}!J59`), appMat - excelMat, 'section 6 J59 − rebar delta');
    });

    it('the cases cover every rebar layout of BOQ 6.5 and the full 11-row Excel table', () => {
        const layout = (input: FootingInput) => {
            const out = footing.compute(input, { outputs: () => undefined });
            const sizes = REBAR_SIZES.filter(s => (out[`rebar.${s}`] ?? 0) > 0);
            if (sizes.length > 2) return '3+ sizes (Excel #SPILL!)';
            const sampleWaste = [0.09, 0.12];   // Excel G43, G44
            return sizes.every((s, k) => REBAR_WASTE[s] === sampleWaste[k]) ? `${sizes.length} size(s), Excel waste` : `${sizes.length} size(s), per-size waste differs`;
        };
        const seen = new Set(CASES.map(([, input]) => layout(input)));
        expect([...seen].sort()).toEqual([
            '1 size(s), Excel waste', '1 size(s), per-size waste differs', '2 size(s), Excel waste',
            '2 size(s), per-size waste differs', '3+ sizes (Excel #SPILL!)',
        ]);
        expect(CASES.some(([, input]) => input.rows.length === EXCEL_ROWS)).toBe(true);
    });

    it('D1: no footing at all — Excel still orders MAX(1, …) = 1 m³ of structural concrete (R58), the app 0', () => {
        const input: FootingInput = { rows: [] };
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        for (const r of [38, 40, 41, 55, 56, 57]) expectBoqRow(oracle, res.boq, `R${r}`, r, 'empty');
        expect(oracle.num(`${BOQ}!E58`)).toBe(0);
        expect(oracle.num(`${BOQ}!H58`)).toBe(1);                       // MAX(1, CEILING(0, 0.25))
        const r58 = boqItem(res.boq, 'R58');
        expect(r58?.grossQty).toBe(0);                                  // engine.ts: "no quantity stays 0 (D1)"
        expectClose((r58?.total ?? NaN) - oracle.num(`${BOQ}!M58`), -oracle.num(`${BOQ}!I58`), 'R58 delta = −1 m³ × I58');
    });
});
