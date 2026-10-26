// Differential test: brick compute() + BOQ section 17 vs the real Excel v5 formulas (evaluated by the oracle) on
// ~50 seeded random wall schedules, with the Excel sample door/window schedule (openings). Guide:
// docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { computeProject, createProject, type ProjectResult } from '../../project';
import {
    brick, brickOpenings, brickWallResults, BRICK_BOQ_ROWS, BRICK_THICKNESSES, BRICK_TYPES, BRICK_WALL_PARTS,
    netByPartKey, openingKey, type BrickInput, type BrickWall,
} from '.';

const SHEET = 'ก่ออิฐ_Brick';
const DOORS = 'ประตู-หน้าต่าง_Door&Window';
const PLASTER = 'ฉาบปูน_Plaster';
const BOQ = 'BOQ (Home)';

// ─── Input mapping ──────────────────────────────────────────────────────────
// The wall shape is not an input in Excel: rows 5–7 hold G = E*F (rectangles), rows 8–20 G = 0.5*E*F
// (gable triangles). So a rectangle goes to the next free row of 5–7 and a triangle to the next of 8–20.
const RECT_ROWS = [5, 6, 7];
const TRIANGLE_ROWS = Array.from({ length: 13 }, (_, i) => 8 + i);
const INPUT_COLUMNS: readonly [keyof BrickWall, string][] = [
    ['wallPart', 'B'], ['brickType', 'C'], ['thickness', 'D'], ['length', 'E'], ['height', 'F'],
];

/** Excel row of each wall (same order as input.walls). */
function excelRows(input: BrickInput): number[] {
    let rect = 0;
    let tri = 0;
    return input.walls.map(w => {
        const row = w.shape === 'triangle' ? TRIANGLE_ROWS[tri++] : RECT_ROWS[rect++];
        if (row === undefined) throw new Error('Excel has 3 rectangle rows (5–7) and 13 triangle rows (8–20)');
        return row;
    });
}

function excelInputs(input: BrickInput): Record<string, OracleInput> {
    const out: Record<string, OracleInput> = {};
    for (const row of [...RECT_ROWS, ...TRIANGLE_ROWS]) for (const [, col] of INPUT_COLUMNS) out[`${SHEET}!${col}${row}`] = null;
    const rows = excelRows(input);
    input.walls.forEach((w, i) => {
        for (const [field, col] of INPUT_COLUMNS) {
            const v = w[field];
            out[`${SHEET}!${col}${rows[i] ?? 0}`] = v === undefined || v === '' ? null : v;
        }
    });
    return out;
}

/** Plaster rows that read the brick net area of one wall part: E = SUMIF(Brick!B, part, Brick!I) × D. */
const PLASTER_ROWS: Record<string, number> = { 'ผนังรอบบ้าน': 5, 'ผนังภายในบ้าน': 7, 'ผนังภายนอกบ้าน': 8, 'ผนังรอบบ้าน-พิเศษ': 9 };

// ─── Random but plausible wall schedules ────────────────────────────────────
function randomWall(rng: Random, shape: 'rect' | 'triangle'): BrickWall {
    // Mostly the combinations the sample door/window schedule has openings in, so deductions are exercised.
    const common = rng.chance(0.6);
    return {
        wallPart: common ? rng.pick(['ผนังรอบบ้าน', 'ผนังภายในบ้าน']) : rng.pick(BRICK_WALL_PARTS),
        brickType: common ? 'อิฐมอญ' : rng.pick(BRICK_TYPES),
        thickness: common ? 'ครึ่งแผ่น' : rng.pick(BRICK_THICKNESSES),
        length: shape === 'rect' ? rng.step(1, 45, 0.1) : rng.step(3, 10, 0.5),
        height: shape === 'rect' ? rng.step(2.4, 3.6, 0.05) : rng.step(1, 3.5, 0.05),
        shape,
    };
}

function randomInput(seed: number): BrickInput {
    const rng = seededRandom(seed);
    const rect = Array.from({ length: rng.int(1, 3) }, () => randomWall(rng, 'rect'));
    const tri = Array.from({ length: rng.pick([0, 0, 1, 2, 3, 5]) }, () => randomWall(rng, 'triangle'));
    return { walls: [...rect, ...tri] };
}

const CASES: [string, BrickInput][] = [
    ['Excel sample', brick.defaults()],
    ['no walls', { walls: [] }],
    ['D1: two rows share ผนังรอบบ้าน/อิฐมอญ/ครึ่งแผ่น', {
        walls: [
            { wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 30, height: 3.5, shape: 'rect' },
            { wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 12.5, height: 3.5, shape: 'rect' },
        ],
    }],
    ['every BOQ row (both brick types × both thicknesses)', {
        walls: [
            { wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 20, height: 3, shape: 'rect' },
            { wallPart: 'ผนังภายนอกบ้าน', brickType: 'อิฐมอญ', thickness: 'เต็มแผ่น', length: 4, height: 3, shape: 'rect' },
            { wallPart: 'ผนังภายในบ้าน', brickType: 'อิฐมวลเบา', thickness: 'เต็มแผ่น', length: 8, height: 3, shape: 'rect' },
            { wallPart: 'ผนังรอบบ้าน-พิเศษ', brickType: 'อิฐมวลเบา', thickness: 'ครึ่งแผ่น', length: 7, height: 2.5, shape: 'triangle' },
        ],
    }],
    ...Array.from({ length: 50 }, (_, k): [string, BrickInput] => [`random #${k} (seed ${7_000 + k})`, randomInput(7_000 + k)]),
];

function appResult(input: BrickInput): ProjectResult {
    const p = createProject();
    p.calculators.brick = input;
    return computeProject(p);
}

const keyOf = (w: BrickWall) => openingKey(w.wallPart, w.brickType, w.thickness);
const lineOf = (w: BrickWall) => BRICK_BOQ_ROWS.find(b => b.brickType === w.brickType.trim() && b.thickness === w.thickness.trim())?.line;

/**
 * D1 (brick.ts): Excel column H subtracts the whole opening group from EVERY row of that wall part / brick /
 * thickness; the app deducts each group once. Returns, per selector, Excel-style deduction − app deduction.
 */
function d1Excess(input: BrickInput, openings: Record<string, number>, select: (w: BrickWall) => string | undefined): Map<string, number> {
    const out = new Map<string, number>();
    const seen = new Set<string>();
    for (const w of input.walls) {
        const sel = select(w);
        if (sel === undefined) continue;
        const k = keyOf(w);
        const group = openings[k] ?? 0;
        // the first row of a group is the deduction both make; every further row is Excel's extra
        if (seen.has(k)) out.set(sel, (out.get(sel) ?? 0) + group);
        else out.set(sel, out.get(sel) ?? 0);
        seen.add(k);
    }
    return out;
}

describe('ก่ออิฐ_Brick vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...[5, 8, 20].flatMap(r => ['G', 'H', 'I'].map(c => `${SHEET}!${c}${r}`)),
            ...[179, 180, 181, 182, 183].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!M187`, `${PLASTER}!E5`, `${PLASTER}!E9`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover shared opening groups (D1), deductions, unmatched openings, triangles and every BOQ row', () => {
        const res = appResult(brick.defaults());
        const openings = brickOpenings({ outputs: id => res.calcOutputs[id] });
        const has = (p: (input: BrickInput) => boolean) => CASES.filter(([, input]) => p(input)).length;
        const keys = (input: BrickInput) => input.walls.map(keyOf);
        expect(has(i => new Set(keys(i)).size < keys(i).length && keys(i).some(k => (openings[k] ?? 0) > 0))).toBeGreaterThan(3);
        expect(has(i => keys(i).some(k => (openings[k] ?? 0) > 0))).toBeGreaterThan(20);
        expect(has(i => Object.keys(openings).some(k => !keys(i).includes(k)))).toBeGreaterThan(10);
        expect(has(i => i.walls.some(w => w.shape === 'triangle'))).toBeGreaterThan(10);
        for (const b of BRICK_BOQ_ROWS) expect(has(i => i.walls.some(w => lineOf(w) === b.line)), b.line).toBeGreaterThan(3);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs.brick ?? {};
        const openings = brickOpenings({ outputs: id => res.calcOutputs[id] });
        const rows = excelRows(input);
        const results = brickWallResults(input, openings);
        const groupSize = (w: BrickWall) => input.walls.filter(x => keyOf(x) === keyOf(w)).length;

        // 1. per row: G area always; H/I exactly when the row's group is not shared (else D1, below)
        input.walls.forEach((w, i) => {
            const r = rows[i] ?? 0;
            const app = results[i];
            expectClose(app?.area, oracle.num(`${SHEET}!G${r}`), `G${r}`);
            if (groupSize(w) === 1) {
                expectClose(app?.openings, oracle.num(`${SHEET}!H${r}`), `H${r}`);
                expectClose(app?.net, oracle.num(`${SHEET}!I${r}`), `I${r}`);
            } else {
                // D1: Excel H is the whole group on every sharing row; the app's shares add up to one group.
                expectClose(oracle.num(`${SHEET}!H${r}`), openings[keyOf(w)] ?? 0, `H${r} Excel = whole group`);
                const shares = input.walls.reduce((s, x, j) => s + (keyOf(x) === keyOf(w) ? (results[j]?.openings ?? 0) : 0), 0);
                expectClose(shares, openings[keyOf(w)] ?? 0, `row ${i}: app shares = one group`);
            }
        });
        for (const r of [...RECT_ROWS, ...TRIANGLE_ROWS].filter(x => !rows.includes(x))) {
            expect(oracle.num(`${SHEET}!G${r}`), `unused row ${r}`).toBe(0);
        }

        // 2. every output of compute()
        const sumCol = (col: string) => [...RECT_ROWS, ...TRIANGLE_ROWS].reduce((s, r) => s + oracle.num(`${SHEET}!${col}${r}`), 0);
        const excessTotal = [...d1Excess(input, openings, () => 'all').values()].reduce((s, v) => s + v, 0);
        const byLine = d1Excess(input, openings, lineOf);
        const byPart = d1Excess(input, openings, w => w.wallPart.trim());
        const matched = new Set(input.walls.map(keyOf));
        const checked = new Set<string>();
        const check = (key: string, excel: number, label: string) => { checked.add(key); expectClose(out[key], excel, label); };
        check('gross', sumCol('G'), 'gross = ΣG');
        check('openings', sumCol('H') - excessTotal, 'openings = ΣH − D1 excess');
        check('net', sumCol('I') + excessTotal, 'net = ΣI + D1 excess');
        for (const b of BRICK_BOQ_ROWS) {
            check(b.line, oracle.num(`${BOQ}!E${b.line.slice(1)}`) + (byLine.get(b.line) ?? 0), `${b.line} = BOQ E + D1 excess`);
        }
        for (const [part, row] of Object.entries(PLASTER_ROWS)) {
            const d = oracle.num(`${PLASTER}!D${row}`);
            const key = netByPartKey(part);
            if (key in out) check(key, oracle.num(`${PLASTER}!E${row}`) / d + (byPart.get(part) ?? 0), `${key} = plaster E${row}/D${row} + D1 excess`);
            else expect(oracle.num(`${PLASTER}!E${row}`), `plaster E${row} without walls`).toBe(0);
        }
        // unmatchedOpenings: opening groups of the door/window sheet with no wall row (Excel never deducts them)
        let unmatched = 0;
        for (const part of BRICK_WALL_PARTS) for (const type of BRICK_TYPES) for (const thick of BRICK_THICKNESSES) {
            if (matched.has(openingKey(part, type, thick))) continue;
            const v = oracle.evaluate(`=SUMIFS('${DOORS}'!K:K,'${DOORS}'!D:D,"${part}",'${DOORS}'!E:E,"${type}",'${DOORS}'!F:F,"${thick}")`);
            unmatched += typeof v === 'number' ? v : NaN;
        }
        check('unmatchedOpenings', unmatched, 'unmatchedOpenings');
        for (const key of Object.keys(out)) expect(checked.has(key), `output ${key} has no Excel mapping`).toBe(true);

        // 3. BOQ (Home) section 17: R179–R182 (+ R183 เสาเอ็น = ΣE179:E182), exact unless D1 applies
        let excess = 0;
        for (const b of BRICK_BOQ_ROWS) {
            const er = Number(b.line.slice(1));
            const delta = byLine.get(b.line) ?? 0;
            excess += delta;
            if (delta === 0) { expectBoqRow(oracle, res.boq, b.line, er); continue; }
            const row = boqItem(res.boq, b.line);
            expectClose((row?.qty ?? NaN) - oracle.num(`${BOQ}!E${er}`), delta, `E${er} − D1 excess`);
            // same waste and unit prices as Excel, applied to the larger net area
            expectClose(row?.grossQty ?? NaN, (row?.qty ?? NaN) * (1 + oracle.num(`${BOQ}!G${er}`)), `H${er}`);
            expectClose(row?.matTotal, oracle.num(`${BOQ}!I${er}`) * (row?.grossQty ?? NaN), `J${er} = I×H`);
            expectClose(row?.labTotal, oracle.num(`${BOQ}!K${er}`) * (row?.qty ?? NaN), `L${er} = K×E`);
        }
        if (excess === 0) {
            expectBoqRow(oracle, res.boq, 'R183', 183);
        } else {
            expectClose((boqItem(res.boq, 'R183')?.qty ?? NaN) - oracle.num(`${BOQ}!E183`), excess, 'E183 − D1 excess');
        }
        const s17 = res.boq.sections.find(s => s.no === 17);
        const appRows = ['R179', 'R180', 'R181', 'R182', 'R183'].reduce((s, k) => s + (boqItem(res.boq, k)?.total ?? 0), 0);
        const excelRowsTotal = [179, 180, 181, 182, 183].reduce((s, r) => s + oracle.num(`${BOQ}!M${r}`), 0);
        expectClose((s17?.total ?? NaN) - oracle.num(`${BOQ}!M187`), appRows - excelRowsTotal, 'section 17 M187 − row deltas');
        if (excess === 0) expectClose(s17?.total, oracle.num(`${BOQ}!M187`), 'section 17 M187');
    });
});
