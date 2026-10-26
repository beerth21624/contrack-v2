// Differential test: site-camp (แคมป์คนงาน / ห้องน้ำ / ห้องอาบน้ำ / สโตร์) vs the Excel v5 workbook (evaluated by the
// oracle) on ~50 seeded random inputs + named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// What can and cannot be compared:
//   - The calculator itself is an external Google Sheet that was not supplied (decision D8); the app rebuilds it
//     from the deck p16 screenshot. The workbook has NO cell for the take-off (ปริมาณคำนวณ, ปริมาณรวมเผื่อ, รวมวัสดุ),
//     the group totals, the 20 % labour or the per-room prices, so those outputs cannot be compared with Excel
//     (they are checked against the screenshot values in site-camp.test.ts). They are listed in NOT_IN_EXCEL.
//   - What reaches the workbook is compared: the room counts feed BOQ E19:E22 (D3: typed in Excel, linked in the
//     app). Each case asserts the D3 delta (rooms − typed E) × (I × (1+G) + K) first, then types the counts into
//     E19:E22 like a user and compares rows 19–29 and section 3 (J30/L30/M30) exactly. The BOQ prices I/K stay the
//     typed Excel values on both sides — random take-off recipes and prices must not leak into the BOQ.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import type { BoqResult } from '../../boq/types';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { CAMP_GROUPS, siteCamp, type SiteCampInput } from '.';

const BOQ = 'BOQ (Home)';
/** Room count input → BOQ (Home) row whose E it feeds. */
const ROOM_ROWS = CAMP_GROUPS.map(g => ({ field: g.rooms, line: g.boqLine, row: Number(g.boqLine.slice(1)) }));
/** Section 3 item rows (19–29) and its sub-total row 30. */
const SECTION_ROWS = Array.from({ length: 11 }, (_, i) => 19 + i);

/** The cells a user would type in Excel: only the room counts exist there (E19:E22). */
function excelInputs(input: SiteCampInput): Record<string, OracleInput> {
    return Object.fromEntries(ROOM_ROWS.map(r => [`${BOQ}!E${r.row}`, input[r.field]]));
}

/** Outputs with no Excel cell (D8: the external sheet is not in the workbook). */
const NOT_IN_EXCEL = /^(mat|lab|matPerRoom|labPerRoom)_(camp|toilet|shower|store)$|^(materialTotal|labour|total)$/;

// ─── Random but plausible camps ─────────────────────────────────────────────
function randomInput(seed: number): SiteCampInput {
    const rng = seededRandom(seed);
    const base = siteCamp.defaults();
    const rooms = (sampleCount: number, max: number) => (rng.chance(0.15) ? 0 : rng.chance(0.2) ? sampleCount : rng.int(1, max));
    return {
        workerRooms: rooms(4, 10),
        toilets: rooms(2, 5),
        showers: rooms(1, 4),
        stores: rooms(1, 3),
        waste: rng.pick([0.05, 0.05, 0, 0.1, 0.07]),
        labourRate: rng.pick([0.2, 0.2, 0.15, 0.3, 0]),
        // a different recipe (drop rows, change prices) must not change the BOQ
        materials: base.materials
            .filter(() => rng.chance(0.85))
            .map(l => (rng.chance(0.3) ? { ...l, unitPrice: rng.step(l.unitPrice * 0.5, l.unitPrice * 2, 5) } : l)),
    };
}

const sample = siteCamp.defaults();
const CASES: [string, SiteCampInput][] = [
    ['Excel sample (4 / 2 / 1 / 1 rooms)', sample],
    ['zeros (no rooms at all)', { ...sample, workerRooms: 0, toilets: 0, showers: 0, stores: 0 }],
    ['empty take-off table', { ...sample, materials: [] }],
    ['large values (40 / 20 / 10 / 8 rooms)', { ...sample, workerRooms: 40, toilets: 20, showers: 10, stores: 8 }],
    ['fractional counts (2.5 / 1.5 / 0.5 / 1.25 rooms)', { ...sample, workerRooms: 2.5, toilets: 1.5, showers: 0.5, stores: 1.25 }],
    ['only the worker rooms differ (6)', { ...sample, workerRooms: 6 }],
    ...Array.from({ length: 50 }, (_, k): [string, SiteCampInput] => [`random #${k} (seed ${3_000 + k})`, randomInput(3_000 + k)]),
];

function appResult(input: SiteCampInput): ProjectResult {
    const p = createProject();
    p.calculators['site-camp'] = input;
    return computeProject(p);
}

function expectSection(oracle: ExcelOracle, boq: BoqResult, no: number, excelRow: number, label = ''): void {
    const s = boq.sections.find(x => x.no === no);
    expectClose(s?.matTotal, oracle.num(`${BOQ}!J${excelRow}`), `${label} section ${no} J${excelRow}`);
    expectClose(s?.labTotal, oracle.num(`${BOQ}!L${excelRow}`), `${label} section ${no} L${excelRow}`);
    expectClose(s?.total, oracle.num(`${BOQ}!M${excelRow}`), `${label} section ${no} M${excelRow}`);
}

describe('site-camp vs Excel (oracle) — BOQ section 3 only (D8: the external sheet is not in the workbook)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live; E19:E22 are typed inputs (D3)', () => {
        oracle.reset();
        const refs = [...SECTION_ROWS.flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)), `${BOQ}!J30`, `${BOQ}!L30`, `${BOQ}!M30`];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        for (const r of ROOM_ROWS) expect(oracle.formula(`${BOQ}!E${r.row}`), `E${r.row}`).toBeUndefined();
    });

    it('the cases cover 0 rooms, the sample count and other counts for every group, and changed recipes', () => {
        for (const r of ROOM_ROWS) {
            const counts = CASES.map(([, i]) => i[r.field]);
            const typed = sample[r.field];
            expect(counts.filter(c => c === 0).length, `${r.field} = 0`).toBeGreaterThan(3);
            expect(counts.filter(c => c === typed).length, `${r.field} = Excel E${r.row}`).toBeGreaterThan(3);
            expect(counts.filter(c => c !== 0 && c !== typed).length, `${r.field} other`).toBeGreaterThan(10);
        }
        expect(CASES.filter(([, i]) => i.materials.length < sample.materials.length).length).toBeGreaterThan(10);
        expect(CASES.filter(([, i]) => i.waste === 0).length).toBeGreaterThan(2);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.reset();
        const res = appResult(input);
        const out = res.calcOutputs['site-camp'] ?? {};

        // 1. outputs: room counts ↔ the BOQ quantities they become; the rest has no Excel cell (D8)
        for (const key of Object.keys(out)) {
            const room = ROOM_ROWS.find(r => r.field === key);
            if (room) expect(out[key]).toBe(input[room.field]);
            else expect(NOT_IN_EXCEL.test(key), `output ${key} has no Excel mapping — map it or list it in NOT_IN_EXCEL`).toBe(true);
        }

        // 2. D3 before retyping: Excel E19:E22 keep the typed sample counts; each row differs by exactly
        //    (rooms − E) × (I × (1 + G) + K)
        let delta = 0;
        for (const r of ROOM_ROWS) {
            const row = boqItem(res.boq, r.line);
            const d = (input[r.field] - oracle.num(`${BOQ}!E${r.row}`))
                * (oracle.num(`${BOQ}!I${r.row}`) * (1 + oracle.num(`${BOQ}!G${r.row}`)) + oracle.num(`${BOQ}!K${r.row}`));
            expectClose((row?.total ?? NaN) - oracle.num(`${BOQ}!M${r.row}`), d, `M${r.row} − D3 delta`);
            delta += d;
        }
        const s3 = res.boq.sections.find(s => s.no === 3);
        expectClose((s3?.total ?? NaN) - oracle.num(`${BOQ}!M30`), delta, 'section 3 M30 − D3 delta');

        // 3. the counts typed into E19:E22 like a user → rows 19–29 and section 3 exact
        oracle.setInputs(excelInputs(input));
        for (const r of SECTION_ROWS) expectBoqRow(oracle, res.boq, `R${r}`, r);
        expectSection(oracle, res.boq, 3, 30);
    });
});
