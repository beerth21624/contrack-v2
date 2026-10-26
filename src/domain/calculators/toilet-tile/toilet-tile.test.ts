import { describe, expect, it } from 'vitest';
import {
    toiletTile, toiletTileArea, SAMPLE_OPENINGS, bathroomGroups, bathroomPerimeter, newBathroomRows, nextBathroomName,
    renameBathroom, setBathroomFloorSize, toiletRowKind, type ToiletTileInput,
} from '.';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };

function section21(input?: ToiletTileInput) {
    const project = createProject();
    if (input !== undefined) project.calculators['toilet-tile'] = input;
    const sec = computeProject(project, [toiletTile]).boq.sections.find(s => s.no === 21);
    const row = (key: string) => sec?.rows.find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { sec, row };
}

describe('ปูกระเบื้องห้องน้ำ_Toilet (sheet 17)', () => {
    it('Excel sample: I5…I8 and the typed expressions F7/F8/H7/H8', () => {
        const rows = toiletTile.defaults().rows;
        expect(rows).toHaveLength(4);
        expect(rows[2]?.length).toBeCloseTo(10.6, 12);
        expect(rows[3]?.length).toBeCloseTo(7.6, 12);
        expect(SAMPLE_OPENINGS).toBeCloseTo(2.3, 12);
        const expected = [6.9, 3.6, 23.14, 15.94];
        rows.forEach((r, i) => expect(toiletTileArea(r)).toBeCloseTo(expected[i] ?? NaN, 9));
    });

    it('outputs E210 / E211 = golden BOQ (F3 10.5, P3 39.08)', () => {
        const out = toiletTile.compute(toiletTile.defaults(), ctx);
        expect(out.R210).toBeCloseTo(golden.lines.R210.E, 9);
        expect(out.R211).toBeCloseTo(golden.lines.R211.E, 9);
        expect(out.floorArea).toBe(out.R210);
        expect(out.wallArea).toBe(out.R211);
    });

    it('feeds BOQ section 21 exactly like Excel (water-pipe rows on their fallback)', () => {
        const { sec, row } = section21();
        expect(row('R210')?.total).toBeCloseTo(golden.lines.R210.M, 6);
        expect(row('R211')?.total).toBeCloseTo(golden.lines.R211.M, 6);
        expect(sec?.total).toBeCloseTo(golden.sections['21'].M, 2);
    });

    it('a blank row is "" (null) and counts 0; only filled dimensions multiply', () => {
        expect(toiletTileArea({ code: 'F3', surface: '', item: '', location: '' })).toBeNull();
        // openings alone, no W/L/H → still "" (COUNTA(E:G) = 0)
        expect(toiletTileArea({ code: 'P3', surface: '', item: '', openings: 2, location: '' })).toBeNull();
        expect(toiletTileArea({ code: 'F3', surface: '', item: '', length: 4, location: '' })).toBe(4);
        expect(toiletTileArea({ code: 'P3', surface: '', item: '', width: 2, length: 3, height: 2.5, openings: 1, location: '' })).toBe(14);
    });

    it('each bathroom has its own openings; added rows count; other codes are ignored', () => {
        const input = toiletTile.defaults();
        input.rows[3] = { ...input.rows[3], code: 'P3', surface: 'ผนัง', item: 'กรุกระเบื้องแกรนิตโต้', location: 'ห้องน้ำ 2', openings: 1.4 };
        input.rows.push({ code: 'F3', surface: 'พื้น', item: 'ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น', width: 1.5, length: 2, location: 'ห้องน้ำ 3' });
        input.rows.push({ code: 'P3', surface: 'ผนัง', item: 'กรุกระเบื้องแกรนิตโต้', length: 7, height: 2.4, location: 'ห้องน้ำ 3' });
        input.rows.push({ code: '', surface: 'พื้น', item: '', width: 5, length: 5, location: '' });
        const out = toiletTile.compute(input, ctx);
        expect(out.R210).toBeCloseTo(10.5 + 3, 9);
        // bathroom 2 wall: 7.6 × 2.4 − 1.4 = 16.84; bathroom 3 wall: 7 × 2.4 = 16.8
        expect(out.R211).toBeCloseTo(23.14 + 16.84 + 16.8, 9);
        const { row } = section21(input);
        expect(row('R211')?.qty).toBeCloseTo(56.78, 9);
    });

    it('blank(): no bathrooms; every output finite and the BOQ lines 0', () => {
        const input = toiletTile.blank?.();
        expect(input).toEqual({ rows: [] });
        if (!input) return;
        const out = toiletTile.compute(input, ctx);
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
        for (const l of toiletTile.boqLinks) expect(out[l.output], l.line).toBe(0);
    });

    it('bathroom view: the Excel sample reads as two bathrooms with floor + wall', () => {
        const input = toiletTile.defaults();
        expect(bathroomGroups(input)).toEqual([{ name: 'ห้องน้ำ 1', rows: [0, 2] }, { name: 'ห้องน้ำ 2', rows: [1, 3] }]);
        expect(input.rows.map(toiletRowKind)).toEqual(['floor', 'floor', 'wall', 'wall']);
        // The sample wall lengths are exactly 2 × (W + L) of the floor (O-12).
        expect(bathroomPerimeter(input, 'ห้องน้ำ 1')).toBeCloseTo(input.rows[2]?.length ?? NaN, 12);
        expect(bathroomPerimeter(input, 'ห้องน้ำ 2')).toBeCloseTo(input.rows[3]?.length ?? NaN, 12);
        expect(nextBathroomName(input)).toBe('ห้องน้ำ 3');
    });

    it('a new bathroom: floor size fills the wall length; a typed wall length is kept', () => {
        let input: ToiletTileInput = { rows: newBathroomRows('ห้องน้ำ 1') };
        expect(toiletTile.compute(input, ctx).R210).toBe(0);
        input = setBathroomFloorSize(input, 0, { width: 2 });
        expect(input.rows[1]?.length).toBeUndefined();                  // L not known yet
        input = setBathroomFloorSize(input, 0, { length: 3 });
        expect(input.rows[1]?.length).toBe(10);                         // 2 × (2 + 3)
        input = { rows: input.rows.map((r, i) => (i === 1 ? { ...r, height: 2.4, openings: 2.3 } : r)) };
        let out = toiletTile.compute(input, ctx);
        expect(out.R210).toBe(6);
        expect(out.R211).toBeCloseTo(10 * 2.4 - 2.3, 9);
        input = setBathroomFloorSize(input, 0, { length: 2.5 });       // still the old 2(W+L) → follows
        expect(input.rows[1]?.length).toBe(9);
        input = { rows: input.rows.map((r, i) => (i === 1 ? { ...r, length: 7 } : r)) };   // only part of the wall tiled
        input = setBathroomFloorSize(input, 0, { width: 3 });
        expect(input.rows[1]?.length).toBe(7);
        out = toiletTile.compute(input, ctx);
        expect(out.R210).toBe(7.5);
        expect(out.R211).toBeCloseTo(7 * 2.4 - 2.3, 9);
    });

    it('rename moves every row of the bathroom; other bathrooms are untouched', () => {
        const input = renameBathroom(toiletTile.defaults(), 'ห้องน้ำ 1', 'ห้องน้ำรวม');
        expect(input.rows.map(r => r.location)).toEqual(['ห้องน้ำรวม', 'ห้องน้ำ 2', 'ห้องน้ำรวม', 'ห้องน้ำ 2']);
        expect(toiletTile.compute(input, ctx)).toEqual(toiletTile.compute(toiletTile.defaults(), ctx));
        // Following only happens inside the edited bathroom.
        const resized = setBathroomFloorSize(toiletTile.defaults(), 0, { width: 2 });
        expect(resized.rows[2]?.length).toBe(10);
        expect(resized.rows[3]?.length).toBeCloseTo(7.6, 12);
    });

    it('links', () => {
        expect(toiletTile.boqLinks).toEqual([
            { line: 'R210', field: 'qty', output: 'R210' },
            { line: 'R211', field: 'qty', output: 'R211' },
        ]);
    });
});
