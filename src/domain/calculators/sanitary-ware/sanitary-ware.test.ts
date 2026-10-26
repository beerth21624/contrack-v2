import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import { catalogueItem, pickRow } from '../shared/pick-list';
import {
    BATHROOM_SET, SANITARY_WARE_CATALOGUE, SANITARY_WARE_ITEMS, addBathroomSet, sanitaryWare, type SanitaryWareInput,
} from '.';

const ctx = { outputs: () => undefined };
const goldenLines = golden.lines as Record<string, { E?: number; I?: number; J?: number; K?: number; L?: number; M?: number }>;
const goldenSections = golden.sections as Record<string, { J: number; L: number; M: number }>;

const section29 = (input?: SanitaryWareInput) => {
    const project = createProject();
    if (input) project.calculators['sanitary-ware'] = input;
    return computeProject(project, [sanitaryWare]).boq.sections.find(s => s.no === 29);
};
const boqRows = (input?: SanitaryWareInput): BoqItemRow[] =>
    (section29(input)?.rows ?? []).filter((r): r is BoqItemRow => r.type === 'item' && r.key.startsWith('sanitary-ware:'));

describe('สุขภัณฑ์_Sanitary (sheet 21)', () => {
    const input = sanitaryWare.defaults();

    it('Excel sample rows 5–14 (item verbatim, qty, unit); every dropdown option is priced', () => {
        expect(input.items.map(r => [r.item, r.qty, r.unit])).toEqual([
            ['ชักโครกนั่งราบ', 2, 'ชุด'],
            ['สายชำระ', 2, 'ชุด'],
            ['อ่างล้างหน้า ', 2, 'ชุด'],
            ['ก๊อกเดี่ยวอ่างล้างหน้า', 2, 'ชุด'],
            ['กระจกเงา', 2, 'ชุด'],
            ['ที่ใส่กระดาษชำระ ', 2, 'ชุด'],
            ['ราวแขวนผ้า ', 2, 'ชุด'],
            ['ตะแกรงกันกลิ่น ', 3, 'ชุด'],
            ['ที่ใส่สบู่', 2, 'ชุด'],
            ['ฝักบัวอาบน้ำ', 2, 'ชุด'],
        ]);
        for (const item of SANITARY_WARE_ITEMS) expect(catalogueItem(SANITARY_WARE_CATALOGUE, item)).toBeDefined();
    });

    it('BOQ slot = Excel rows 282–291 (C, D, F, E, I, J, K, L, M)', () => {
        const rows = boqRows();
        const excel = ['R282', 'R283', 'R284', 'R285', 'R286', 'R287', 'R288', 'R289', 'R290', 'R291'];
        expect(rows).toHaveLength(excel.length);
        rows.forEach((r, i) => {
            const g = goldenLines[excel[i] ?? ''];
            expect(r.itemNo).toBe(`${i + 1})`);
            expect(r.desc).toBe(input.items[i]?.item.trim());
            expect(r.unit).toBe('ชุด');
            expect(r.qty).toBe(g?.E);
            expect(r.matUnit).toBe(g?.I);
            expect(r.matTotal).toBe(g?.J);
            expect(r.labUnit).toBe(g?.K);
            expect(r.labTotal).toBe(g?.L);
            expect(r.total).toBe(g?.M);
        });
        expect(rows[2]?.key).toBe('sanitary-ware:items:อ่างล้างหน้า');
    });

    it('sheet totals = Σ J/L282:291; section 29 = Excel J/L/M292', () => {
        expect(sanitaryWare.compute(input, ctx)).toEqual({ rows: 10, mat: 27800, lab: 4120, total: 31920 });
        const s = section29();
        expect(s?.matTotal).toBe(goldenSections['29']?.J);
        expect(s?.labTotal).toBe(goldenSections['29']?.L);
        expect(s?.total).toBe(goldenSections['29']?.M);
    });

    it('extra toilet row (key ~2), qty 0 dropped, typed price overrides', () => {
        const next: SanitaryWareInput = {
            items: [
                ...input.items.map((r, i) => (i === 0 ? { ...r, mat: 6000 } : i === 9 ? { ...r, qty: 0 } : r)),
                pickRow('ชักโครกนั่งราบ', 1, 'ชุด'),
            ],
        };
        const rows = boqRows(next);
        expect(rows).toHaveLength(10);                                   // shower (qty 0) left out
        expect(rows[0]).toMatchObject({ matUnit: 6000, total: 13600 });   // 2 × (6,000 + 800)
        expect(rows[9]).toMatchObject({ key: 'sanitary-ware:items:ชักโครกนั่งราบ~2', itemNo: '10)', total: 5800 });
        expect(section29(next)?.total).toBe(31920 + 2000 - 2200 + 5800);
    });

    it('blank(): no items; finite zero totals; section 29 empty', () => {
        const blank = sanitaryWare.blank?.();
        expect(blank).toEqual({ items: [] });
        if (!blank) return;
        expect(sanitaryWare.compute(blank, ctx)).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(sanitaryWare.boqSlots?.(blank, ctx)).toEqual({ items: [] });
        const s = computeProject(createProject('blank'), [sanitaryWare]).boq.sections.find(x => x.no === 29);
        expect(s?.total).toBe(0);
    });

    it('addBathroomSet: one of each set item per bathroom; two bathrooms ≈ the Excel sample', () => {
        const one = addBathroomSet([]);
        expect(one.map(r => [r.item, r.qty, r.unit, r.mat, r.lab])).toEqual(
            BATHROOM_SET.map(item => [item, 1, 'ชุด', null, null]));
        const two = addBathroomSet(one);
        expect(two).toHaveLength(BATHROOM_SET.length);
        // Excel sample = 2 bathrooms with one extra floor drain
        expect(two.map(r => [r.item, r.qty])).toEqual(
            input.items.map(r => [r.item, r.item === 'ตะแกรงกันกลิ่น ' ? 2 : r.qty]));
        expect(sanitaryWare.compute({ items: two }, ctx).total).toBe(31920 - 400);
        // An existing row (any spacing, typed price kept) is counted up, not duplicated
        const typed = addBathroomSet([{ item: 'อ่างล้างหน้า', qty: 1, unit: '', mat: 4000, lab: null }]);
        expect(typed[0]).toEqual({ item: 'อ่างล้างหน้า', qty: 2, unit: '', mat: 4000, lab: null });
        expect(typed).toHaveLength(BATHROOM_SET.length);
    });
});
