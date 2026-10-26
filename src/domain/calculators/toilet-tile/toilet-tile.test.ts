import { describe, expect, it } from 'vitest';
import { toiletTile, toiletTileArea, SAMPLE_OPENINGS, type ToiletTileInput } from '.';
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

    it('links', () => {
        expect(toiletTile.boqLinks).toEqual([
            { line: 'R210', field: 'qty', output: 'R210' },
            { line: 'R211', field: 'qty', output: 'R211' },
        ]);
    });
});
