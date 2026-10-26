import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import { pickRow, selectItem, type PickRow } from '../shared/pick-list';
import { MISC_CATALOGUE, misc, type MiscInput } from '.';

const ctx = { outputs: () => undefined };
const goldenLines = golden.lines as Record<string, { E?: number; I?: number; J?: number; K?: number; L?: number; M?: number }>;
const goldenSections = golden.sections as Record<string, { J: number; L: number; M: number }>;

const section28 = (input?: MiscInput) => {
    const project = createProject();
    if (input) project.calculators.misc = input;
    return computeProject(project, [misc]).boq.sections.find(s => s.no === 28);
};
const boqRows = (input?: MiscInput): BoqItemRow[] =>
    (section28(input)?.rows ?? []).filter((r): r is BoqItemRow => r.type === 'item' && r.key.startsWith('misc:'));

describe('เบ็ดเตล็ด_Other (sheet 20)', () => {
    const input = misc.defaults();

    it('Excel sample row 5 → BOQ row 279; section 28 = Excel J/L/M280', () => {
        expect(input.items.map(r => [r.item, r.qty, r.unit])).toEqual([['ราวกันตกกระจก เฉลียง 1 และ 2', 7.1, 'ม.']]);
        const [r] = boqRows();
        const g = goldenLines.R279;
        expect(r).toMatchObject({ itemNo: '1)', desc: 'ราวกันตกกระจก เฉลียง 1 และ 2', unit: 'ม.', waste: 0 });
        expect(r?.qty).toBe(g?.E);
        expect(r?.matUnit).toBe(g?.I);
        expect(r?.matTotal).toBe(g?.J);
        expect(r?.labUnit).toBe(g?.K);
        expect(r?.labTotal).toBe(g?.L);
        expect(r?.total).toBe(g?.M);
        expect(misc.compute(input, ctx)).toEqual({ rows: 1, mat: 28400, lab: 0, total: 28400 });
        const s = section28();
        expect(s?.matTotal).toBe(goldenSections['28']?.J);
        expect(s?.labTotal).toBe(goldenSections['28']?.L);
        expect(s?.total).toBe(goldenSections['28']?.M);
    });

    it('free-text rows carry their own unit and prices (unpriced free text costs 0)', () => {
        const sign: PickRow = { item: 'ป้ายบ้านเลขที่', qty: 1, unit: 'ชุด', mat: 1500, lab: 300 };
        const blank = pickRow('ราวตากผ้า', 2, 'ชุด');
        const next: MiscInput = { items: [...input.items, sign, blank] };
        const rows = boqRows(next);
        expect(rows).toHaveLength(3);
        expect(rows[1]).toMatchObject({
            key: 'misc:items:ป้ายบ้านเลขที่', itemNo: '2)', desc: 'ป้ายบ้านเลขที่', unit: 'ชุด',
            qty: 1, matUnit: 1500, labUnit: 300, total: 1800,
        });
        expect(rows[2]).toMatchObject({ unit: 'ชุด', matUnit: 0, labUnit: 0, total: 0 });
        expect(misc.compute(next, ctx)).toEqual({ rows: 3, mat: 29900, lab: 300, total: 30200 });
        expect(section28(next)?.total).toBe(28400 + 1800);
        // renaming a free-text item keeps its own unit and prices
        expect(selectItem(sign, 'ป้ายชื่อบ้าน', MISC_CATALOGUE)).toEqual({ ...sign, item: 'ป้ายชื่อบ้าน' });
    });

    it('renaming the railing into free text keeps its price (typed into the row); back to the option = catalogue', () => {
        const [railing = pickRow('', 0, '')] = input.items;
        const renamed = selectItem(railing, 'ราวกันตกกระจก เฉลียง 1 และ 2 ชั้นบน', MISC_CATALOGUE);
        expect(renamed).toEqual({ item: 'ราวกันตกกระจก เฉลียง 1 และ 2 ชั้นบน', qty: 7.1, unit: 'ม.', mat: 4000, lab: 0 });
        expect(boqRows({ items: [renamed] })[0]).toMatchObject({ unit: 'ม.', matUnit: 4000, total: 28400 });
        expect(selectItem(renamed, 'ราวกันตกกระจก เฉลียง 1 และ 2', MISC_CATALOGUE)).toEqual(railing);
        // clearing the name does not carry prices over
        expect(selectItem(railing, '', MISC_CATALOGUE)).toEqual({ ...railing, item: '' });
    });

    it('typed price overrides the railing price; a second railing row gets key ~2', () => {
        const next: MiscInput = {
            items: [{ ...pickRow('ราวกันตกกระจก เฉลียง 1 และ 2', 7.1, 'ม.'), mat: 3500 }, pickRow('ราวกันตกกระจก เฉลียง 1 และ 2', 2, 'ม.')],
        };
        const rows = boqRows(next);
        expect(rows[0]?.total).toBeCloseTo(24850, 9);       // 7.1 × 3,500
        expect(rows[1]).toMatchObject({ key: 'misc:items:ราวกันตกกระจก เฉลียง 1 และ 2~2', total: 8000 });
        expect(section28(next)?.total).toBeCloseTo(32850, 9);
    });
});
