import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import {
    ALUMINIUM, BRICK_THICKNESSES, BRICK_TYPES, doorWindow, itemCode, openingKey, openingRow, openingRowCalc,
    scheduleRows, slotRows, WALL_PARTS, WOOD, WOOD_DOOR_NOTE, type DoorWindowInput,
} from '.';

const ctx = { outputs: () => undefined };
const goldenLines = golden.lines as Record<string, { E?: number; I?: number; K?: number; M?: number }>;
const goldenSections = golden.sections as Record<string, { J: number; L: number; M: number }>;

const sectionRows = (input: DoorWindowInput | undefined, no: number): BoqItemRow[] => {
    const project = createProject();
    if (input) project.calculators['door-window'] = input;
    const s = computeProject(project, [doorWindow]).boq.sections.find(x => x.no === no);
    return (s?.rows ?? []).filter((r): r is BoqItemRow => r.type === 'item');
};
const section = (input: DoorWindowInput | undefined, no: number) => {
    const project = createProject();
    if (input) project.calculators['door-window'] = input;
    return computeProject(project, [doorWindow]).boq.sections.find(x => x.no === no);
};

describe('ประตู-หน้าต่าง_Door&Window (sheet 12)', () => {
    const input = doorWindow.defaults();
    const out = doorWindow.compute(input, ctx);

    it('Excel sample: J = H × I and K = J × G on every row', () => {
        const rows = [...input.doors, ...input.windows].map(openingRowCalc);
        const J = [5.33, 3.075, 1.6, 1.6, 1.4, 3.28, 4.3725, 1.59, 4.92, 1.56, 1.08, 0.9, 1.21];
        const K = [5.33, 3.075, 4.8, 1.6, 2.8, 3.28, 4.3725, 1.59, 4.92, 3.12, 4.32, 1.8, 1.21];
        rows.forEach((r, i) => {
            expect(r.area).toBeCloseTo(J[i] ?? NaN, 9);
            expect(r.total).toBeCloseTo(K[i] ?? NaN, 9);
        });
    });

    it('brick openings by wall part / brick / thickness (brick H5 = 34.6175, H6 = 7.6, others 0)', () => {
        expect(out[openingKey('ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น')]).toBeCloseTo(34.6175, 9);
        expect(out[openingKey('ผนังภายในบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น')]).toBeCloseTo(7.6, 9);
        expect(out[openingKey('ผนังภายนอกบ้าน', 'อิฐมอญ', 'เต็มแผ่น')]).toBe(0);
        expect(out[openingKey('ผนังรอบบ้าน-พิเศษ', 'อิฐมวลเบา', 'ครึ่งแผ่น')]).toBe(0);
        expect(out['opening.total']).toBeCloseTo(34.6175 + 7.6, 9);
        // every standard combination is exported
        for (const w of WALL_PARTS) for (const b of BRICK_TYPES) for (const t of BRICK_THICKNESSES) {
            expect(out[openingKey(w, b, t)]).toBeTypeOf('number');
        }
        expect(openingKey('ผนังรอบบ้าน ', 'อิฐมอญ', '')).toBe('opening|ผนังรอบบ้าน|อิฐมอญ|');
    });

    it('BOQ E191 วงกบประตูไม้ = SUMIF(C,"บานไม้",G) = 7 (W4 included, like Excel)', () => {
        expect(out.R191).toBe(goldenLines.R191?.E);
        expect(doorWindow.boqLinks).toEqual([{ line: 'R191', field: 'qty', output: 'R191' }]);
        const r191 = sectionRows(undefined, 18).find(r => r.key === 'R191');
        expect(r191?.qty).toBe(7);
        expect(r191?.total).toBeCloseTo(goldenLines.R191?.M ?? NaN, 6);
    });

    it('section 24 slot = Excel rows 234–242 (desc, E, I, K, M) and subtotal 99,277.5', () => {
        const rows = sectionRows(undefined, 24);
        const excel = ['R234', 'R235', 'R236', 'R237', 'R238', 'R239', 'R240', 'R241', 'R242'];
        expect(rows.map(r => r.key)).toEqual(['D1', 'D2', 'D6', 'D7', 'D8', 'D9', 'W1', 'W2', 'W3'].map(k => `door-window:aluminium:${k}`));
        rows.forEach((r, i) => {
            const g = goldenLines[excel[i] ?? ''];
            expect(r.itemNo).toBe(`${i + 1})`);
            expect(r.unit).toBe('ชุด');
            expect(r.qty).toBe(g?.E);
            expect(r.matUnit).toBeCloseTo(g?.I ?? NaN, 6);
            expect(r.labUnit).toBe(g?.K);
            expect(r.total).toBeCloseTo(g?.M ?? NaN, 6);
        });
        expect(rows[0]?.desc).toBe('D1-บานเลื่อนคู่ และช่องแสงติดตาย ขนาด 2.6 x 2.05 ม.');
        const s = section(undefined, 24);
        expect(s?.matTotal).toBeCloseTo(goldenSections['24']?.J ?? NaN, 6);
        expect(s?.labTotal).toBe(0);
        expect(s?.total).toBeCloseTo(goldenSections['24']?.M ?? NaN, 6);
    });

    it('section 30 slot = Excel rows 294–297 (desc, E, I, K, M, note) and subtotal 34,300', () => {
        const rows = sectionRows(undefined, 30);
        const excel = ['R294', 'R295', 'R296', 'R297'];
        expect(rows.map(r => r.key)).toEqual(['D3', 'D4', 'D5', 'W4'].map(k => `door-window:wood:${k}`));
        rows.forEach((r, i) => {
            const g = goldenLines[excel[i] ?? ''];
            expect(r.qty).toBe(g?.E);
            expect(r.matUnit).toBe(g?.I);
            expect(r.labUnit).toBe(g?.K);
            expect(r.total).toBeCloseTo(g?.M ?? NaN, 6);
        });
        expect(rows.map(r => r.note)).toEqual([WOOD_DOOR_NOTE, WOOD_DOOR_NOTE, WOOD_DOOR_NOTE, undefined]);
        expect(rows[3]?.desc).toBe('W4-บานวงกลม ช่องแสงติดตาย ขนาด Dia.1.1 ม.');
        const s = section(undefined, 30);
        expect(s?.matTotal).toBeCloseTo(goldenSections['30']?.J ?? NaN, 6);
        expect(s?.labTotal).toBeCloseTo(goldenSections['30']?.L ?? NaN, 6);
        expect(s?.total).toBeCloseTo(goldenSections['30']?.M ?? NaN, 6);
    });

    it('adding an aluminium window adds a BOQ 24 row priced W × H × rate, and its opening area', () => {
        const next: DoorWindowInput = {
            ...input,
            windows: [...input.windows, openingRow({ name: 'W5-บานกระทุ้งล่าง ขนาด 1.0 x 0.6 ม.', type: ALUMINIUM, count: 3, width: 1, height: 0.6, rate: 3500 })],
        };
        const rows = sectionRows(next, 24);
        const w5 = rows.find(r => r.key === 'door-window:aluminium:W5');
        expect(w5?.itemNo).toBe('10)');
        expect(w5?.matUnit).toBeCloseTo(2100, 9);          // 1.0 × 0.6 × 3,500
        expect(w5?.total).toBeCloseTo(6300, 9);            // × 3 sets
        expect(section(next, 24)?.total).toBeCloseTo(99277.5 + 6300, 6);
        const o = doorWindow.compute(next, ctx);
        expect(o[openingKey('ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น')]).toBeCloseTo(34.6175 + 1.8, 9);
        expect(o.R191).toBe(7);
    });

    it('changing D2 to wood moves it to section 30 (4,000 / 800, door note) and adds a frame', () => {
        const doors = input.doors.map(r => (itemCode(r.name) === 'D2' ? { ...r, type: WOOD } : r));
        const next = { ...input, doors };
        expect(sectionRows(next, 24).map(r => r.key)).not.toContain('door-window:aluminium:D2');
        const d2 = sectionRows(next, 30).find(r => r.key === 'door-window:wood:D2');
        expect(d2?.itemNo).toBe('1)');                     // schedule order: D2 before D3
        expect(sectionRows(next, 30).map(r => r.key.split(':')[2])).toEqual(['D2', 'D3', 'D4', 'D5', 'W4']);
        expect(d2?.matUnit).toBe(4000);
        expect(d2?.labUnit).toBe(800);
        expect(d2?.note).toBe(WOOD_DOOR_NOTE);
        expect(doorWindow.compute(next, ctx).R191).toBe(8);
        expect(section(next, 24)?.total).toBeCloseTo(99277.5 - 9225, 6);
    });

    it('typed rate / prices override the defaults; a changed size re-prices aluminium', () => {
        const doors = input.doors.map(r => {
            const code = itemCode(r.name);
            if (code === 'D1') return { ...r, width: 3 };                       // 3 × 2.05 × 3,000 = 18,450
            if (code === 'D2') return { ...r, rate: 4000 };                     // 1.5 × 2.05 × 4,000 = 12,300
            if (code === 'D6') return { ...r, matPrice: 10000, labPrice: 500 };
            return r;
        });
        const [d1, d2, d6] = slotRows({ ...input, doors }, ALUMINIUM);
        expect(d1?.type === 'item' && d1.mat).toBeCloseTo(18450, 9);
        expect(d2?.type === 'item' && d2.mat).toBeCloseTo(12300, 9);
        expect(d6?.type === 'item' ? [d6.mat, d6.lab] : null).toEqual([10000, 500]);
    });

    it('row keys follow the item code; rows without a code or with a duplicate code stay unique', () => {
        const next: DoorWindowInput = {
            doors: [
                openingRow({ name: 'D1-a', type: ALUMINIUM, count: 1, width: 1, height: 1 }),
                openingRow({ name: 'd1-b', type: ALUMINIUM, count: 1, width: 1, height: 1 }),
                openingRow({ name: '', type: '', count: 0, width: 0, height: 0 }),
            ],
            windows: [openingRow({ name: 'ช่องแสง', type: WOOD, count: 1, width: 1, height: 1 })],
        };
        expect(scheduleRows(next).map(t => t.key)).toEqual(['D1', 'D1~2', 'D#3', 'W#1']);
        // the blank row (no ชนิดบาน) is in no BOQ slot, like Excel's FILTER
        expect(slotRows(next, ALUMINIUM)).toHaveLength(2);
        expect(slotRows(next, WOOD).map(r => r.key)).toEqual(['W#1']);
    });

    it('blank / invalid numbers count as 0', () => {
        const next: DoorWindowInput = {
            doors: [openingRow({ name: 'D1', type: ALUMINIUM, count: Number.NaN, width: 2, height: Number.NaN })],
            windows: [],
        };
        const o = doorWindow.compute(next, ctx);
        expect(o['opening.total']).toBe(0);
        expect(slotRows(next, ALUMINIUM)[0]).toMatchObject({ mat: 0, qty: { kind: 'input', value: 0 } });
    });
});
