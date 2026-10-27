// QA edge tests (group U3) for brick: blank, wall area (rectangle / gable triangle), opening deduction, the shared-group
// decision D1 (an opening group is subtracted once, Excel subtracts it on every matching row), every brick type /
// thickness / wall part, tables, BOQ rows R179-R183, and journey skip. Hand-computed from
// docs/excel-spec/03-roof-brick-plaster-doors.md section 4. Note: the app has no brick-piece or mortar quantity
// (Excel prices per m2 of wall), so there is nothing to test for those.
import { describe, expect, it } from 'vitest';
import {
    brick, brickOpenings, brickWallResults, BRICK_BOQ_ROWS, BRICK_THICKNESSES, BRICK_TYPES, BRICK_WALL_PARTS,
    excelStyleOpenings, netByPartKey, openingKey, unmatchedOpenings, WALL_PARTS, wallArea, WALL_SHAPES,
    type BrickInput, type BrickWall,
} from '.';
import { openingRow, ALUMINIUM, WOOD, type DoorWindowInput } from '../door-window';
import { computeProject, createProject } from '../../project';
import type { CalcContext } from '../types';
import type { BoqItemRow } from '../../boq/types';

const wall = (p: Partial<BrickWall> = {}): BrickWall => ({
    wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 10, height: 3, ...p,
});
const ctxWith = (dw?: Record<string, number>): CalcContext => ({ outputs: id => (id === 'door-window' ? dw : undefined) });
const K = openingKey('ผนังรอบบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น');
const compute = (walls: BrickWall[], dw?: Record<string, number>) => brick.compute({ walls }, ctxWith(dw));
const blank = (): BrickInput => brick.blank?.() ?? brick.defaults();

function runProject(opts: { walls?: BrickWall[]; dw?: DoorWindowInput; skipped?: string[] } = {}) {
    const p = createProject('blank');
    if (opts.walls) p.calculators.brick = { walls: opts.walls };
    if (opts.dw) p.calculators['door-window'] = opts.dw;
    if (opts.skipped) p.journey = Object.fromEntries(opts.skipped.map(s => [s, 'skipped' as const]));
    const res = computeProject(p);
    const sec = res.boq.sections.find(s => s.no === 17);
    const row = (key: string): BoqItemRow => {
        const r = sec?.rows.find(x => x.key === key);
        if (r?.type !== 'item') throw new Error(`no BOQ row ${key}`);
        return r;
    };
    return { res, sec, row, out: res.calcOutputs.brick };
}

describe('brick edge: blank()', () => {
    it('blank has no walls', () => {
        expect(blank()).toEqual({ walls: [] });
    });
    it('every output finite and 0; BOQ-linked R179-R182 are 0', () => {
        const out = brick.compute(blank(), ctxWith());
        for (const [k, v] of Object.entries(out)) { expect(Number.isFinite(v), k).toBe(true); expect(v, k).toBe(0); }
        for (const l of brick.boqLinks) expect(out[l.output], l.line).toBe(0);
    });
    it('blank project: R179-R183 have qty 0 and no money', () => {
        const { row } = runProject();
        for (const k of ['R179', 'R180', 'R181', 'R182', 'R183']) { expect(row(k).qty, k).toBe(0); expect(row(k).total, k).toBe(0); }
    });
    it('blank walls with openings in the schedule: nothing to deduct from, so net stays 0 and the openings are "unmatched"', () => {
        const out = compute([], { [K]: 5 });
        expect(out.net).toBe(0);
        expect(out.unmatchedOpenings).toBe(5);
    });
});

describe('brick edge: wall area G (rectangle = L x H, triangle = 0.5 x L x H)', () => {
    it.each([
        [10, 3, 'rect', 30], [10, 3, 'triangle', 15], [10, 3, undefined, 30], [0, 3, 'rect', 0], [10, 0, 'triangle', 0],
        [7, 3, 'triangle', 10.5], [6, 2.65, 'triangle', 7.95], [42.5, 3.5, 'rect', 148.75], [0.1, 0.1, 'rect', 0.01],
        [-5, 3, 'rect', -15], [2.5, 3.5, 'rect', 8.75],
    ] as const)('%f x %f %s -> %f', (l, h, shape, area) => {
        const w = wall({ length: l, height: h, ...(shape ? { shape } : {}) });
        expect(wallArea(w)).toBeCloseTo(area, 9);
        expect(compute([w]).gross).toBeCloseTo(area, 9);
    });
    it('shape decides the factor, not the row position: a triangle in row 1 is halved, a rectangle in row 9 is full (Excel rows 5-7 / 8-20 rule is replaced by an explicit shape, D1)', () => {
        const walls = [wall({ shape: 'triangle' }), ...Array.from({ length: 8 }, () => wall({ length: 1, height: 1 })), wall({ shape: 'rect' })];
        const out = compute(walls);
        expect(out.gross).toBeCloseTo(15 + 8 + 30, 9);
    });
    it('WALL_SHAPES lists both options', () => {
        expect(WALL_SHAPES.map(s => s.value)).toEqual(['rect', 'triangle']);
    });
    it('NaN / Infinity length counts as 0; a huge wall stays finite', () => {
        expect(wallArea(wall({ length: Number.NaN }))).toBe(0);
        expect(wallArea(wall({ height: Infinity }))).toBe(0);
        const out = compute([wall({ length: 1e9, height: 1e9 })]);
        expect(out.gross).toBe(1e18);
        for (const v of Object.values(out)) expect(Number.isFinite(v)).toBe(true);
    });
    it('decimal lengths: 3.3 x 2.55 = 8.415', () => {
        expect(wallArea(wall({ length: 3.3, height: 2.55 }))).toBeCloseTo(8.415, 9);
    });
});

describe('brick edge: opening deduction (H = SUMIFS by part, brick, thickness) and net I = G - H', () => {
    it('opening 4.5 in the same group: net 30 - 4.5 = 25.5', () => {
        const out = compute([wall()], { [K]: 4.5 });
        expect(out.gross).toBe(30);
        expect(out.openings).toBe(4.5);
        expect(out.net).toBe(25.5);
        expect(out.R179).toBe(25.5);
        expect(out[netByPartKey('ผนังรอบบ้าน')]).toBe(25.5);
        expect(out.unmatchedOpenings).toBe(0);
    });
    it('opening of another part is not deducted and is reported as unmatched', () => {
        const dw = { [openingKey('ผนังภายในบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น')]: 4.5 };
        const out = compute([wall()], dw);
        expect(out.net).toBe(30);
        expect(out.unmatchedOpenings).toBe(4.5);
    });
    it.each([
        ['brick type differs', openingKey('ผนังรอบบ้าน', 'อิฐมวลเบา', 'ครึ่งแผ่น')],
        ['thickness differs', openingKey('ผนังรอบบ้าน', 'อิฐมอญ', 'เต็มแผ่น')],
        ['light-wall option (never a brick row)', openingKey('ผนังรอบบ้าน', 'ผนังเบา', 'ครึ่งแผ่น')],
    ])('no deduction when %s', (_n, key) => {
        const out = compute([wall()], { [key]: 3 });
        expect(out.net).toBe(30);
        expect(out.unmatchedOpenings).toBe(3);
    });
    it('no door-window calculator at all -> no openings and no crash', () => {
        const out = compute([wall()]);
        expect(out.net).toBe(30);
    });
    it('keys with trailing spaces are trimmed before matching (oddity 5)', () => {
        const out = compute([wall()], { 'opening|ผนังรอบบ้าน |อิฐมอญ |ครึ่งแผ่น ': 2 });
        expect(out.net).toBe(28);
    });
    it('zero and non-finite opening values are ignored', () => {
        expect(brickOpenings(ctxWith({ [K]: 0, 'opening.total': 9 }))).toEqual({});
        expect(brickOpenings(ctxWith({ [K]: Number.NaN }))).toEqual({});
    });
    it('opening exactly equal to the wall: net 0', () => {
        expect(compute([wall()], { [K]: 30 }).net).toBe(0);
    });
    it('rounding: 8.415 wall minus 1.2 + 2.4 openings = 4.815 (decimals do not drift)', () => {
        const out = compute([wall({ length: 3.3, height: 2.55 })], { [K]: 1.2 + 2.4 });
        expect(out.net).toBeCloseTo(4.815, 9);
    });
    // Excel does the same (G - H < 0), but a negative wall area makes a negative BOQ quantity and a negative plaster area.
    // Kept Excel-exact on purpose (the oracle compares every row with Excel); the owner decides whether to clamp
    // (docs/qa/BUGS.md, open question). The test pins today's value so a change is deliberate.
    it('opening bigger than the wall: net 30 m2 wall with 40 m2 openings gives -10 m2, like Excel G - H', () => {
        const out = compute([wall()], { [K]: 40 });
        expect(out.net).toBeCloseTo(-10, 9);
    });
});

describe('brick edge: shared opening group, decision D1 (deduct a group once)', () => {
    const rows = (...areas: [number, number][]) => areas.map(([l, h]) => wall({ length: l, height: h }));
    it('2 rows of the same group (20 m2 + 10 m2), openings 6: shares 4 and 2, deducted once = 6 (Excel would deduct 12)', () => {
        const input = { walls: rows([10, 2], [5, 2]) };
        const r = brickWallResults(input, { [K]: 6 });
        expect(r[0]?.openings).toBeCloseTo(4, 9);
        expect(r[1]?.openings).toBeCloseTo(2, 9);
        expect(r[0]?.net).toBeCloseTo(16, 9);
        expect(r[1]?.net).toBeCloseTo(8, 9);
        expect(excelStyleOpenings(input, { [K]: 6 })).toBe(12);
        const out = compute(input.walls, { [K]: 6 });
        expect(out.openings).toBeCloseTo(6, 9);
        expect(out.net).toBeCloseTo(24, 9);   // Excel would give 18
        expect(out.R179).toBeCloseTo(24, 9);
    });
    it('three rows share in proportion to area (10, 20, 30 m2; opening 12 -> 2, 4, 6)', () => {
        const r = brickWallResults({ walls: rows([10, 1], [10, 2], [10, 3]) }, { [K]: 12 });
        [2, 4, 6].forEach((v, i) => expect(r[i]?.openings).toBeCloseTo(v, 9));
    });
    it('rows with no area yet (0 m2 each): the whole group goes to the first row, others 0', () => {
        const r = brickWallResults({ walls: rows([0, 3], [0, 3]) }, { [K]: 6 });
        expect(r[0]?.openings).toBe(6);
        expect(r[1]?.openings).toBe(0);
    });
    it('a zero-area row next to a real row: the real row takes its full share (0 for the empty one)', () => {
        const r = brickWallResults({ walls: rows([0, 3], [10, 3]) }, { [K]: 6 });
        expect(r[0]?.openings).toBe(0);
        expect(r[1]?.openings).toBeCloseTo(6, 9);
    });
    it('sum of shares equals the group total for awkward decimals (1/3 split)', () => {
        const walls = rows([1, 1], [1, 1], [1, 1]);
        const r = brickWallResults({ walls }, { [K]: 1 });
        expect(r.reduce((s, x) => s + x.openings, 0)).toBeCloseTo(1, 12);
    });
    it('different groups never mix: the second group keeps its own opening', () => {
        const k2 = openingKey('ผนังภายในบ้าน', 'อิฐมอญ', 'ครึ่งแผ่น');
        const walls = [wall(), wall({ wallPart: 'ผนังภายในบ้าน' }), wall()];
        const r = brickWallResults({ walls }, { [K]: 6, [k2]: 3 });
        expect(r[0]?.openings).toBeCloseTo(3, 9);
        expect(r[2]?.openings).toBeCloseTo(3, 9);
        expect(r[1]?.openings).toBe(3);
    });
    it('a triangle row and a rectangle row of one group split by their halved area (15 and 30; opening 9 -> 3, 6)', () => {
        const r = brickWallResults({ walls: [wall({ shape: 'triangle' }), wall()] }, { [K]: 9 });
        expect(r[0]?.openings).toBeCloseTo(3, 9);
        expect(r[1]?.openings).toBeCloseTo(6, 9);
    });
    it('deleting a row of a shared group moves the full opening to the remaining row', () => {
        const input = { walls: rows([10, 2], [5, 2]) };
        const after = brickWallResults({ walls: input.walls.slice(1) }, { [K]: 6 });
        expect(after[0]?.openings).toBe(6);
        expect(after[0]?.net).toBe(4);
    });
    it('unmatchedOpenings lists only groups with no wall row', () => {
        const other = openingKey('ผนังภายนอกบ้าน', 'อิฐมอญ', 'เต็มแผ่น');
        expect(unmatchedOpenings({ walls: [wall()] }, { [K]: 6, [other]: 2 })).toEqual({ [other]: 2 });
    });
});

describe('brick edge: dropdown options feed the right BOQ line', () => {
    it.each([
        ['อิฐมอญ', 'ครึ่งแผ่น', 'R179'], ['อิฐมอญ', 'เต็มแผ่น', 'R180'], ['อิฐมวลเบา', 'ครึ่งแผ่น', 'R181'], ['อิฐมวลเบา', 'เต็มแผ่น', 'R182'],
    ])('%s / %s -> %s only', (type, thick, line) => {
        const out = compute([wall({ brickType: type, thickness: thick })]);
        for (const b of BRICK_BOQ_ROWS) expect(out[b.line], b.line).toBe(b.line === line ? 30 : 0);
    });
    it('dropdown lists are as in Excel and BRICK_BOQ_ROWS covers each combination once', () => {
        expect([...BRICK_TYPES]).toEqual(['อิฐมวลเบา', 'อิฐมอญ']);
        expect([...BRICK_THICKNESSES]).toEqual(['ครึ่งแผ่น', 'เต็มแผ่น']);
        expect(BRICK_BOQ_ROWS).toHaveLength(BRICK_TYPES.length * BRICK_THICKNESSES.length);
        expect([...BRICK_WALL_PARTS].sort()).toEqual([...WALL_PARTS].sort());
    });
    it.each([...WALL_PARTS])('wall part %s gets its own net|part output', (part) => {
        const out = compute([wall({ wallPart: part, length: 4, height: 2.5 })]);
        expect(out[netByPartKey(part)]).toBe(10);
        const parts = Object.keys(out).filter(k => k.startsWith('net|'));
        expect(parts).toEqual([netByPartKey(part)]);
    });
    it('several rows of one part add up in net|part, across brick types', () => {
        const out = compute([wall({ length: 4, height: 2.5 }), wall({ brickType: 'อิฐมวลเบา', length: 2, height: 2 })]);
        expect(out[netByPartKey('ผนังรอบบ้าน')]).toBe(14);
        expect(out.R179).toBe(10);
        expect(out.R181).toBe(4);
    });
    it('brick type / thickness with stray spaces still land on the BOQ line (trimmed)', () => {
        const out = compute([wall({ brickType: ' อิฐมอญ ', thickness: ' เต็มแผ่น ' })]);
        expect(out.R180).toBe(30);
    });
    it('an unknown brick type (e.g. the door-sheet-only "ผนังเบา") has no BOQ line but still counts in net by part - pinned', () => {
        const out = compute([wall({ brickType: 'ผนังเบา' })]);
        for (const b of BRICK_BOQ_ROWS) expect(out[b.line]).toBe(0);
        expect(out.net).toBe(30);
        expect(out[netByPartKey('ผนังรอบบ้าน')]).toBe(30);
    });
});

describe('brick edge: table size (0 / 1 / Excel 16 / more / delete)', () => {
    it('Excel sample (6 rows): gross 148.75 + 93.45 + 8.75 + 10.5 + 7.95 + 10.5 = 279.9 and R183 base', () => {
        const out = brick.compute(brick.defaults(), ctxWith());
        expect(out.gross).toBeCloseTo(279.9, 9);
        expect(out.net).toBeCloseTo(279.9, 9);   // no door-window outputs -> no deduction
    });
    it('0 rows, 1 row, 16 rows (Excel max), 40 rows', () => {
        expect(compute([]).gross).toBe(0);
        expect(compute([wall()]).gross).toBe(30);
        expect(compute(Array.from({ length: 16 }, () => wall())).gross).toBe(480);
        const forty = compute(Array.from({ length: 40 }, () => wall({ length: 1, height: 1 })));
        expect(forty.gross).toBe(40);
        expect(forty.R179).toBe(40);
    });
    it('delete a wall: totals fall by exactly its area', () => {
        const walls = [wall(), wall({ length: 4, height: 2.5 }), wall({ brickType: 'อิฐมวลเบา' })];
        const full = compute(walls);
        const less = compute(walls.slice(0, 2));
        expect((full.gross ?? 0) - (less.gross ?? 0)).toBe(30);
        expect(less.R181).toBe(0);
    });
    it('a row with no wall part still counts in the BOQ line (its net by part key is "net|")', () => {
        const out = compute([wall({ wallPart: '' })]);
        expect(out.R179).toBe(30);
        expect(out['net|']).toBe(30);
    });
});

describe('brick edge: BOQ rows through computeProject', () => {
    it('clay half-brick 10 x 3: R179 qty 30, material 280 x 30 = 8,400, labour 220 x 30 = 6,600, total 15,000', () => {
        const { row } = runProject({ walls: [wall()] });
        const r = row('R179');
        expect(r.qty).toBe(30);
        expect(r.matTotal).toBe(8400);
        expect(r.labTotal).toBe(6600);
        expect(r.total).toBe(15000);
    });
    it('clay full brick is double the half-brick price: R180 mat 560, lab 440 -> 30 m2 = 16,800 + 13,200', () => {
        const { row } = runProject({ walls: [wall({ thickness: 'เต็มแผ่น' })] });
        const r = row('R180');
        expect([r.matUnit, r.labUnit]).toEqual([560, 440]);
        expect(r.matTotal).toBe(16800);
        expect(r.labTotal).toBe(13200);
    });
    it('AAC half brick 280 / 130, full 560 / 260', () => {
        const half = runProject({ walls: [wall({ brickType: 'อิฐมวลเบา' })] }).row('R181');
        expect([half.matUnit, half.labUnit]).toEqual([280, 130]);
        expect(half.total).toBe(30 * 410);
        const full = runProject({ walls: [wall({ brickType: 'อิฐมวลเบา', thickness: 'เต็มแผ่น' })] }).row('R182');
        expect([full.matUnit, full.labUnit]).toEqual([560, 260]);
        expect(full.total).toBe(30 * 820);
    });
    it('R183 stiffener columns/lintels = sum of the four lines: 30 + 10 = 40 m2 x (35 + 100) = 5,400', () => {
        const { row } = runProject({ walls: [wall(), wall({ brickType: 'อิฐมวลเบา', length: 5, height: 2 })] });
        expect(row('R183').qty).toBe(40);
        expect(row('R183').total).toBe(5400);
    });
    it('chain door-window -> brick: aluminium door 2 x 1.5 count 2 (6 m2) on the same wall group: net 24, R179 = 24', () => {
        const dw: DoorWindowInput = { doors: [openingRow({ name: 'D1-x', type: ALUMINIUM, count: 2, width: 2, height: 1.5 })], windows: [] };
        const { out, row } = runProject({ walls: [wall()], dw });
        expect(out?.openings).toBe(6);
        expect(out?.net).toBe(24);
        expect(row('R179').qty).toBe(24);
        expect(row('R183').qty).toBe(24);
    });
    it('chain: a wood door on an inner wall does not reduce the outer wall', () => {
        const dw: DoorWindowInput = { doors: [openingRow({ name: 'D3-x', type: WOOD, count: 3, width: 0.8, height: 2, wallPart: 'ผนังภายในบ้าน' })], windows: [] };
        const { out } = runProject({ walls: [wall(), wall({ wallPart: 'ผนังภายในบ้าน', length: 5, height: 3 })], dw });
        expect(out?.[netByPartKey('ผนังรอบบ้าน')]).toBe(30);
        expect(out?.[netByPartKey('ผนังภายในบ้าน')]).toBeCloseTo(15 - 4.8, 9);
    });
    it('chain: changing a door width changes brick net immediately (2 -> 3 m wide: 4.5 x 2 = 9 m2)', () => {
        const mk = (w: number): DoorWindowInput => ({ doors: [openingRow({ name: 'D1-x', type: ALUMINIUM, count: 2, width: w, height: 1.5 })], windows: [] });
        expect(runProject({ walls: [wall()], dw: mk(2) }).out?.net).toBe(24);
        expect(runProject({ walls: [wall()], dw: mk(3) }).out?.net).toBe(21);
    });
    it('level skipped (brick): R179-R183 qty 0 and money 0 even with walls', () => {
        const { row, out } = runProject({ walls: [wall(), wall({ thickness: 'เต็มแผ่น' })], skipped: ['brick'] });
        for (const k of ['R179', 'R180', 'R181', 'R182', 'R183']) { expect(row(k).qty, k).toBe(0); expect(row(k).total, k).toBe(0); }
        for (const v of Object.values(out ?? {})) expect(v).toBe(0);
    });
    it('door-window skipped: walls are no longer reduced by openings', () => {
        const dw: DoorWindowInput = { doors: [openingRow({ name: 'D1-x', type: ALUMINIUM, count: 2, width: 2, height: 1.5 })], windows: [] };
        expect(runProject({ walls: [wall()], dw, skipped: ['door-window'] }).out?.net).toBe(30);
    });
    it('default (sample) project: the Excel brick lines are untouched by this calculator edge setup', () => {
        const p = createProject('sample');
        const res = computeProject(p);
        const sec = res.boq.sections.find(s => s.no === 17);
        const r179 = sec?.rows.find(r => r.key === 'R179');
        expect(r179?.type === 'item' ? r179.qty : -1).toBeCloseTo(199.9825, 6);
    });
});
