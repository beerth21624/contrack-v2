// Differential test: ceiling compute() + BOQ section 19 + the paint lines it feeds (paint C7–C9 → BOQ §23/§25/§31)
// vs the real Excel v5 formulas (evaluated by the oracle) on ~50 seeded random ceiling schedules.
// Guide: docs/rebuild/ORACLE_TESTS.md. No D1/D5 delta applies to this sheet: every comparison is exact.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    CEILING_ALL_ROWS, CEILING_FLAT_ROWS, CEILING_SHEET, ceilingExcelInputs, ceilingExcelRows, randomCeilingInput,
} from '../../../test-utils/oracle-finishes';
import { expectBoqRow, expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import { computeProject, createProject, type ProjectResult } from '../../project';
import {
    ceiling, ceilingRowArea, CEILING_CODES, CEILING_DEFAULT_PAINT, CEILING_PAINT_GROUPS, paintKey, SLOPED_CEILING_DEG,
    type CeilingInput,
} from '.';

const PAINT = 'ทาสี_Paint ';
const BOQ = 'BOQ (Home)';

// ─── Output mapping ─────────────────────────────────────────────────────────
const CODE_ROW: Record<string, number> = { C1: 199, C2: 200, C3: 201, C4: 202 };
/** Paint sheet cell that SUMIFs each paint group of the ceiling sheet. */
const PAINT_CELL: Record<string, string> = { ภายนอก: 'C7', ภายใน: 'C8', ไม้ระแนง: 'C9' };

function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    if (key in CODE_ROW) return o.num(`${BOQ}!E${CODE_ROW[key] ?? 0}`);
    const line = /^R(199|200|201|202)$/.exec(key);
    if (line?.[1]) return o.num(`${BOQ}!E${line[1]}`);
    if (key === 'total') return CEILING_ALL_ROWS.reduce((s, r) => s + o.num(`${CEILING_SHEET}!F${r}`), 0);
    const group = /^paint\.(.+)$/.exec(key);
    if (group?.[1] && PAINT_CELL[group[1]]) return o.num(`${PAINT}!${PAINT_CELL[group[1]] ?? ''}`);
    return undefined;
}

/** BOQ rows fed by the sheet: section 19, and the ceiling paint lines of §23 / §25 / §31 (paint C7, C8, C9). */
const CEILING_BOQ_ROWS = [199, 200, 201, 202];
const PAINT_BOQ_ROWS = [225, 226, 227, 247, 248, 249, 302, 303, 304];
/** Section → Excel subtotal row (J/L/M). Paint lines not fed by the ceiling stay at the sample on both sides. */
const SECTIONS: [number, number][] = [[19, 203], [23, 232], [25, 253], [31, 308]];

// ─── Cases ──────────────────────────────────────────────────────────────────
const sample = ceiling.defaults();
const fullTable: CeilingInput = {
    rows: [
        ...CEILING_FLAT_ROWS.map((_, i) => ({
            code: CEILING_CODES[i % 4] ?? 'C1', width: 1 + i * 0.05, length: 2 + i * 0.1, location: `ห้อง ${i + 1}`,
            paint: CEILING_PAINT_GROUPS[i % 3] ?? 'ภายใน',
        })),
        { code: 'C2', width: 1.2, length: 3.4, location: 'เฉลียง 1', paint: 'ภายใน', slope: SLOPED_CEILING_DEG },
        { code: 'C4', width: 2.05, length: 3.15, location: 'เฉลียง 2', paint: 'ไม้ระแนง', slope: SLOPED_CEILING_DEG },
    ],
};

const CASES: [string, CeilingInput][] = [
    ['Excel sample', sample],
    ['no rooms', { rows: [] }],
    ['every row of the Excel table (22 flat + 2 sloped)', fullTable],
    ['sample with the 40° rows set flat (0°)', { rows: sample.rows.map(r => ({ ...r, slope: 0 })) }],
    ['rows with no code / no paint group / zero width', {
        rows: [
            { code: '', width: 3, length: 4, location: 'ยังไม่เลือก', paint: 'ภายใน' },
            { code: 'C1', width: 3, length: 4, location: 'ไม่ทาสี', paint: '' },
            { code: 'C3', width: 0, length: 12, location: '', paint: 'ภายนอก' },
            { code: '', width: 2, length: 2, location: '', paint: '' },
        ],
    }],
    ['paint groups that differ from the type (C1 exterior, C3 slat, C4 interior, sloped C3)', {
        rows: [
            { code: 'C1', width: 2.5, length: 3, location: 'a', paint: 'ภายนอก' },
            { code: 'C3', width: 0.6, length: 20, location: 'b', paint: 'ไม้ระแนง' },
            { code: 'C4', width: 1.5, length: 2, location: 'c', paint: 'ภายใน' },
            { code: 'C3', width: 1, length: 5, location: 'd', paint: 'ภายนอก', slope: SLOPED_CEILING_DEG },
        ],
    }],
    ...Array.from({ length: 50 }, (_, k): [string, CeilingInput] => [`random #${k} (seed ${15_000 + k})`, randomCeilingInput(seededRandom(15_000 + k))]),
];

function appResult(input: CeilingInput): ProjectResult {
    const p = createProject();
    p.calculators.ceiling = input;
    return computeProject(p);
}

describe('ฝ้าเพดาน_Ceiling vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...CEILING_ALL_ROWS.map(r => `${CEILING_SHEET}!F${r}`),
            ...Object.values(PAINT_CELL).map(c => `${PAINT}!${c}`),
            ...[...CEILING_BOQ_ROWS, ...PAINT_BOQ_ROWS].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            ...SECTIONS.flatMap(([, r]) => ['J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover every code, paint group, sloped rows, blank code / group and the full table', () => {
        const has = (p: (input: CeilingInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        for (const c of CEILING_CODES) expect(has(i => i.rows.some(r => r.code === c)), c).toBeGreaterThan(10);
        for (const g of CEILING_PAINT_GROUPS) expect(has(i => i.rows.some(r => r.paint === g)), g).toBeGreaterThan(10);
        expect(has(i => i.rows.some(r => r.code === ''))).toBeGreaterThan(3);
        expect(has(i => i.rows.some(r => r.paint === ''))).toBeGreaterThan(3);
        expect(has(i => i.rows.some(r => r.code !== '' && r.paint !== '' && r.paint !== CEILING_DEFAULT_PAINT[r.code]))).toBeGreaterThan(5);
        expect(has(i => i.rows.some(r => r.width === 0))).toBeGreaterThan(1);
        expect(has(i => i.rows.some(r => r.slope === 0))).toBeGreaterThan(3);
        for (const n of [0, 1, 2]) {
            expect(has(i => i.rows.filter(r => r.slope === SLOPED_CEILING_DEG).length === n), `${n} sloped rows`).toBeGreaterThan(2);
        }
        expect(has(i => i.rows.length === CEILING_ALL_ROWS.length)).toBeGreaterThan(1);
        expect(has(i => i.rows.length === 0)).toBeGreaterThan(0);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(ceilingExcelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs.ceiling ?? {};
        const rows = ceilingExcelRows(input);

        // 1. F of every used row (D*E or the 40° formula), and the unused rows stay 0
        input.rows.forEach((r, i) => expectClose(ceilingRowArea(r), oracle.num(`${CEILING_SHEET}!F${rows[i] ?? 0}`), `row ${i} F${rows[i] ?? 0}`));
        for (const r of CEILING_ALL_ROWS.filter(x => !rows.includes(x))) expect(oracle.num(`${CEILING_SHEET}!F${r}`), `unused F${r}`).toBe(0);

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping`);
            else expectClose(v, excel, `output ${key}`);
        }
        for (const g of CEILING_PAINT_GROUPS) expect(paintKey(g) in out, paintKey(g)).toBe(true);

        // 3. the paint calculator reads these totals: its areas equal paint C7–C9 too
        const paintOut = res.calcOutputs.paint ?? {};
        expectClose(paintOut.ceilingExterior, oracle.num(`${PAINT}!C7`), 'paint ceilingExterior = C7');
        expectClose(paintOut.ceilingInterior, oracle.num(`${PAINT}!C8`), 'paint ceilingInterior = C8');
        expectClose(paintOut.ceilingSlat, oracle.num(`${PAINT}!C9`), 'paint ceilingSlat = C9');

        // 4. BOQ (Home): section 19 and the ceiling paint lines of §23/§25/§31, then the section subtotals
        for (const r of [...CEILING_BOQ_ROWS, ...PAINT_BOQ_ROWS]) expectBoqRow(oracle, res.boq, `R${r}`, r);
        for (const [no, row] of SECTIONS) {
            const s = res.boq.sections.find(x => x.no === no);
            expectClose(s?.matTotal, oracle.num(`${BOQ}!J${row}`), `section ${no} J${row}`);
            expectClose(s?.labTotal, oracle.num(`${BOQ}!L${row}`), `section ${no} L${row}`);
            expectClose(s?.total, oracle.num(`${BOQ}!M${row}`), `section ${no} M${row}`);
        }
    });
});
