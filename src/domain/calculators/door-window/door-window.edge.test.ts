// QA edge tests (group U3) for door-window: blank, each input alone, aluminium rate x area, wood prices, opening
// groups by wall part / brick / thickness, every dropdown option, tables (0 / 1 / Excel 13 / more / delete),
// the aluminium (BOQ 24) and wood (BOQ 30) slots, R191, and journey skip. Expected values are hand-computed from
// docs/excel-spec/03-roof-brick-plaster-doors.md section 6.
import { describe, expect, it } from 'vitest';
import {
    ALUMINIUM, ALUMINIUM_RATES, BRICK_THICKNESSES, BRICK_TYPES, defaultLabPrice, defaultMatPrice, doorWindow, itemCode,
    LIGHT_WALL, openingKey, openingRow, openingRowCalc, OPENING_WALL_TYPES, scheduleRows, slotRows, WALL_PARTS, WOOD,
    WOOD_DEFAULT_PRICE, WOOD_DOOR_NOTE, DOOR_TYPES, type DoorWindowInput, type OpeningRow,
} from '.';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const blank = (): DoorWindowInput => doorWindow.blank?.() ?? doorWindow.defaults();
const alu = (p: Partial<OpeningRow> = {}): OpeningRow => openingRow({ name: 'D1-x', type: ALUMINIUM, count: 1, width: 2, height: 1.5, ...p });
const wood = (p: Partial<OpeningRow> = {}): OpeningRow => openingRow({ name: 'D3-x', type: WOOD, count: 1, width: 0.8, height: 2, ...p });
const compute = (i: DoorWindowInput) => doorWindow.compute(i, ctx);
const KEY_ROUND_MONG_HALF = openingKey('ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น');

function runProject(input?: DoorWindowInput, opts: { skipped?: boolean; sample?: boolean } = {}) {
    const p = createProject(opts.sample ? 'sample' : 'blank');
    if (input) p.calculators['door-window'] = input;
    if (opts.skipped) p.journey = { 'door-window': 'skipped' };
    const res = computeProject(p);
    const sec = (no: number) => res.boq.sections.find(s => s.no === no);
    const row = (no: number, key: string): BoqItemRow => {
        const r = sec(no)?.rows.find(x => x.key === key);
        if (r?.type !== 'item') throw new Error(`no BOQ row ${key} in ${no}`);
        return r;
    };
    return { res, sec, row, out: res.calcOutputs['door-window'] };
}

describe('door-window edge: blank()', () => {
    it('blank has no doors and no windows', () => {
        expect(blank()).toEqual({ doors: [], windows: [] });
    });
    it('all outputs finite and 0, all 24 standard opening keys present at 0, BOQ-linked R191 = 0', () => {
        const out = compute(blank());
        for (const [k, v] of Object.entries(out)) { expect(Number.isFinite(v), k).toBe(true); expect(v, k).toBe(0); }
        expect(Object.keys(out).filter(k => k.startsWith('opening|'))).toHaveLength(WALL_PARTS.length * OPENING_WALL_TYPES.length * BRICK_THICKNESSES.length);
        for (const l of doorWindow.boqLinks) expect(out[l.output], l.line).toBe(0);
    });
    it('no BOQ slot rows for a blank schedule', () => {
        const slots = doorWindow.boqSlots?.(blank(), ctx);
        expect(slots?.aluminium).toEqual([]);
        expect(slots?.wood).toEqual([]);
    });
    it('blank project: sections 24 and 30 have no rows with money and R191 has no quantity', () => {
        const { sec, row } = runProject();
        expect(sec(24)?.total).toBe(0);
        expect(sec(30)?.total).toBe(0);
        expect(sec(24)?.rows.filter(r => r.type === 'item')).toHaveLength(0);
        expect(row(18, 'R191').qty).toBe(0);
        expect(row(18, 'R191').total).toBe(0);
    });
});

describe('door-window edge: area per set and total (J = H x I, K = J x G)', () => {
    it.each([
        // width, height, count, J, K
        [2.6, 2.05, 1, 5.33, 5.33],
        [1.5, 2.05, 2, 3.075, 6.15],
        [0.8, 2, 3, 1.6, 4.8],
        [0, 2, 5, 0, 0],
        [2, 0, 5, 0, 0],
        [2, 1.5, 0, 3, 0],
        [0.1, 0.1, 1, 0.01, 0.01],
        [1.1, 1.1, 1, 1.21, 1.21],
        [2, 1.5, 1.5, 3, 4.5],
        [-1, 2, 2, -2, -4],
    ])('%f x %f, count %f -> area %f total %f', (w, h, n, j, k) => {
        const c = openingRowCalc(alu({ width: w, height: h, count: n }));
        expect(c.area).toBeCloseTo(j, 9);
        expect(c.total).toBeCloseTo(k, 9);
    });
    it('NaN / Infinity inputs count as 0', () => {
        const c = openingRowCalc(alu({ width: Number.NaN, height: Infinity, count: 2 }));
        expect(c.area).toBe(0);
        expect(c.total).toBe(0);
    });
    it('huge opening stays finite', () => {
        const out = compute({ doors: [alu({ width: 1e6, height: 1e6, count: 1e3 })], windows: [] });
        expect(out['opening.total']).toBeCloseTo(1e15, -3);
        for (const v of Object.values(out)) expect(Number.isFinite(v)).toBe(true);
    });
});

describe('door-window edge: aluminium price = width x height x rate', () => {
    it('sliding 3,000 per m2: 2 x 1.5 = 3 m2 -> 9,000 per set', () => {
        expect(defaultMatPrice(alu())).toBe(9000);
        expect(openingRowCalc(alu()).matUnit).toBe(9000);
        expect(openingRowCalc(alu()).labUnit).toBe(0);
    });
    it('awning 3,500 per m2: 0.6 x 2.65 = 1.59 m2 -> 5,565', () => {
        expect(defaultMatPrice(alu({ width: 0.6, height: 2.65, rate: ALUMINIUM_RATES.awning }))).toBeCloseTo(5565, 6);
    });
    it('rate constants are 3,000 and 3,500', () => {
        expect(ALUMINIUM_RATES).toEqual({ sliding: 3000, awning: 3500 });
    });
    it('rate 0 gives a free window; a custom rate 4,200 works: 1 x 1 x 4200', () => {
        expect(defaultMatPrice(alu({ rate: 0 }))).toBe(0);
        expect(defaultMatPrice(alu({ width: 1, height: 1, rate: 4200 }))).toBe(4200);
    });
    it('typed price beats the default, and a typed 0 is a real 0', () => {
        expect(openingRowCalc(alu({ matPrice: 12345 })).matUnit).toBe(12345);
        expect(openingRowCalc(alu({ matPrice: 0 })).matUnit).toBe(0);
        expect(openingRowCalc(alu({ labPrice: 250 })).labUnit).toBe(250);
    });
    it('aluminium.amount = count x unit price: 3 sets x 9,000 = 27,000; with labour 100: 3 x 9,100', () => {
        const out = compute({ doors: [alu({ count: 3 })], windows: [] });
        expect(out['aluminium.count']).toBe(3);
        expect(out['aluminium.amount']).toBe(27000);
        const lab = compute({ doors: [alu({ count: 3, labPrice: 100 })], windows: [] });
        expect(lab['aluminium.amount']).toBe(27300);
    });
    it('a window of 0 size is an aluminium set priced 0', () => {
        const out = compute({ doors: [], windows: [alu({ name: 'W1-x', width: 0, height: 0 })] });
        expect(out['aluminium.count']).toBe(1);
        expect(out['aluminium.amount']).toBe(0);
    });
});

describe('door-window edge: wood frames and wood doors', () => {
    it('wood default 4,000 material + 800 labour per set', () => {
        expect(WOOD_DEFAULT_PRICE).toEqual({ mat: 4000, lab: 800 });
        expect(defaultMatPrice(wood())).toBe(4000);
        expect(defaultLabPrice(wood())).toBe(800);
    });
    it('3 wood doors: wood.count 3, amount 3 x 4,800 = 14,400, R191 = 3', () => {
        const out = compute({ doors: [wood({ count: 3 })], windows: [] });
        expect(out['wood.count']).toBe(3);
        expect(out['wood.amount']).toBe(14400);
        expect(out.R191).toBe(3);
    });
    it('wood price ignores the size and the aluminium rate', () => {
        expect(defaultMatPrice(wood({ width: 10, height: 10, rate: 9999 }))).toBe(4000);
    });
    it('wood window also counts in R191 (Excel counts W4, open question) - pinned', () => {
        const out = compute({ doors: [wood({ count: 2 })], windows: [wood({ name: 'W4-x', count: 1 })] });
        expect(out.R191).toBe(3);
    });
    it('aluminium sets do not count in R191', () => {
        expect(compute({ doors: [alu({ count: 5 })], windows: [] }).R191).toBe(0);
    });
    it('typed wood prices (5,000 / 500, the round window) beat defaults', () => {
        const out = compute({ doors: [], windows: [wood({ name: 'W4-x', count: 1, matPrice: 5000, labPrice: 500 })] });
        expect(out['wood.amount']).toBe(5500);
    });
    it('decimal wood count 1.5: R191 = 1.5 (not rounded)', () => {
        expect(compute({ doors: [wood({ count: 1.5 })], windows: [] }).R191).toBe(1.5);
    });
});

describe('door-window edge: door type decision table (blank / unknown / trailing space)', () => {
    it.each([
        ['บานไม้', 1, 0], ['บานอลูมิเนียม', 0, 1], ['บานอลูมิเนียม ', 0, 1], [' บานไม้ ', 1, 0], ['', 0, 0], ['บานเหล็ก', 0, 0],
    ])('type %j -> wood %d, aluminium %d', (type, w, a) => {
        const out = compute({ doors: [alu({ type })], windows: [] });
        expect(out['wood.count']).toBe(w);
        expect(out['aluminium.count']).toBe(a);
    });
    it('DOOR_TYPES lists exactly the two Excel options', () => {
        expect([...DOOR_TYPES]).toEqual(['บานไม้', 'บานอลูมิเนียม']);
    });
    it('a row without a type is in no BOQ slot, has no price, but its opening area is still counted for the brick deduction (SUMIFS ignores C)', () => {
        const input: DoorWindowInput = { doors: [alu({ type: '', count: 2 })], windows: [] };
        const out = compute(input);
        expect(slotRows(input, ALUMINIUM)).toHaveLength(0);
        expect(slotRows(input, WOOD)).toHaveLength(0);
        expect(out['aluminium.amount']).toBe(0);
        expect(out[KEY_ROUND_MONG_HALF]).toBe(6);
    });
});

describe('door-window edge: openings grouped by wall part / brick / thickness', () => {
    it.each(
        WALL_PARTS.flatMap(w => OPENING_WALL_TYPES.flatMap(b => BRICK_THICKNESSES.map(t => [w, b, t] as const))),
    )('%s / %s / %s: opening area lands in exactly that key', (w, b, t) => {
        const out = compute({ doors: [alu({ wallPart: w, brick: b, thickness: t, count: 2 })], windows: [] });   // 2 x 3 m2
        expect(out[openingKey(w, b, t)]).toBe(6);
        const keys = Object.keys(out).filter(k => k.startsWith('opening|') && out[k] !== 0);
        expect(keys).toEqual([openingKey(w, b, t)]);
        expect(out['opening.total']).toBe(6);
    });
    it('dropdown lists: 4 wall parts, 3 brick options (clay, AAC, light wall), 2 thicknesses', () => {
        expect([...WALL_PARTS]).toHaveLength(4);
        expect([...BRICK_TYPES]).toEqual(['อิฐมวลเบา', 'อิฐมอญ']);
        expect(OPENING_WALL_TYPES).toContain(LIGHT_WALL);
        expect([...BRICK_THICKNESSES]).toEqual(['ครึ่งแผ่น', 'เต็มแผ่น']);
    });
    it('two rows in the same group add up: 6 + 4.8 = 10.8 m2', () => {
        const out = compute({ doors: [alu({ count: 2 }), wood({ count: 3, wallPart: 'ผนังรอบบ้าน' })], windows: [] });
        expect(out[KEY_ROUND_MONG_HALF]).toBeCloseTo(10.8, 9);
        expect(out['opening.total']).toBeCloseTo(10.8, 9);
    });
    it('doors and windows share the same groups', () => {
        const out = compute({ doors: [alu({ count: 1 })], windows: [alu({ name: 'W1-x', count: 2 })] });
        expect(out[KEY_ROUND_MONG_HALF]).toBe(9);
    });
    it('keys are compared trimmed: " ผนังรอบบ้าน " goes to the same group', () => {
        const out = compute({ doors: [alu({ wallPart: ' ผนังรอบบ้าน ', brick: 'อิฐมอญ ', thickness: ' ครึ่งแผ่น' })], windows: [] });
        expect(out[KEY_ROUND_MONG_HALF]).toBe(3);
    });
    it('an unknown combination creates its own key (e.g. a typed wall part)', () => {
        const out = compute({ doors: [alu({ wallPart: 'ผนังห้องใต้ดิน' })], windows: [] });
        expect(out[openingKey('ผนังห้องใต้ดิน', 'อิฐมอญ', 'ครึ่งแผ่น')]).toBe(3);
        expect(out['opening.total']).toBe(3);
    });
    it('openingKey format and trimming', () => {
        expect(openingKey(' a ', ' b ', ' c ')).toBe('opening|a|b|c');
    });
});

describe('door-window edge: item codes and unique slot keys', () => {
    it.each([
        ['D1-บานเลื่อน', 'D1'], ['d12 x', 'D12'], ['  W3-บาน', 'W3'], ['บานเลื่อน', ''], ['', ''], ['AB1-x', 'AB1'], ['1D-x', ''],
    ])('itemCode(%j) = %j', (name, code) => {
        expect(itemCode(name)).toBe(code);
    });
    it('rows without a code get D#n / W#n; repeated codes get ~2, ~3', () => {
        const input: DoorWindowInput = {
            doors: [alu({ name: 'บาน' }), alu({ name: 'D1-a' }), alu({ name: 'D1-b' }), alu({ name: 'd1-c' })],
            windows: [alu({ name: 'W9-x' }), alu({ name: 'D1-in-window' })],
        };
        expect(scheduleRows(input).map(r => r.key)).toEqual(['D#1', 'D1', 'D1~2', 'D1~3', 'W9', 'D1~4']);
    });
    it('slot row keys are unique across a 40-row schedule', () => {
        const doors = Array.from({ length: 40 }, () => alu({ name: 'D1-x' }));
        const keys = slotRows({ doors, windows: [] }, ALUMINIUM).map(r => r.key);
        expect(new Set(keys).size).toBe(40);
    });
});

describe('door-window edge: BOQ slot rows (aluminium 24 / wood 30)', () => {
    it('aluminium slot: numbered 1) 2), unit ชุด, qty typed count, no waste, price W x H x rate, labour 0', () => {
        const rows = slotRows({ doors: [alu({ name: 'D1-a', count: 2 }), alu({ name: 'D2-b', count: 1, width: 1, height: 1 })], windows: [] }, ALUMINIUM);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({ type: 'item', key: 'D1', itemNo: '1)', desc: 'D1-a', unit: 'ชุด', qty: { kind: 'input', value: 2 }, waste: 0, gross: 'std', mat: 9000, lab: 0, materialBasis: 'gross', labourBasis: 'net' });
        expect(rows[1]).toMatchObject({ key: 'D2', itemNo: '2)', mat: 3000 });
    });
    it('aluminium rows have no note; wood doors get the 3,000 baht note; wood windows do not', () => {
        const a = slotRows({ doors: [alu()], windows: [] }, ALUMINIUM)[0];
        expect(a && 'note' in a).toBe(false);
        const rows = slotRows({ doors: [wood({ name: 'D3-x' })], windows: [wood({ name: 'W4-x' })] }, WOOD);
        expect(rows.map(r => (r.type === 'item' ? r.note : 'heading'))).toEqual([WOOD_DOOR_NOTE, undefined]);
    });
    it('slot rows split by type: 1 aluminium + 1 wood -> one row each; a blank-type row appears in neither', () => {
        const input: DoorWindowInput = { doors: [alu(), wood(), alu({ type: '' })], windows: [] };
        expect(slotRows(input, ALUMINIUM)).toHaveLength(1);
        expect(slotRows(input, WOOD)).toHaveLength(1);
    });
    it('description is trimmed; the desc is the row name', () => {
        const r = slotRows({ doors: [alu({ name: '  D1-บาน ขนาด 2 x 1.5 ม.  ' })], windows: [] }, ALUMINIUM)[0];
        expect(r?.desc).toBe('D1-บาน ขนาด 2 x 1.5 ม.');
    });
    it('doors come before windows in the slot (Excel FILTER order)', () => {
        const input: DoorWindowInput = { doors: [alu({ name: 'D1-a' })], windows: [alu({ name: 'W1-b' })] };
        expect(slotRows(input, ALUMINIUM).map(r => r.key)).toEqual(['D1', 'W1']);
    });
    it('typed price 0 / null: matPrice 0 gives mat 0 in the slot', () => {
        const r = slotRows({ doors: [alu({ matPrice: 0 })], windows: [] }, ALUMINIUM)[0];
        expect(r?.type === 'item' ? r.mat : -1).toBe(0);
    });
    it('count 0 and NaN count: slot row exists with qty 0', () => {
        const rows = slotRows({ doors: [alu({ count: 0 }), alu({ count: Number.NaN })], windows: [] }, ALUMINIUM);
        expect(rows.map(r => (r.type === 'item' && r.qty.kind === 'input' ? r.qty.value : -1))).toEqual([0, 0]);
    });
});

describe('door-window edge: table size (0 / 1 / Excel 13 / more / delete)', () => {
    it('0 rows and 1 row', () => {
        expect(compute({ doors: [], windows: [] })['opening.total']).toBe(0);
        expect(compute({ doors: [alu()], windows: [] })['opening.total']).toBe(3);
    });
    it('Excel sample (9 doors + 4 windows): opening total, aluminium 9 sets, wood 7 sets', () => {
        const out = compute(doorWindow.defaults());
        // 5.33 + 3.075 + 4.8 + 1.6 + 2.8 + 3.28 + 4.3725 + 1.59 + 4.92 + 6*... windows: W1 2x1.56=3.12, W2 4x1.08=4.32, W3 2x0.9=1.8, W4 1.21
        expect(out['opening.total']).toBeCloseTo(5.33 + 3.075 + 4.8 + 1.6 + 2.8 + 3.28 + 4.3725 + 1.59 + 4.92 + 3.12 + 4.32 + 1.8 + 1.21, 6);
        expect(out['aluminium.count']).toBe(14);   // D1 D2 D6 D7 D8 D9 = 6 sets, W1 2, W2 4, W3 2 = 8
        expect(out['wood.count']).toBe(7);         // D3 3 + D4 1 + D5 2 + W4 1
        expect(out.R191).toBe(7);
    });
    it('more than Excel: 30 aluminium windows of 1 m2 -> 30 slot rows, total 30 m2', () => {
        const windows = Array.from({ length: 30 }, (_, i) => alu({ name: `W${i + 1}-x`, width: 1, height: 1 }));
        const input: DoorWindowInput = { doors: [], windows };
        expect(slotRows(input, ALUMINIUM)).toHaveLength(30);
        expect(compute(input)['opening.total']).toBe(30);
    });
    it('delete the first door: slot numbering restarts at 1) and the group total drops', () => {
        const d = doorWindow.defaults();
        const before = compute(d);
        const after = compute({ ...d, doors: d.doors.slice(1) });
        expect(after[KEY_ROUND_MONG_HALF]).toBeCloseTo((before[KEY_ROUND_MONG_HALF] ?? 0) - 2.6 * 2.05, 9);
        const rows = slotRows({ ...d, doors: d.doors.slice(1) }, ALUMINIUM);
        expect(rows[0]).toMatchObject({ key: 'D2', itemNo: '1)' });
    });
    it('delete everything one by one ends at 0', () => {
        let input = doorWindow.defaults();
        while (input.doors.length > 0) input = { ...input, doors: input.doors.slice(1) };
        while (input.windows.length > 0) input = { ...input, windows: input.windows.slice(1) };
        const out = compute(input);
        expect(out['opening.total']).toBe(0);
        expect(out.R191).toBe(0);
    });
});

describe('door-window edge: through computeProject (BOQ 24, 30 and R191 money)', () => {
    it('one aluminium door 2 x 1.5 count 2: BOQ 24 row qty 2, I 9,000, J = 18,000, section 18,000', () => {
        const { row, sec } = runProject({ doors: [alu({ count: 2 })], windows: [] });
        const r = row(24, 'door-window:aluminium:D1');
        expect(r.qty).toBe(2);
        expect(r.matUnit).toBe(9000);
        expect(r.matTotal).toBe(18000);
        expect(r.labTotal).toBe(0);
        expect(sec(24)?.total).toBe(18000);
        expect(sec(30)?.total).toBe(0);
    });
    it('one wood door count 2: J = 4,000 x 2 = 8,000, L = 800 x 2 = 1,600, M = 9,600; R191 = 2 x (1,200 + 500) = 3,400', () => {
        const { row, sec } = runProject({ doors: [wood({ count: 2 })], windows: [] });
        const r = row(30, 'door-window:wood:D3');
        expect(r.matTotal).toBe(8000);
        expect(r.labTotal).toBe(1600);
        expect(r.total).toBe(9600);
        expect(r.note).toBe(WOOD_DOOR_NOTE);
        expect(sec(30)?.total).toBe(9600);
        const f = row(18, 'R191');
        expect(f.qty).toBe(2);
        expect(f.total).toBe(3400);
    });
    it('Excel sample project reproduces section 24 = 99,277.5 and section 30 = 34,300', () => {
        const { sec } = runProject(doorWindow.defaults(), { sample: true });
        expect(sec(24)?.total).toBeCloseTo(99277.5, 6);
        expect(sec(30)?.total).toBeCloseTo(34300, 6);
    });
    it('adding a window adds a BOQ row and its money; deleting it removes both', () => {
        const base: DoorWindowInput = { doors: [alu()], windows: [] };
        const a = runProject(base);
        const b = runProject({ ...base, windows: [alu({ name: 'W1-x', width: 1, height: 1, rate: 3500 })] });
        expect(b.sec(24)?.rows.filter(r => r.type === 'item')).toHaveLength(2);
        expect((b.sec(24)?.total ?? 0) - (a.sec(24)?.total ?? 0)).toBe(3500);
    });
    it('level skipped: sections 24 / 30 are empty, R191 qty 0, and no opening is deducted from brick walls', () => {
        const { sec, row, out } = runProject(doorWindow.defaults(), { skipped: true });
        expect(sec(24)?.rows.filter(r => r.type === 'item')).toHaveLength(0);
        expect(sec(24)?.total).toBe(0);
        expect(sec(30)?.total).toBe(0);
        expect(row(18, 'R191').qty).toBe(0);
        expect(row(18, 'R191').total).toBe(0);
        expect(out?.['opening.total']).toBe(0);
        expect(out?.[KEY_ROUND_MONG_HALF]).toBe(0);
    });
    it('skipped level also zeroes the money of a sample project (not only the blank one)', () => {
        const { sec } = runProject(undefined, { skipped: true, sample: true });
        expect(sec(24)?.total).toBe(0);
        expect(sec(30)?.total).toBe(0);
    });
});
