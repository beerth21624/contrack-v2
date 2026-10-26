// Differential test: floor-tile compute() + BOQ section 20 vs the real Excel v5 formulas (evaluated by the oracle)
// on ~50 seeded random room schedules. Guide: docs/rebuild/ORACLE_TESTS.md.
// No D1/D5 delta applies to this sheet: every comparison is exact.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { computeProject, createProject, type ProjectResult } from '../../project';
import {
    floorTile, floorTileRowArea, FLOOR_TILE_CODES, FLOOR_TILE_DESCRIPTIONS, STAIR_RUN,
    type FloorTileInput, type FloorTileRow,
} from '.';

const SHEET = 'ปูกระเบื้องพื้น_Floor Tile';
const BOQ = 'BOQ (Home)';
/** Excel table rows 5–34 (every F is D*E). */
const FIRST_ROW = 5;
const EXCEL_ROWS = 30;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

// ─── Input mapping ──────────────────────────────────────────────────────────
/** E20:E22 hold the typed arithmetic `=0.9+0.45` (no cell refs), so they are inputs like the other E cells. */
function excelInputs(input: FloorTileInput): Record<string, OracleInput> {
    if (input.rows.length > EXCEL_ROWS) throw new Error(`Excel has ${EXCEL_ROWS} floor-tile rows`);
    const out: Record<string, OracleInput> = {};
    for (let i = 0; i < EXCEL_ROWS; i++) {
        const r = input.rows[i];
        out[at('B', i)] = r && r.code !== '' ? r.code : null;
        // C is informational (no formula reads it); written as the description of the code
        out[at('C', i)] = r && r.code !== '' ? FLOOR_TILE_DESCRIPTIONS[r.code] : null;
        out[at('D', i)] = r ? r.width : null;
        out[at('E', i)] = r ? r.length : null;
        out[at('G', i)] = r && r.location !== '' ? r.location : null;
    }
    return out;
}

// ─── Output mapping ─────────────────────────────────────────────────────────
const CODE_ROW: Record<string, number> = { F1: 205, F3: 206, F4: 207 };

function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    if (key in CODE_ROW) return o.num(`${BOQ}!E${CODE_ROW[key] ?? 0}`);
    const line = /^R(205|206|207)$/.exec(key);
    if (line?.[1]) return o.num(`${BOQ}!E${line[1]}`);
    if (key === 'total') return Array.from({ length: EXCEL_ROWS }, (_, i) => o.num(at('F', i))).reduce((s, v) => s + v, 0);
    return undefined;
}

const BOQ_ROWS = [205, 206, 207];
const SUBTOTAL_ROW = 208;

// ─── Random but plausible room schedules ────────────────────────────────────
function randomRow(rng: Random): FloorTileRow {
    const stair = rng.chance(0.1);
    return {
        code: rng.chance(0.08) ? '' : rng.pick(FLOOR_TILE_CODES),
        width: rng.chance(0.04) ? 0 : rng.step(0.8, 6, 0.05),
        length: stair ? STAIR_RUN : rng.step(0.8, 8, 0.05),
        location: rng.pick(['ห้องนอน', 'ครัว', 'เฉลียง', 'บันได', 'ดาดฟ้า', '']),
    };
}

function randomInput(seed: number): FloorTileInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.05) ? EXCEL_ROWS : rng.pick([1, 2, 3, 5, 8, 12, 21]);
    return { rows: Array.from({ length: n }, () => randomRow(rng)) };
}

const CASES: [string, FloorTileInput][] = [
    ['Excel sample', floorTile.defaults()],
    ['no rooms', { rows: [] }],
    ['every row of the Excel table (30 rows)', {
        rows: Array.from({ length: EXCEL_ROWS }, (_, i): FloorTileRow => ({
            code: FLOOR_TILE_CODES[i % 3] ?? 'F1', width: 1 + i * 0.1, length: i % 5 === 0 ? STAIR_RUN : 2 + i * 0.05, location: `ห้อง ${i + 1}`,
        })),
    }],
    ['rows with no code, zero width and only one code', {
        rows: [
            { code: '', width: 4, length: 5, location: 'ยังไม่เลือก' },
            { code: 'F4', width: 0, length: 5, location: 'ดาดฟ้า' },
            { code: 'F4', width: 3.35, length: 4.15, location: 'ดาดฟ้า' },
        ],
    }],
    ...Array.from({ length: 50 }, (_, k): [string, FloorTileInput] => [`random #${k} (seed ${16_000 + k})`, randomInput(16_000 + k)]),
];

function appResult(input: FloorTileInput): ProjectResult {
    const p = createProject();
    p.calculators['floor-tile'] = input;
    return computeProject(p);
}

describe('ปูกระเบื้องพื้น_Floor Tile vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...Array.from({ length: EXCEL_ROWS }, (_, i) => at('F', i)),
            ...BOQ_ROWS.flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            ...['J', 'L', 'M'].map(c => `${BOQ}!${c}${SUBTOTAL_ROW}`),
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every code, blank codes, stair runs, zero widths, an absent code and the full table', () => {
        const has = (p: (input: FloorTileInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        for (const c of FLOOR_TILE_CODES) {
            expect(has(i => i.rows.some(r => r.code === c)), c).toBeGreaterThan(10);
            expect(has(i => i.rows.length > 0 && !i.rows.some(r => r.code === c)), `no ${c}`).toBeGreaterThan(2);
        }
        expect(has(i => i.rows.some(r => r.code === ''))).toBeGreaterThan(3);
        expect(has(i => i.rows.some(r => r.length === STAIR_RUN))).toBeGreaterThan(5);
        expect(has(i => i.rows.some(r => r.width === 0))).toBeGreaterThan(2);
        expect(has(i => i.rows.length === EXCEL_ROWS)).toBeGreaterThan(1);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['floor-tile'] ?? {};

        // 1. F of every used row, and the unused rows stay 0
        input.rows.forEach((r, i) => expectClose(floorTileRowArea(r), oracle.num(at('F', i)), `row ${i} F${FIRST_ROW + i}`));
        for (let i = input.rows.length; i < EXCEL_ROWS; i++) expect(oracle.num(at('F', i)), `unused F${FIRST_ROW + i}`).toBe(0);

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v, excel, `output ${key}`);
        }

        // 3. BOQ (Home) section 20: rows 205–207 and the subtotal row 208
        for (const r of BOQ_ROWS) expectBoqRow(oracle, res.boq, `R${r}`, r);
        const s = res.boq.sections.find(x => x.no === 20);
        expectClose(s?.matTotal, oracle.num(`${BOQ}!J${SUBTOTAL_ROW}`), 'J208');
        expectClose(s?.labTotal, oracle.num(`${BOQ}!L${SUBTOTAL_ROW}`), 'L208');
        expectClose(s?.total, oracle.num(`${BOQ}!M${SUBTOTAL_ROW}`), 'M208');
    });
});
