import { describe, expect, it } from 'vitest';
import {
    brick, brickOpenings, brickWallResults, BRICK_WALL_PARTS, excelStyleOpenings, openingKey, unmatchedOpenings,
    WALL_PARTS, wallArea,
    type BrickInput, type BrickWallResult,
} from '.';
import { plaster } from '../plaster';
import { doorWindow } from '../door-window';
import { computeProject, createProject } from '../../project';
import { defineCalculator, type CalcContext } from '../types';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

/** Excel v5 door/window schedule (sheet 12 rows 6–14, 18–21): part, brick, thickness, count G, width H, height I. */
const SCHEDULE: [string, string, string, number, number, number][] = [
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 1, 2.6, 2.05],    // D1
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 1, 1.5, 2.05],    // D2
    ['ผนังภายในบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 3, 0.8, 2.0],   // D3
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 1, 0.8, 2.0],     // D4
    ['ผนังภายในบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 2, 0.7, 2.0],   // D5
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 1, 1.6, 2.05],    // D6
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 1, 1.65, 2.65],   // D7
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 1, 0.6, 2.65],    // D8
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 1, 2.4, 2.05],    // D9
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 2, 1.3, 1.2],     // W1
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 4, 0.6, 1.8],     // W2
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 2, 1.8, 0.5],     // W3
    ['ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น', 1, 1.1, 1.1],     // W4
];

/** Door-window outputs as that calculator publishes them: `opening|part|brick|thickness` = Σ K (= H·I·G). */
function scheduleOutputs(): Record<string, number> {
    const out: Record<string, number> = { 'opening.total': 0 };
    for (const [part, type, thick, g, h, i] of SCHEDULE) {
        const k = `opening|${part}|${type}|${thick}`;
        out[k] = (out[k] ?? 0) + h * i * g;
    }
    return out;
}

/** `null` = no door-window calculator. */
const stubCtx = (dw: Record<string, number> | null = scheduleOutputs()): CalcContext => ({
    outputs: id => (id === 'door-window' ? (dw ?? undefined) : undefined),
});

const at = (rows: BrickWallResult[], i: number): BrickWallResult => {
    const r = rows[i];
    if (!r) throw new Error(`no row ${i}`);
    return r;
};

describe('ก่ออิฐ_Brick (sheet 13)', () => {
    it('Excel sample: G, H, I of rows 5–10', () => {
        const rows = brickWallResults(brick.defaults(), brickOpenings(stubCtx()));
        const expected: [number, number, number][] = [
            [148.75, 34.6175, 114.1325],
            [93.45, 7.6, 85.85],
            [8.75, 0, 8.75],
            [10.5, 0, 10.5],
            [7.95, 0, 7.95],
            [10.5, 0, 10.5],
        ];
        expect(rows).toHaveLength(expected.length);
        expected.forEach(([g, h, net], i) => {
            expect(at(rows, i).area).toBeCloseTo(g, 9);
            expect(at(rows, i).openings).toBeCloseTo(h, 9);
            expect(at(rows, i).net).toBeCloseTo(net, 9);
        });
    });

    it('the opening groups equal the Excel H values (34.6175 / 7.6), also from the real door-window sheet', () => {
        const real = doorWindow.compute(doorWindow.defaults(), stubCtx(null));
        for (const o of [brickOpenings(stubCtx()), brickOpenings(stubCtx(real))]) {
            expect(o[openingKey('ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น')]).toBeCloseTo(34.6175, 9);
            expect(o[openingKey('ผนังภายในบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น')]).toBeCloseTo(7.6, 9);
            expect(Object.keys(o)).toHaveLength(2);
        }
    });

    it('outputs E179–E182 = golden BOQ, net by wall part for the plaster sheet', () => {
        const out = brick.compute(brick.defaults(), stubCtx());
        expect(out.R179).toBeCloseTo(golden.lines.R179.E, 9);
        expect(out.R180).toBeCloseTo(golden.lines.R180.E, 9);
        expect(out.R181).toBeCloseTo(golden.lines.R181.E, 9);
        expect(out.R182).toBe(golden.lines.R182.E);
        expect(out['net|ผนังรอบบ้าน']).toBeCloseTo(114.1325, 9);
        expect(out['net|ผนังภายในบ้าน']).toBeCloseTo(85.85, 9);
        expect(out['net|ผนังภายนอกบ้าน']).toBeCloseTo(8.75, 9);
        expect(out['net|ผนังรอบบ้าน-พิเศษ']).toBeCloseTo(28.95, 9);
        expect(out.gross).toBeCloseTo(279.9, 9);
        expect(out.openings).toBeCloseTo(42.2175, 9);
        expect(out.net).toBeCloseTo(237.6825, 9);
        expect(out.unmatchedOpenings).toBe(0);
    });

    it('without door-window outputs nothing is deducted', () => {
        const out = brick.compute(brick.defaults(), stubCtx(null));
        expect(out.R179).toBeCloseTo(148.75 + 93.45, 9);
    });

    it('with the door-window sheet: BOQ section 17 (E179–E183, subtotal) and, through plaster, section 18', () => {
        const calcs = [doorWindow, brick, plaster];
        const res = computeProject(createProject(), calcs);
        const s17 = res.boq.sections.find(s => s.no === 17);
        const row = (k: string) => s17?.rows.find(r => r.key === k) as BoqItemRow;
        for (const k of ['R179', 'R180', 'R181', 'R182', 'R183'] as const) {
            expect(row(k).qty).toBeCloseTo(golden.lines[k].E, 9);
            expect(row(k).total).toBeCloseTo(golden.lines[k].M, 6);
        }
        expect(s17?.matTotal).toBeCloseTo(91783.0775, 6);
        expect(s17?.labTotal).toBeCloseTo(90266.375, 6);
        expect(s17?.total).toBeCloseTo(182049.4525, 6);
        const s18 = res.boq.sections.find(s => s.no === 18);
        expect(s18?.total).toBeCloseTo(165427.165, 6);

        // Same with a stand-in door-window that only publishes the opening areas.
        const stub = defineCalculator<Record<string, never>>({
            id: 'door-window', sheetName: '', title: '', titleEn: '', sections: [], deps: [],
            defaults: () => ({}), compute: () => scheduleOutputs(), boqLinks: [],
        });
        const res2 = computeProject(createProject(), [stub, brick, plaster]);
        expect(res2.boq.sections.find(s => s.no === 17)?.total).toBeCloseTo(182049.4525, 6);
    });

    it('dropdown B (sheet 13 order) holds the same wall parts as the door-window sheet', () => {
        expect(BRICK_WALL_PARTS).toEqual(['ผนังภายในบ้าน', 'ผนังรอบบ้าน-พิเศษ', 'ผนังรอบบ้าน', 'ผนังภายนอกบ้าน']);
        expect([...BRICK_WALL_PARTS].sort()).toEqual([...WALL_PARTS].sort());
    });

    it('triangle rows use ½·E·F; rows without a shape (added rows) are rectangles', () => {
        expect(wallArea({ wallPart: '', brickType: '', thickness: '', length: 4, height: 3, shape: 'triangle' })).toBe(6);
        expect(wallArea({ wallPart: '', brickType: '', thickness: '', length: 4, height: 3 })).toBe(12);
        const input = brick.defaults();
        input.walls.push({ wallPart: 'ผนังภายในบ้าน', brickType: 'อิฐมวลเบา', thickness: 'เต็มแผ่น', length: 4, height: 3 });
        const out = brick.compute(input, stubCtx());
        expect(out.R182).toBe(12);
        expect(out['net|ผนังภายในบ้าน']).toBeCloseTo(85.85 + 12, 9);
        expect(out.R179).toBeCloseTo(199.9825, 9);
    });

    it('changing a length changes the gross and net area', () => {
        const input = brick.defaults();
        const first = input.walls[0];
        if (!first) throw new Error('no row');
        input.walls[0] = { ...first, length: 50 };   // 50 × 3.5 = 175 − 34.6175
        expect(brick.compute(input, stubCtx()).R179).toBeCloseTo(175 - 34.6175 + 85.85, 9);
    });

    it('D1: an opening group is deducted once when two wall rows share part/brick/thickness', () => {
        const input: BrickInput = {
            walls: [
                { wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 30, height: 3.5, shape: 'rect' },   // 105
                { wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 12.5, height: 3.5, shape: 'rect' }, // 43.75
            ],
        };
        const openings = brickOpenings(stubCtx());
        const rows = brickWallResults(input, openings);
        // Shared in proportion to G: 34.6175 × 105/148.75 and × 43.75/148.75.
        expect(at(rows, 0).openings).toBeCloseTo(34.6175 * 105 / 148.75, 9);
        expect(at(rows, 1).openings).toBeCloseTo(34.6175 * 43.75 / 148.75, 9);
        expect(at(rows, 0).openings + at(rows, 1).openings).toBeCloseTo(34.6175, 12);
        // Same total as the single Excel row 5.
        expect(brick.compute(input, stubCtx()).R179).toBeCloseTo(114.1325, 9);
        // Excel would subtract 34.6175 from both rows: 34.6175 m² too much.
        expect(excelStyleOpenings(input, openings) - 34.6175).toBeCloseTo(34.6175, 9);
        // In the sample rows 8–10 share a key but have no openings → no difference from Excel.
        expect(excelStyleOpenings(brick.defaults(), openings)).toBeCloseTo(34.6175 + 7.6, 9);
    });

    it('rows with no area yet: the whole group goes to the first matching row', () => {
        const input: BrickInput = {
            walls: [
                { wallPart: 'ผนังภายในบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 0, height: 0 },
                { wallPart: 'ผนังภายในบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 0, height: 0 },
            ],
        };
        const rows = brickWallResults(input, brickOpenings(stubCtx()));
        expect(at(rows, 0).openings).toBeCloseTo(7.6, 12);
        expect(at(rows, 1).openings).toBe(0);
    });

    it('openings with no matching wall row are reported; trailing spaces still match', () => {
        const input: BrickInput = {
            walls: [{ wallPart: 'ผนังรอบบ้าน ', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น ', length: 42.5, height: 3.5, shape: 'rect' }],
        };
        const openings = brickOpenings(stubCtx());
        const out = brick.compute(input, stubCtx());
        expect(out.R179).toBeCloseTo(114.1325, 9);
        const unmatched = unmatchedOpenings(input, openings);
        expect(Object.keys(unmatched)).toEqual([openingKey('ผนังภายในบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น')]);
        expect(out.unmatchedOpenings).toBeCloseTo(7.6, 9);
    });
});
