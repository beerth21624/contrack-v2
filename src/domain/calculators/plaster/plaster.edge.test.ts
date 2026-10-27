// QA edge tests (group U3) for plaster: blank, area from brick walls x faces, exclusions, structure row (columns / beams),
// every wall part x kind x sides, tables, BOQ R189 / R190, journey skip, and the full chain
// door-window -> brick -> plaster -> paint through computeProject. Hand-computed from
// docs/excel-spec/03-roof-brick-plaster-doors.md section 5.
import { describe, expect, it } from 'vitest';
import {
    plaster, plasterRowArea, plasterTotal, PLASTER_KINDS, PLASTER_SIDES, PLASTER_WALL_PARTS, STRUCTURAL_WALL,
    STRUCTURAL_WALL_DEFAULT_AREA, type PlasterInput, type PlasterRow,
} from '.';
import { netByPartKey, type BrickWall } from '../brick';
import { ALUMINIUM, WOOD, openingRow, type DoorWindowInput } from '../door-window';
import { computeProject, createProject } from '../../project';
import type { CalcContext } from '../types';
import type { BoqItemRow } from '../../boq/types';

const EXT = 'ฉาบภายนอก';
const INT = 'ฉาบภายใน';
const row = (p: Partial<PlasterRow> = {}): PlasterRow => ({ wallPart: 'ผนังรอบบ้าน', kind: EXT, sides: 1, ...p });
/** ctx with brick net areas by wall part, as the brick sheet publishes them. */
const nets = (m: Record<string, number>): CalcContext => ({
    outputs: id => (id === 'brick' ? Object.fromEntries(Object.entries(m).map(([k, v]) => [netByPartKey(k), v])) : undefined),
});
const NETS = nets({ ผนังรอบบ้าน: 100, ผนังภายในบ้าน: 50, ผนังภายนอกบ้าน: 10, 'ผนังรอบบ้าน-พิเศษ': 20 });
const none: CalcContext = { outputs: () => undefined };
const blank = (): PlasterInput => plaster.blank?.() ?? plaster.defaults();

const bw = (p: Partial<BrickWall> = {}): BrickWall => ({
    wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 10, height: 3, ...p,
});

function runProject(opts: { walls?: BrickWall[]; dw?: DoorWindowInput; rows?: PlasterRow[]; skipped?: string[]; sample?: boolean } = {}) {
    const p = createProject(opts.sample ? 'sample' : 'blank');
    if (opts.walls) p.calculators.brick = { walls: opts.walls };
    if (opts.dw) p.calculators['door-window'] = opts.dw;
    if (opts.rows) p.calculators.plaster = { rows: opts.rows };
    if (opts.skipped) p.journey = Object.fromEntries(opts.skipped.map(s => [s, 'skipped' as const]));
    const res = computeProject(p);
    const item = (no: number, key: string): BoqItemRow => {
        const r = res.boq.sections.find(s => s.no === no)?.rows.find(x => x.key === key);
        if (r?.type !== 'item') throw new Error(`no BOQ row ${key}`);
        return r;
    };
    return { res, item, out: res.calcOutputs.plaster, paint: res.calcOutputs.paint };
}

describe('plaster edge: blank()', () => {
    it('blank keeps the 7 plaster rules of the sheet and only empties the structure-wall area', () => {
        const b = blank();
        expect(b.rows).toHaveLength(7);
        expect(b.rows.map(r => `${r.wallPart}|${r.kind}|${r.sides}`)).toEqual(plaster.defaults().rows.map(r => `${r.wallPart}|${r.kind}|${r.sides}`));
        expect(b.rows.find(r => r.wallPart === STRUCTURAL_WALL)?.manualArea).toBe(0);
    });
    it('with no brick walls (blank brick outputs) every output is finite and 0', () => {
        const out = plaster.compute(blank(), nets({}));
        for (const [k, v] of Object.entries(out)) { expect(Number.isFinite(v), k).toBe(true); expect(v, k).toBe(0); }
        for (const l of plaster.boqLinks) expect(out[l.output], l.line).toBe(0);
    });
    it('no brick calculator at all (standalone): still 0, no crash, no sample fallback', () => {
        const out = plaster.compute(blank(), none);
        expect(out.exterior).toBe(0);
        expect(out.interior).toBe(0);
    });
    it('blank project: R189 / R190 qty and money are 0', () => {
        const { item } = runProject();
        for (const k of ['R189', 'R190']) { expect(item(18, k).qty, k).toBe(0); expect(item(18, k).total, k).toBe(0); }
    });
});

describe('plaster edge: area = net brick area of the wall part x faces', () => {
    it('one face of รอบบ้าน (100 m2): 100; two faces: 200', () => {
        expect(plasterRowArea(row({ sides: 1 }), NETS)).toBe(100);
        expect(plasterRowArea(row({ sides: 2 }), NETS)).toBe(200);
    });
    it.each([...PLASTER_SIDES])('sides option %d -> area = 50 x sides', (s) => {
        expect(plasterRowArea(row({ wallPart: 'ผนังภายในบ้าน', sides: s }), NETS)).toBe(50 * s);
    });
    it('0 faces -> 0; negative -> negative (finite); decimal 1.5 faces -> 75', () => {
        expect(plasterRowArea(row({ sides: 0 }), NETS)).toBe(0);
        expect(plasterRowArea(row({ sides: -1 }), NETS)).toBe(-100);
        expect(plasterRowArea(row({ sides: 1.5 }), NETS)).toBe(150);
    });
    it('NaN faces -> 0', () => {
        expect(plasterRowArea(row({ sides: Number.NaN }), NETS)).toBe(0);
    });
    it.each([...PLASTER_WALL_PARTS.filter(p => p !== STRUCTURAL_WALL)])('wall part %s reads only its own brick net', (part) => {
        const expected: Record<string, number> = { ผนังรอบบ้าน: 100, ผนังภายในบ้าน: 50, ผนังภายนอกบ้าน: 10, 'ผนังรอบบ้าน-พิเศษ': 20 };
        expect(plasterRowArea(row({ wallPart: part }), NETS)).toBe(expected[part]);
    });
    it('a wall part with no brick row contributes 0', () => {
        expect(plasterRowArea(row({ wallPart: 'ผนังห้องใต้ดิน' }), NETS)).toBe(0);
    });
    it('wall part is compared trimmed; an empty wall part is 0 even if a "net|" key exists', () => {
        expect(plasterRowArea(row({ wallPart: ' ผนังรอบบ้าน ' }), NETS)).toBe(100);
        expect(plasterRowArea(row({ wallPart: '  ' }), nets({ '': 77 }))).toBe(0);
    });
    it('huge and decimal brick nets stay finite', () => {
        expect(plasterRowArea(row(), nets({ ผนังรอบบ้าน: 1e15 }))).toBe(1e15);
        expect(plasterRowArea(row(), nets({ ผนังรอบบ้าน: 0.1 + 0.2 }))).toBeCloseTo(0.3, 12);
    });
});

describe('plaster edge: structure row (columns / beams, typed area)', () => {
    it('area = typed face area x sides, brick net is ignored', () => {
        const r = row({ wallPart: STRUCTURAL_WALL, manualArea: 31.24, sides: 2 });
        expect(plasterRowArea(r, nets({ [STRUCTURAL_WALL]: 999 }))).toBeCloseTo(62.48, 9);
    });
    it('missing manual area -> 0; NaN -> 0; negative stays finite', () => {
        expect(plasterRowArea(row({ wallPart: STRUCTURAL_WALL }), NETS)).toBe(0);
        expect(plasterRowArea(row({ wallPart: STRUCTURAL_WALL, manualArea: Number.NaN }), NETS)).toBe(0);
        expect(plasterRowArea(row({ wallPart: STRUCTURAL_WALL, manualArea: -3 }), NETS)).toBe(-3);
    });
    it('Excel default structure area is 1 x 25 + 0.8 x 2.6 x 3 = 31.24', () => {
        expect(STRUCTURAL_WALL_DEFAULT_AREA).toBeCloseTo(25 + 0.8 * 2.6 * 3, 9);
    });
    it('column / beam faces are added to the exterior (default rule) without any brick wall', () => {
        const input: PlasterInput = { rows: [row({ wallPart: STRUCTURAL_WALL, manualArea: 12, sides: 1 })] };
        const out = plaster.compute(input, none);
        expect(out.exterior).toBe(12);
        expect(out.interior).toBe(0);
    });
    it('a structure row typed as interior goes to the interior total', () => {
        const input: PlasterInput = { rows: [row({ wallPart: STRUCTURAL_WALL, kind: INT, manualArea: 8, sides: 2 })] };
        expect(plaster.compute(input, none).interior).toBe(16);
    });
});

describe('plaster edge: kind (exterior / interior) decision table and exclusions', () => {
    it.each([
        [EXT, 100, 0], [INT, 0, 100], [`${INT} `, 0, 100], [` ${EXT}`, 100, 0], ['', 0, 0], ['ฉาบ', 0, 0], ['ไม่ฉาบ', 0, 0],
    ])('kind %j -> exterior %d, interior %d', (kind, e, i) => {
        const out = plaster.compute({ rows: [row({ kind })] }, NETS);
        expect(out.exterior).toBe(e);
        expect(out.interior).toBe(i);
        expect(out.total).toBe(e + i);
    });
    it('PLASTER_KINDS / PLASTER_SIDES are the Excel options', () => {
        expect([...PLASTER_KINDS]).toEqual([EXT, INT]);
        expect([...PLASTER_SIDES]).toEqual([1, 2]);
        expect(PLASTER_WALL_PARTS).toHaveLength(5);
    });
    it('every wall part x every kind x every side count adds to exactly one total', () => {
        for (const part of PLASTER_WALL_PARTS) for (const kind of PLASTER_KINDS) for (const s of PLASTER_SIDES) {
            const r = row({ wallPart: part, kind, sides: s, manualArea: 4 });
            const out = plaster.compute({ rows: [r] }, NETS);
            const area = plasterRowArea(r, NETS);
            expect(kind === EXT ? out.exterior : out.interior, `${part}/${kind}/${s}`).toBe(area);
            expect(kind === EXT ? out.interior : out.exterior, `${part}/${kind}/${s}`).toBe(0);
        }
    });
    it('exclusion: removing the "ผนังภายนอกบ้าน exterior" rule (show-brick wall) removes 2 x 10 = 20 m2 of exterior', () => {
        const d = plaster.defaults().rows;
        const full = plaster.compute({ rows: d }, NETS);
        const without = plaster.compute({ rows: d.filter(r => r.wallPart !== 'ผนังภายนอกบ้าน') }, NETS);
        expect((full.exterior ?? 0) - (without.exterior ?? 0)).toBe(20);
        expect(full.interior).toBe(without.interior);
    });
    it('Excel default rules with simple nets: exterior = 100 + 10 x 2 + 20 + 31.24 = 171.24, interior = 100 + 50 x 2 + 20 = 220', () => {
        const out = plaster.compute(plaster.defaults(), NETS);
        expect(out.exterior).toBeCloseTo(171.24, 9);
        expect(out.interior).toBe(220);
        expect(out.total).toBeCloseTo(391.24, 9);
        expect(out.R189).toBe(out.exterior);
        expect(out.R190).toBe(out.interior);
    });
    it('plasterTotal agrees with compute', () => {
        const input = plaster.defaults();
        expect(plasterTotal(input, NETS, EXT)).toBeCloseTo(171.24, 9);
        expect(plasterTotal(input, NETS, INT)).toBe(220);
    });
});

describe('plaster edge: table size (0 / 1 / Excel 18 / more / delete)', () => {
    it('0 rows', () => {
        const out = plaster.compute({ rows: [] }, NETS);
        expect([out.exterior, out.interior, out.total]).toEqual([0, 0, 0]);
    });
    it('1 row', () => {
        expect(plaster.compute({ rows: [row()] }, NETS).exterior).toBe(100);
    });
    it('18 rows (Excel max) and 40 rows all compute (D5: every row computes)', () => {
        expect(plaster.compute({ rows: Array.from({ length: 18 }, () => row()) }, NETS).exterior).toBe(1800);
        expect(plaster.compute({ rows: Array.from({ length: 40 }, () => row({ kind: INT, wallPart: 'ผนังภายในบ้าน' })) }, NETS).interior).toBe(2000);
    });
    it('delete a row: the total falls by that row only', () => {
        const d = plaster.defaults();
        const before = plaster.compute(d, NETS);
        const after = plaster.compute({ rows: d.rows.slice(1) }, NETS);   // drops รอบบ้าน inside, 100 m2
        expect((before.interior ?? 0) - (after.interior ?? 0)).toBe(100);
        expect(before.exterior).toBe(after.exterior);
    });
});

describe('plaster edge: through computeProject (BOQ money and the chain door-window -> brick -> plaster -> paint)', () => {
    const walls = [bw({ length: 20, height: 3 }), bw({ wallPart: 'ผนังภายในบ้าน', length: 10, height: 3 })];   // 60 and 30 m2
    const dw: DoorWindowInput = {
        doors: [
            openingRow({ name: 'D1-x', type: ALUMINIUM, count: 3, width: 2, height: 1 }),                               // 6 m2 on รอบบ้าน
            openingRow({ name: 'D3-x', type: WOOD, count: 2, width: 1, height: 2, wallPart: 'ผนังภายในบ้าน' }),     // 4 m2 on ภายใน
        ],
        windows: [],
    };
    it('net รอบบ้าน 54, ภายใน 26: exterior 54, interior 54 + 26 x 2 = 106', () => {
        const { out } = runProject({ walls, dw });
        expect(out?.exterior).toBe(54);
        expect(out?.interior).toBe(106);
        expect(out?.total).toBe(160);
    });
    it('BOQ: R189 54 m2 x (50 + 180) = 12,420; R190 106 m2 x (50 + 150) = 21,200', () => {
        const { item } = runProject({ walls, dw });
        expect(item(18, 'R189').qty).toBe(54);
        expect(item(18, 'R189').total).toBe(12420);
        expect(item(18, 'R190').qty).toBe(106);
        expect(item(18, 'R190').total).toBe(21200);
    });
    it('paint follows plaster: wall exterior 54, wall interior 106, skim = 160, and the BOQ paint rows R223 / R224 / R231', () => {
        const { paint, item } = runProject({ walls, dw });
        expect(paint?.wallExterior).toBe(54);
        expect(paint?.wallInterior).toBe(106);
        expect(paint?.skim).toBe(160);
        expect(item(23, 'R223').qty).toBe(54);
        expect(item(23, 'R224').qty).toBe(106);
        expect(item(23, 'R231').qty).toBe(160);
    });
    it('more doors -> less plaster: D1 count 3 -> 5 (10 m2) gives exterior 50, interior 102 and paint 50 / 102', () => {
        const more: DoorWindowInput = { ...dw, doors: [openingRow({ name: 'D1-x', type: ALUMINIUM, count: 5, width: 2, height: 1 }), ...dw.doors.slice(1)] };
        const { out, paint } = runProject({ walls, dw: more });
        expect(out?.exterior).toBe(50);
        expect(out?.interior).toBe(102);
        expect(paint?.wallExterior).toBe(50);
        expect(paint?.wallInterior).toBe(102);
    });
    it('removing the wood door: ภายใน net 30, interior 54 + 60 = 114', () => {
        const { out } = runProject({ walls, dw: { ...dw, doors: dw.doors.slice(0, 1) } });
        expect(out?.exterior).toBe(54);
        expect(out?.interior).toBe(114);
    });
    it('a bigger wall: length 20 -> 30 raises the exterior by 30 m2 (3 m high), interior by 30 (1 face)', () => {
        const longer = [bw({ length: 30, height: 3 }), walls[1] ?? bw()];
        const { out } = runProject({ walls: longer, dw });
        expect(out?.exterior).toBe(84);
        expect(out?.interior).toBe(136);
    });
    it('an opening on a brick type / thickness that no wall uses is not deducted anywhere (plaster unchanged)', () => {
        const odd: DoorWindowInput = { doors: [openingRow({ name: 'D1-x', type: ALUMINIUM, count: 3, width: 2, height: 1, brick: 'อิฐมวลเบา', thickness: 'เต็มแผ่น' })], windows: [] };
        expect(runProject({ walls, dw: odd }).out?.exterior).toBe(60);
    });
    it('a wall that is a gable triangle (7 x 3 / 2 = 10.5) in รอบบ้าน-พิเศษ plasters both default faces: exterior 10.5, interior 10.5', () => {
        const { out } = runProject({ walls: [bw({ wallPart: 'ผนังรอบบ้าน-พิเศษ', brickType: 'อิฐมวลเบา', length: 7, height: 3, shape: 'triangle' })] });
        expect(out?.exterior).toBeCloseTo(10.5, 9);
        expect(out?.interior).toBeCloseTo(10.5, 9);
    });
    it('column / beam faces typed in the structure row reach R189 and paint: 12 m2 x 2 faces = 24 on top of 54', () => {
        const rows: PlasterRow[] = [...blank().rows.slice(0, 6), row({ wallPart: STRUCTURAL_WALL, manualArea: 12, sides: 2 })];
        const { out, item, paint } = runProject({ walls, dw, rows });
        expect(out?.exterior).toBe(78);
        expect(item(18, 'R189').qty).toBe(78);
        expect(paint?.wallExterior).toBe(78);
    });
    it('level skipped (plaster): R189 / R190 qty 0, money 0, and paint wall areas and skim 0', () => {
        const { item, out, paint } = runProject({ walls, dw, skipped: ['plaster'] });
        for (const k of ['R189', 'R190']) { expect(item(18, k).qty, k).toBe(0); expect(item(18, k).total, k).toBe(0); }
        expect(out?.total).toBe(0);
        expect(paint?.wallExterior).toBe(0);
        expect(paint?.wallInterior).toBe(0);
        expect(paint?.skim).toBe(0);
    });
    it('level skipped (brick): brick outputs are 0, so plaster of brick walls is 0 but the typed structure face area remains', () => {
        const rows: PlasterRow[] = [...blank().rows.slice(0, 6), row({ wallPart: STRUCTURAL_WALL, manualArea: 12, sides: 1 })];
        const { out } = runProject({ walls, dw, rows, skipped: ['brick'] });
        expect(out?.interior).toBe(0);
        expect(out?.exterior).toBe(12);
    });
    it('level skipped (door-window): openings are not deducted, plaster rises by the opening area (60 / 120)', () => {
        const { out } = runProject({ walls, dw, skipped: ['door-window'] });
        expect(out?.exterior).toBe(60);
        expect(out?.interior).toBe(60 + 30 * 2);
    });
    it('Excel sample project: R189 191.8225 and R190 314.7825 (full sample chain)', () => {
        const { item } = runProject({ sample: true });
        expect(item(18, 'R189').qty).toBeCloseTo(191.8225, 6);
        expect(item(18, 'R190').qty).toBeCloseTo(314.7825, 6);
    });
});
