// Differential test: door-window compute() + its BOQ slots (section 24 aluminium, section 30 wood), R191 วงกบประตูไม้
// and the brick opening deduction vs the real Excel v5 formulas (evaluated by the oracle) on ~50 seeded random
// door/window schedules. The unit prices Excel keeps on the BOQ rows (I/K 234–242, 294–297) are typed as the owner
// types them (`=2.6*2.05*3000`, 4,000 / 800). Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { isOracleError, loadV5Oracle, type ExcelOracle, type OracleValue } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import {
    ALUMINIUM_BOQ_ROWS, BRICK_RECT_ROWS, BRICK_SHEET, DOORS_SHEET, WOOD_BOQ_ROWS, brickExcelRows, doorWindowExcelInputs,
    doorWindowExcelRows,
} from '../../../test-utils/oracle-roof-walls';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { brick, brickOpenings } from '../brick';
import {
    ALUMINIUM, ALUMINIUM_RATES, BRICK_THICKNESSES, OPENING_WALL_TYPES, WALL_PARTS, WOOD, doorWindow, openingKey,
    openingRowCalc, scheduleRows, type DoorWindowInput, type OpeningRow,
} from '.';

const SHEET = DOORS_SHEET;
const BOQ = 'BOQ (Home)';
const AL_ROOM = ALUMINIUM_BOQ_ROWS.length;   // 9
const WOOD_ROOM = WOOD_BOQ_ROWS.length;      // 4

const sumifs = (o: ExcelOracle, part: string, brickType: string, thick: string): number => {
    const v = o.evaluate(`=SUMIFS('${SHEET}'!K:K,'${SHEET}'!D:D,"${part}",'${SHEET}'!E:E,"${brickType}",'${SHEET}'!F:F,"${thick}")`);
    if (typeof v !== 'number') throw new Error(`SUMIFS ${part}/${brickType}/${thick}: ${JSON.stringify(v)}`);
    return v;
};
const sumifType = (o: ExcelOracle, type: string): number => {
    const v = o.evaluate(`=SUMIF('${SHEET}'!C:C,"${type}",'${SHEET}'!G:G)`);
    if (typeof v !== 'number') throw new Error(`SUMIF ${type}: ${JSON.stringify(v)}`);
    return v;
};
const isError = (v: OracleValue) => isOracleError(v);

// ─── Random but plausible schedules ─────────────────────────────────────────
const DOOR_KINDS = ['บานเลื่อนสลับ', 'บานเลื่อนคู่ และช่องแสงติดตาย', 'บานเปิดเดี่ยว', 'บานกระทุ้งข้าง', 'บานเปิดคู่'];
const WINDOW_KINDS = ['บานเลื่อนสลับ', 'บานกระทุ้งข้าง และช่องแสงติดตาย', 'บานกระทุ้งล่าง', 'บานวงกลม ช่องแสงติดตาย', 'บานติดตาย'];

function randomRow(rng: Random, code: string, type: string, window: boolean): OpeningRow {
    const kind = rng.pick(window ? WINDOW_KINDS : DOOR_KINDS);
    const width = rng.step(0.4, window ? 2.4 : 3, 0.05);
    const height = rng.step(window ? 0.4 : 1.8, window ? 1.8 : 2.8, 0.05);
    const awning = kind.includes('กระทุ้ง');
    const named = rng.chance(0.92);
    return {
        name: `${named ? `${code}-` : ''}${kind} ขนาด ${width} x ${height} ม.${rng.chance(0.4) ? ' ' : ''}`,
        type,
        // most openings sit in clay half-brick walls (the sample); every wall part / wall type / thickness is drawn
        wallPart: rng.pick(WALL_PARTS),
        brick: rng.chance(0.6) ? 'อิฐมอญ' : rng.pick(OPENING_WALL_TYPES),
        thickness: rng.chance(0.7) ? 'ครึ่งแผ่น' : rng.pick(BRICK_THICKNESSES),
        count: rng.int(rng.chance(0.05) ? 0 : 1, 6),
        width, height,
        rate: rng.chance(0.9) ? (awning ? ALUMINIUM_RATES.awning : ALUMINIUM_RATES.sliding) : rng.step(2500, 4500, 50),
        matPrice: rng.chance(0.15) ? rng.step(1000, 20000, 50) : null,
        labPrice: rng.chance(0.15) ? rng.step(0, 1500, 50) : null,
    };
}

function randomInput(seed: number): DoorWindowInput {
    const rng = seededRandom(seed);
    // slot sizes: mostly within Excel's room (9 aluminium rows, 4 wood rows), sometimes empty or overflowing (D5)
    const alu = rng.pick([0, 1, 3, 5, 6, 7, 8, 9, 9, 10, 12]);
    const wood = rng.pick([0, 1, 2, 3, 4, 4, 4, 5, 6]);
    const types = [...Array<string>(alu).fill(ALUMINIUM), ...Array<string>(wood).fill(WOOD), ...(rng.chance(0.25) ? [''] : [])];
    for (let i = types.length - 1; i > 0; i--) {   // shuffle
        const j = rng.int(0, i);
        [types[i], types[j]] = [types[j] ?? '', types[i] ?? ''];
    }
    const kept = types.slice(0, 18);
    const nDoors = Math.min(10, Math.max(kept.length - 8, rng.int(0, Math.min(10, kept.length))));
    const doors = kept.slice(0, nDoors).map((t, i) => randomRow(rng, `D${i + 1}`, t, false));
    const windows = kept.slice(nDoors).map((t, i) => randomRow(rng, `W${i + 1}`, t, true));
    // a duplicate item code now and then (the app keeps BOQ keys unique)
    if (doors.length > 2 && rng.chance(0.2)) {
        const d = doors[1];
        if (d) doors[1] = { ...d, name: d.name.replace(/^D2-/, 'D1-') };
    }
    return { doors, windows };
}

const sample = doorWindow.defaults();
const row = (p: Partial<OpeningRow> & Pick<OpeningRow, 'name' | 'type'>): OpeningRow => ({
    wallPart: 'ผนังรอบบ้าน', brick: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', count: 1, width: 1, height: 2,
    rate: ALUMINIUM_RATES.sliding, matPrice: null, labPrice: null, ...p,
});
const everyWall = (): OpeningRow[] => WALL_PARTS.flatMap((wallPart, i) => OPENING_WALL_TYPES.flatMap((b, j) => BRICK_THICKNESSES.map((thickness, k) =>
    row({ name: `W${i * 6 + j * 2 + k + 1}-ช่อง ${wallPart}`, type: (i + j + k) % 2 ? WOOD : ALUMINIUM, wallPart, brick: b, thickness, width: 0.5 + i * 0.1, height: 1 + j * 0.2 + k * 0.05 }))));

const CASES: [string, DoorWindowInput][] = [
    ['Excel sample', sample],
    ['empty schedule (no aluminium, no wood: Excel FILTER finds nothing)', { doors: [], windows: [] }],
    ['10 doors + 8 windows (full Excel table without row 15), 9 aluminium / 4 wood', {
        doors: [...sample.doors, row({ name: 'D10-บานเปิดคู่ ขนาด 1.6 x 2.2 ม.', type: WOOD, wallPart: 'ผนังภายนอกบ้าน', thickness: 'เต็มแผ่น', count: 2, width: 1.6, height: 2.2 })],
        windows: [...sample.windows,
            row({ name: 'W5-บานติดตาย ขนาด 0.6 x 0.6 ม.', type: '', count: 2, width: 0.6, height: 0.6 }),
            row({ name: 'W6-บานกระทุ้ง ขนาด 0.8 x 1 ม.', type: ALUMINIUM, brick: 'อิฐมวลเบา', count: 3, width: 0.8, height: 1, rate: ALUMINIUM_RATES.awning, labPrice: 250 }),
            row({ name: 'W7-ช่องแสง ผนังเบา', type: ALUMINIUM, brick: 'ผนังเบา', count: 1, width: 1.2, height: 0.5, matPrice: 1800 }),
            row({ name: 'W8-บานไม้ ภายใน', type: WOOD, wallPart: 'ผนังภายในบ้าน', count: 1, width: 0.7, height: 1, matPrice: 2500, labPrice: 400 }),
        ],
    }],
    ['an opening on every wall part × wall type × thickness', { doors: [], windows: everyWall().slice(0, 8) }],
    ['every wall part × wall type × thickness (rest)', { doors: everyWall().slice(8, 18), windows: everyWall().slice(18, 24) }],
    ['typed prices on the first two aluminium rows (Excel L243 = SUM(L236:L242), D1)', {
        ...sample,
        doors: sample.doors.map((d, i) => (i < 2 ? { ...d, matPrice: 12000 + i * 1000, labPrice: 500 + i * 100 } : d)),
    }],
    ['10 aluminium rows (Excel #SPILL!, D5)', {
        ...sample,
        windows: [...sample.windows, row({ name: 'W5-บานเลื่อนสลับ ขนาด 1 x 1 ม.', type: ALUMINIUM, count: 1, width: 1, height: 1 })],
    }],
    ['5 wood rows (Excel #SPILL!, D5)', {
        ...sample,
        windows: [...sample.windows, row({ name: 'W5-บานไม้ ขนาด 0.6 x 0.6 ม.', type: WOOD, count: 1, width: 0.6, height: 0.6 })],
    }],
    ...Array.from({ length: 50 }, (_, k): [string, DoorWindowInput] => [`random #${k} (seed ${12_000 + k})`, randomInput(12_000 + k)]),
];

function appResult(input: DoorWindowInput): ProjectResult {
    const p = createProject();
    p.calculators['door-window'] = input;
    return computeProject(p);
}

/** Section 24 / 30 slot: the app rows in schedule order, Excel's spill rows, room, and the D1 L243 short range. */
function compareSlot(o: ExcelOracle, res: ProjectResult, input: DoorWindowInput, type: string): void {
    const slot = type === ALUMINIUM ? 'aluminium' : 'wood';
    const excelRows = type === ALUMINIUM ? ALUMINIUM_BOQ_ROWS : WOOD_BOQ_ROWS;
    const section = res.boq.sections.find(s => s.no === (type === ALUMINIUM ? 24 : 30));
    const sub = type === ALUMINIUM ? 243 : 298;
    const tagged = scheduleRows(input).filter(t => t.row.type.trim() === type);
    const appRows = tagged.map(t => boqItem(res.boq, `door-window:${slot}:${t.key}`));
    expect(section?.rows.filter(r => r.type === 'item').length, `${slot} rows`).toBe(tagged.length);
    const anchor = o.get(`${BOQ}!D${excelRows[0] ?? 0}`);

    if (tagged.length === 0) {
        // D5: no row of this type — Excel's FILTER finds nothing and the error runs into the subtotal; the app has no row
        expect(isError(anchor) && isError(o.get(`${BOQ}!E${excelRows[0] ?? 0}`)), `${slot} FILTER without match`).toBe(true);
        expect(isError(o.get(`${BOQ}!M${sub}`)), `M${sub}`).toBe(true);
        expect(section?.total).toBe(0);
        return;
    }
    if (tagged.length > excelRows.length) {
        // D5: more rows than Excel reserved — the FILTER spill fails (#SPILL!, Google Sheets #REF!); the app adds a row per item
        expect(isError(anchor) && anchor.error, `${slot} spill`).toBe('#SPILL!');
        expect(o.spillOverflows.map(s => s.ref)).toContain(`${BOQ}!D${excelRows[0] ?? 0}`);
        tagged.forEach((t, k) => {
            const r = appRows[k];
            const c = openingRowCalc(t.row);
            expectClose(r?.qty, t.row.count, `${slot} row ${k} qty`);
            expectClose(r?.total, t.row.count * (c.matUnit + c.labUnit), `${slot} row ${k} total`);
        });
        return;
    }
    // exact: one Excel spill row per app row (D desc, E qty, H, J, L, M), the rest of the spill area empty
    tagged.forEach((t, k) => {
        const er = excelRows[k] ?? 0;
        expectBoqRow(o, res.boq, `door-window:${slot}:${t.key}`, er);
        expect(appRows[k]?.desc, `D${er}`).toBe(o.get(`${BOQ}!D${er}`));
    });
    for (const er of excelRows.slice(tagged.length)) {
        expect(o.get(`${BOQ}!D${er}`), `unused D${er}`).toBeNull();
        expect(o.num(`${BOQ}!M${er}`), `unused M${er}`).toBe(0);
    }
    expectClose(section?.matTotal, o.num(`${BOQ}!J${sub}`), `J${sub}`);
    expectClose(section?.total, o.num(`${BOQ}!M${sub}`), `M${sub}`);
    if (type === ALUMINIUM) {
        // D1 (engine.ts): Excel L243 = SUM(L236:L242) leaves rows 234–235 out; the app sums every row
        expectClose((section?.labTotal ?? NaN) - o.num(`${BOQ}!L243`), o.num(`${BOQ}!L234`) + o.num(`${BOQ}!L235`), 'L243 + L234 + L235');
    } else expectClose(section?.labTotal, o.num(`${BOQ}!L${sub}`), `L${sub}`);
}

describe('ประตู-หน้าต่าง_Door&Window vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...[6, 14, 16, 18, 25].flatMap(r => [`${SHEET}!J${r}`, `${SHEET}!K${r}`]),
            ...[...ALUMINIUM_BOQ_ROWS, ...WOOD_BOQ_ROWS, 191].flatMap(r => ['D', 'E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            ...[243, 298].flatMap(r => ['J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            ...[5, 8, 10].map(r => `${BRICK_SHEET}!H${r}`),
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover both types, blank types, every wall part / wall type / thickness, typed prices, empty and overflowing slots', () => {
        const rows = CASES.flatMap(([, i]) => [...i.doors.map(r => ({ r, door: true })), ...i.windows.map(r => ({ r, door: false }))]);
        const has = (p: (x: typeof rows[number]) => boolean) => rows.filter(p).length;
        for (const t of [ALUMINIUM, WOOD]) for (const door of [true, false]) expect(has(x => x.r.type === t && x.door === door), `${t} door=${door}`).toBeGreaterThan(20);
        expect(has(x => x.r.type === '')).toBeGreaterThan(5);
        for (const w of WALL_PARTS) for (const b of OPENING_WALL_TYPES) for (const t of BRICK_THICKNESSES) {
            expect(has(x => x.r.wallPart === w && x.r.brick === b && x.r.thickness === t), `${w}/${b}/${t}`).toBeGreaterThan(0);
        }
        for (const w of WALL_PARTS) expect(has(x => x.r.wallPart === w), w).toBeGreaterThan(40);
        expect(has(x => x.r.matPrice !== null && x.r.type === ALUMINIUM)).toBeGreaterThan(5);
        expect(has(x => x.r.labPrice !== null && x.r.type === WOOD)).toBeGreaterThan(5);
        expect(has(x => x.r.count === 0)).toBeGreaterThan(2);
        expect(has(x => x.r.rate !== ALUMINIUM_RATES.sliding && x.r.type === ALUMINIUM)).toBeGreaterThan(10);
        const slotSizes = CASES.map(([, i]) => {
            const s = scheduleRows(i);
            return { al: s.filter(t => t.row.type === ALUMINIUM).length, wood: s.filter(t => t.row.type === WOOD).length };
        });
        expect(slotSizes.filter(s => s.al === 0).length).toBeGreaterThan(2);
        expect(slotSizes.filter(s => s.al > AL_ROOM).length).toBeGreaterThan(2);
        expect(slotSizes.filter(s => s.al === AL_ROOM).length).toBeGreaterThan(2);
        expect(slotSizes.filter(s => s.al > 0 && s.al < AL_ROOM).length).toBeGreaterThan(20);
        expect(slotSizes.filter(s => s.wood === 0).length).toBeGreaterThan(2);
        expect(slotSizes.filter(s => s.wood > WOOD_ROOM).length).toBeGreaterThan(2);
        expect(slotSizes.filter(s => s.wood === WOOD_ROOM).length).toBeGreaterThan(5);
        expect(CASES.filter(([, i]) => i.doors.length === 10 || i.windows.length === 8).length).toBeGreaterThan(3);
        // the first two aluminium rows with labour (the L243 short range, D1)
        expect(CASES.filter(([, i]) => scheduleRows(i).filter(t => t.row.type === ALUMINIUM).slice(0, 2)
            .some(t => openingRowCalc(t.row).labUnit > 0)).length).toBeGreaterThan(2);
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(doorWindowExcelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['door-window'] ?? {};
        const rows = doorWindowExcelRows(input);

        // 1. every row: J = H × I and K = J × G; unused rows stay 0
        const used = [...rows.doors, ...rows.windows];
        [...input.doors.map((r, i) => [r, rows.doors[i]] as const), ...input.windows.map((r, i) => [r, rows.windows[i]] as const)].forEach(([r, er]) => {
            const c = openingRowCalc(r);
            expectClose(c.area, oracle.num(`${SHEET}!J${er ?? 0}`), `J${er ?? 0}`);
            expectClose(c.total, oracle.num(`${SHEET}!K${er ?? 0}`), `K${er ?? 0}`);
        });
        for (const er of [6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 19, 20, 21, 22, 23, 24, 25].filter(x => !used.includes(x))) {
            expect(oracle.num(`${SHEET}!K${er}`), `unused K${er}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            let excel: number;
            if (key.startsWith('opening|')) {
                const [, part = '', b = '', t = ''] = key.split('|');
                excel = sumifs(oracle, part, b, t);   // the brick sheet's H = SUMIFS(K, D, part, E, brick, F, thickness)
            } else if (key === 'opening.total') excel = oracle.evaluate(`=SUM('${SHEET}'!K6:K25)`) as number;
            else if (key === 'aluminium.count') excel = sumifType(oracle, 'บานอลูมิเนียม');
            else if (key === 'wood.count') excel = sumifType(oracle, 'บานไม้');
            else if (key === 'R191') excel = oracle.num(`${BOQ}!E191`);
            else if (key === 'aluminium.amount' || key === 'wood.amount') {
                // Σ count × (material + labour) = the slot's M subtotal (M243 / M298) when Excel's spill fits
                const type = key === 'aluminium.amount' ? ALUMINIUM : WOOD;
                const n = scheduleRows(input).filter(t => t.row.type.trim() === type).length;
                const room = type === ALUMINIUM ? AL_ROOM : WOOD_ROOM;
                if (n === 0 || n > room) {   // D5: Excel's subtotal is an error here (compareSlot asserts it)
                    const section = res.boq.sections.find(s => s.no === (type === ALUMINIUM ? 24 : 30));
                    expectClose(v, section?.total ?? NaN, `${key} = app section total (Excel FILTER error, D5)`);
                    continue;
                }
                excel = oracle.num(`${BOQ}!M${type === ALUMINIUM ? 243 : 298}`);
            } else {
                expect.fail(`output ${key} has no Excel mapping`);
                continue;
            }
            expectClose(v, excel, `output ${key}`);
        }
        for (const w of WALL_PARTS) for (const b of OPENING_WALL_TYPES) for (const t of BRICK_THICKNESSES) expect(out, 'opening keys').toHaveProperty([openingKey(w, b, t)]);

        // 3. the brick sheet reads the openings: Excel H of every sample wall row = the app's opening group
        const openings = brickOpenings({ outputs: id => res.calcOutputs[id] });
        const walls = brick.defaults();
        brickExcelRows(walls).forEach((er, i) => {
            const w = walls.walls[i];
            if (!w) return;
            expectClose(openings[openingKey(w.wallPart, w.brickType, w.thickness)] ?? 0, oracle.num(`${BRICK_SHEET}!H${er}`), `brick H${er}`);
        });
        expect(BRICK_RECT_ROWS).toContain(brickExcelRows(walls)[0]);

        // 4. BOQ (Home): R191 วงกบประตูไม้ (L = K×H), the aluminium and wood slots, their subtotals
        expectBoqRow(oracle, res.boq, 'R191', 191);
        compareSlot(oracle, res, input, ALUMINIUM);
        compareSlot(oracle, res, input, WOOD);
    });

    it('D1: an 11th door needs Excel row 15, which has no J/K formula — its area drops out of the brick deduction', () => {
        // door-window/index.ts: "K6 = J6*G6 (Excel row 15 had no formula — fixed, oddity 3)".
        const d11 = row({ name: 'D11-บานเปิดเดี่ยว ขนาด 0.9 x 2 ม.', type: WOOD, wallPart: 'ผนังภายในบ้าน', count: 2, width: 0.9, height: 2 });
        const d10 = row({ name: 'D10-บานเปิดเดี่ยว ขนาด 0.8 x 2 ม.', type: WOOD, wallPart: 'ผนังภายในบ้าน', count: 1, width: 0.8, height: 2 });
        const input: DoorWindowInput = { doors: [...sample.doors, d10, d11], windows: sample.windows.slice(0, 3) };
        expect(doorWindowExcelRows(input).doors[9]).toBe(15);
        oracle.replaceInputs(doorWindowExcelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['door-window'] ?? {};
        expect(oracle.get(`${SHEET}!K15`)).toBeNull();
        const lost = openingRowCalc(d10).total;   // the door typed in row 15
        const key = openingKey(d10.wallPart, d10.brick, d10.thickness);
        expectClose((out[key] ?? NaN) - sumifs(oracle, d10.wallPart, d10.brick, d10.thickness), lost, `${key} delta = row 15 area`);
        expectClose((out['opening.total'] ?? NaN) - (oracle.evaluate(`=SUM('${SHEET}'!K6:K25)`) as number), lost, 'opening.total delta');
        // the BOQ does not use J/K: row 15 still reaches section 30 and R191 exactly
        expectBoqRow(oracle, res.boq, 'R191', 191, 'D1 row 15');
        compareSlot(oracle, res, input, WOOD);
        compareSlot(oracle, res, input, ALUMINIUM);
    });
});
