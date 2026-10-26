import { describe, expect, it } from 'vitest';
import {
    wallFinishing, wallFinishingArea, wallFinishingLength, MOULDING_0_1, MOULDING_0_3, SLAT_WALL, type WallFinishingInput,
} from '.';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const g = golden.lines;

function section22(input?: WallFinishingInput) {
    const project = createProject();
    if (input !== undefined) project.calculators['wall-finishing'] = input;
    const sec = computeProject(project, [wallFinishing]).boq.sections.find(s => s.no === 22);
    const row = (key: string) => sec?.rows.find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { sec, row };
}

describe('ตกแต่งผนัง_Wall Finishing (sheet 18)', () => {
    it('Excel sample: F5/F6 lengths, G7/G8 areas, blank cells elsewhere', () => {
        const rows = wallFinishing.defaults().rows;
        expect(rows).toHaveLength(4);
        expect(rows.map(wallFinishingLength)).toEqual([13, 11, null, null]);
        const areas = rows.map(wallFinishingArea);
        expect(areas.slice(0, 2)).toEqual([null, null]);
        expect(areas[2]).toBeCloseTo(3.3, 12);
        expect(areas[3]).toBeCloseTo(4.8, 12);
    });

    it('outputs: R220 = golden; R218/R219 = golden swapped (D1 fix of O-2); paint-sheet contract', () => {
        const out = wallFinishing.compute(wallFinishing.defaults(), ctx);
        expect(out.R220).toBeCloseTo(g.R220.E, 9);
        // Excel E218 = 11 (0.1 moulding under the 0.3 description), E219 = 13 — fixed here.
        expect(out.R218).toBe(g.R219.E);
        expect(out.R219).toBe(g.R218.E);
        expect(out.R218).toBe(13);
        expect(out.R219).toBe(11);
        // contract for the paint calculator (sheet 19 C10 = 3.3 + 4.8, C11 = 0.5·13 + 0.3·11)
        expect(out.slatWallArea).toBeCloseTo(8.1, 9);
        expect(out['moulding.0.3']).toBe(13);
        expect(out['moulding.0.1']).toBe(11);
        expect(out[`moulding.${MOULDING_0_3}`]).toBe(13);
        expect(out[`moulding.${MOULDING_0_1}`]).toBe(11);
        expect(out.mouldingPaintArea).toBeCloseTo(9.8, 9);
    });

    it('BOQ section 22: 0.3 row 13 m × 400/200, 0.1 row 11 m × 180/100 → 16,377 (Excel 15,693, +684)', () => {
        const { sec, row } = section22();
        expect(row('R218')?.desc).toBe(MOULDING_0_3);
        expect(row('R218')?.qty).toBe(13);
        expect(row('R218')?.matTotal).toBeCloseTo(5720, 6);   // 13 × 1.1 × 400
        expect(row('R218')?.labTotal).toBeCloseTo(2600, 6);   // 13 × 200
        expect(row('R219')?.desc).toBe(MOULDING_0_1);
        expect(row('R219')?.matTotal).toBeCloseTo(2178, 6);   // 11 × 1.1 × 180
        expect(row('R219')?.labTotal).toBeCloseTo(1100, 6);   // 11 × 100
        expect(row('R220')?.total).toBeCloseTo(g.R220.M, 6);
        expect(sec?.total).toBeCloseTo(16377, 6);
        expect((sec?.total ?? 0) - golden.sections['22'].M).toBeCloseTo(684, 6);
    });

    it('every row computes by its item (Excel only has F on rows 5–6 and G on rows 7–15)', () => {
        const input = wallFinishing.defaults();
        input.rows.push({ code: 'P2', item: MOULDING_0_3, width: 0, length: 6.5, location: 'ผนังเฉลียง 1' });
        input.rows.push({ code: 'P2', item: MOULDING_0_1, width: 0.5, length: 4, location: '' });   // F = D + E = 4.5
        input.rows.push({ code: 'P4', item: SLAT_WALL, width: 2, length: 1.5, location: 'ผนังห้องนอน' });
        input.rows.push({ code: '', item: '', width: 3, length: 3, location: '' });                  // no item → nothing
        input.rows[0] = { code: 'P4', item: SLAT_WALL, width: 1, length: 2, location: '' };          // row 1 becomes ระแนง
        const out = wallFinishing.compute(input, ctx);
        expect(out.R218).toBeCloseTo(6.5, 9);
        expect(out.R219).toBeCloseTo(11 + 4.5, 9);
        expect(out.R220).toBeCloseTo(8.1 + 3 + 2, 9);
        expect(out.mouldingPaintArea).toBeCloseTo(0.5 * 6.5 + 0.3 * 15.5, 9);
        const { row } = section22(input);
        expect(row('R220')?.qty).toBeCloseTo(13.1, 9);
    });

    it('links', () => {
        expect(wallFinishing.boqLinks).toEqual([
            { line: 'R218', field: 'qty', output: 'R218' },
            { line: 'R219', field: 'qty', output: 'R219' },
            { line: 'R220', field: 'qty', output: 'R220' },
        ]);
    });
});
