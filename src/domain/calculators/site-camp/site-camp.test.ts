import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import { campLine, siteCamp, type SiteCampInput } from '.';

const ctx = { outputs: () => undefined };
function first<T>(rows: T[]): T {
    const [row] = rows;
    if (row === undefined) throw new Error('empty table');
    return row;
}
const goldenLines = golden.lines as Record<string, { E?: number; I?: number; K?: number }>;

/** Deck p16, every visible take-off row: [code, จำนวนที่กรอก, ปริมาณคำนวณ, ปริมาณรวมเผื่อ, รวมวัสดุ]. */
const SHEET_ROWS: [string, number, number, number, number][] = [
    ['PLY15', 4, 12, 13, 7150],
    ['EUCALYPTUS', 4, 200, 210, 11550],
    ['ZINC6', 4, 55, 58, 8700],
    ['ZINC7', 4, 15, 16, 2720],
    ['ZINC8', 4, 15, 16, 3040],
    ['NAIL3X10_BOX', 4, 1, 2, 1700],
    ['NAIL15_BOX', 4, 3, 4, 240],
    ['ZINC_NAIL', 4, 5, 6, 210],
    ['STRING60', 4, 2, 3, 135],
    ['EUCALYPTUS', 2, 13, 14, 770],
    ['ZINC6', 2, 3, 4, 600],
    ['ZINC7', 2, 11, 12, 2040],
    ['CONCRETE_RING80', 2, 4, 5, 1400],
    ['RING_COVER80', 2, 2, 3, 480],
    ['TOILET_FLAT', 2, 2, 3, 2550],
    ['CEMENT_TPI50', 2, 2, 3, 495],
    ['SAND25', 2, 10, 11, 495],
    ['STONE25', 2, 6, 7, 385],
    ['FAUCET12', 2, 2, 3, 360],
    ['PVC12_PIPE', 2, 2, 3, 255],
    ['PVC12_FEMALE_ELBOW', 2, 1, 2, 50],
    ['PVC12_TEE', 2, 2, 3, 54],
];

describe('แคมป์คนงาน / ห้องน้ำ / ห้องอาบน้ำ / สโตร์ (external sheet, deck p16)', () => {
    const input = siteCamp.defaults();
    const out = siteCamp.compute(input, ctx);

    it('every visible take-off row matches the screenshot', () => {
        expect(input.materials.map(l => ({ code: l.code, ...campLine(l, input) })))
            .toEqual(SHEET_ROWS.map(([code, rooms, calcQty, grossQty, total]) => ({ code, rooms, calcQty, grossQty, total })));
    });

    it('group totals, labour 20% and per-room figures', () => {
        expect(out.mat_camp).toBe(35445);
        expect(out.mat_toilet).toBe(9934);
        expect(out.mat_shower).toBe(0);
        expect(out.mat_store).toBe(0);
        expect(out.materialTotal).toBe(45379);
        expect(out.labour).toBeCloseTo(9075.8, 6);
        expect(out.total).toBeCloseTo(54454.8, 6);
        expect(out.lab_camp).toBeCloseTo(7089, 6);
        expect(out.matPerRoom_camp).toBeCloseTo(8861.25, 6);
        expect(out.labPerRoom_camp).toBeCloseTo(1772.25, 6);
        expect(out.matPerRoom_toilet).toBe(4967);
        expect(out.matPerRoom_shower).toBe(0);
    });

    it('links only the room counts into BOQ E19:E22, equal to the Excel quantities', () => {
        expect(siteCamp.boqLinks).toEqual([
            { line: 'R19', field: 'qty', output: 'workerRooms' },
            { line: 'R20', field: 'qty', output: 'toilets' },
            { line: 'R21', field: 'qty', output: 'showers' },
            { line: 'R22', field: 'qty', output: 'stores' },
        ]);
        for (const l of siteCamp.boqLinks) expect(out[l.output]).toBe(goldenLines[l.line]?.E);
    });

    it('in a project, BOQ section 3 still equals Excel (prices stay typed)', () => {
        const r = computeProject(createProject(), [siteCamp]);
        const s3 = r.boq.sections.find(s => s.no === 3);
        expect(s3?.total).toBeCloseTo(golden.sections['3'].M, 2);
        const changed = createProject();
        changed.calculators['site-camp'] = { ...siteCamp.defaults(), workerRooms: 6 };
        // R19: 6 rooms × (7,000 + 1,000) instead of 4 → +16,000
        expect(computeProject(changed, [siteCamp]).boq.sections.find(s => s.no === 3)?.total)
            .toBeCloseTo(golden.sections['3'].M + 16000, 2);
    });

    it('more rooms scale the group and re-round after waste', () => {
        const more: SiteCampInput = { ...siteCamp.defaults(), workerRooms: 8 };
        const ply = campLine(first(more.materials), more);
        expect(ply).toEqual({ rooms: 8, calcQty: 24, grossQty: 26, total: 14300 }); // 24 × 1.05 = 25.2 → 26
        expect(siteCamp.compute(more, ctx).workerRooms).toBe(8);
        // toilet rows are untouched
        expect(siteCamp.compute(more, ctx).mat_toilet).toBe(9934);
    });

    it('a row added to an empty group counts with that group, waste 0 keeps exact qty', () => {
        const i = siteCamp.defaults();
        i.showers = 2;
        i.waste = 0;
        i.materials.push({ group: 'shower', code: 'ZINC7', item: 'สังกะสี 66.5 ซม. x 7 ฟุต', unit: 'แผ่น', baseQty: 10, basePer: 1, unitPrice: 170 });
        const o = siteCamp.compute(i, ctx);
        expect(o.mat_shower).toBe(20 * 170);
        expect(o.matPerRoom_shower).toBe(1700);
        expect(o.lab_shower).toBeCloseTo(680, 6);
    });

    it('blank project: room counts 0 (BOQ E19:E22 = 0, section 3 = 0), recipe and % kept', () => {
        const blank = siteCamp.blank?.();
        expect(blank).toBeDefined();
        if (!blank) return;
        expect(blank).toEqual({ ...siteCamp.defaults(), workerRooms: 0, toilets: 0, showers: 0, stores: 0 });
        const o = siteCamp.compute(blank, ctx);
        expect(Object.values(o).every(Number.isFinite)).toBe(true);
        for (const l of siteCamp.boqLinks) expect(o[l.output]).toBe(0);
        expect(o.total).toBe(0);
        const s3 = computeProject(createProject('blank'), [siteCamp]).boq.sections.find(s => s.no === 3);
        expect(s3?.total).toBe(0);
    });

    it('ฐานต่อ 0 gives 0 instead of dividing by zero', () => {
        const i = siteCamp.defaults();
        const line = { ...first(i.materials), basePer: 0 };
        expect(campLine(line, i)).toEqual({ rooms: 4, calcQty: 0, grossQty: 0, total: 0 });
    });

    it('ROUNDUP ignores float noise: 10 × 1.1 (= 11.000000000000002 in JS) orders 11, not 12', () => {
        const i: SiteCampInput = { ...siteCamp.defaults(), waste: 0.1, workerRooms: 1 };
        const line = { ...first(i.materials), baseQty: 10, basePer: 1 };
        expect(campLine(line, i).grossQty).toBe(11);
        expect(campLine(line, { ...i, workerRooms: 0 })).toEqual({ rooms: 0, calcQty: 0, grossQty: 0, total: 0 });
    });
});
