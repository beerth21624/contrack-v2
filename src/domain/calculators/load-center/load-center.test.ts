import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import { catalogueItem, pickRow, pickRowCalc, selectItem } from '../shared/pick-list';
import { electricalEquipment } from '../electrical-equipment';
import { LOAD_CENTER_CATALOGUE, LOAD_CENTER_ITEMS, loadCenter, type LoadCenterInput } from '.';

const ctx = { outputs: () => undefined };
const goldenLines = golden.lines as Record<string, { E?: number; I?: number; J?: number; K?: number; L?: number; M?: number }>;
const goldenSections = golden.sections as Record<string, { J: number; L: number; M: number }>;

const section26 = (input?: LoadCenterInput) => {
    const project = createProject();
    if (input) project.calculators['load-center'] = input;
    return computeProject(project, [loadCenter, electricalEquipment]).boq.sections.find(s => s.no === 26);
};
const loadCenterRows = (input?: LoadCenterInput): BoqItemRow[] =>
    (section26(input)?.rows ?? []).filter((r): r is BoqItemRow => r.type === 'item' && r.key.startsWith('load-center:'));

describe('ตู้ควบคุม_Load Center (sheet 10)', () => {
    const input = loadCenter.defaults();

    it('Excel sample rows 5–12 (item verbatim, qty, unit); every dropdown option is priced', () => {
        expect(input.items.map(r => [r.item, r.qty, r.unit])).toEqual([
            ['ตู้ Consumer Unit ชนาด 18 ช่อง', 1, 'ชุด'],
            ['เซอร์กิตเบรกเกอร์เมน  ขนาด100 A    ', 1, 'ตัว'],
            ['เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 16 A ', 2, 'ตัว'],
            ['เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 20 A ', 8, 'ตัว'],
            ['เซอร์กิตเบรกเกอร์ย่อยชนิดกันดูด (ELCB) 20 A ', 4, 'ตัว'],
            ['สายเมนไฟฟ้า THW ขนาด 25 ตร.มม.', 50, 'ม.'],
            ['แท่งกราวด์ทองแดง 5/8" ยาว 2.40 ม. ', 1, 'ท่อน'],
            ['สายไฟกราวด์ THW 10 ตร.มม.', 5, 'ม.'],
        ]);
        for (const r of input.items) expect(LOAD_CENTER_ITEMS as readonly string[]).toContain(r.item);
        for (const item of LOAD_CENTER_ITEMS) expect(catalogueItem(LOAD_CENTER_CATALOGUE, item)).toBeDefined();
    });

    it('BOQ slot = Excel rows 256–263 (C, D, F, E, I, J, K, L, M)', () => {
        const rows = loadCenterRows();
        const excel = ['R256', 'R257', 'R258', 'R259', 'R260', 'R261', 'R262', 'R263'];
        expect(rows).toHaveLength(excel.length);
        rows.forEach((r, i) => {
            const g = goldenLines[excel[i] ?? ''];
            expect(r.itemNo).toBe(`${i + 1})`);
            expect(r.desc).toBe(input.items[i]?.item.trim());
            expect(r.unit).toBe(input.items[i]?.unit);
            expect(r.waste).toBe(0);
            expect(r.qty).toBe(g?.E);
            expect(r.matUnit).toBe(g?.I);
            expect(r.matTotal).toBe(g?.J);
            expect(r.labUnit).toBe(g?.K);
            expect(r.labTotal).toBe(g?.L);
            expect(r.total).toBe(g?.M);
            expect(r.note).toBeUndefined();
        });
        expect(rows[0]?.key).toBe('load-center:items:ตู้ Consumer Unit ชนาด 18 ช่อง');
        expect(rows[1]?.key).toBe('load-center:items:เซอร์กิตเบรกเกอร์เมน ขนาด100 A');
    });

    it('sheet totals = Σ J256:J263 / L256:L263; section 26 (with Equipment) = Excel J/L/M271', () => {
        expect(loadCenter.compute(input, ctx)).toEqual({ rows: 8, mat: 21510, lab: 8450, total: 29960 });
        const s = section26();
        expect(s?.matTotal).toBe(goldenSections['26']?.J);
        expect(s?.labTotal).toBe(goldenSections['26']?.L);
        expect(s?.total).toBe(goldenSections['26']?.M);
        expect(s?.total).toBe(47520);
    });

    it('a repeated item gets key ~2; blank and qty-0 rows are left out', () => {
        const next: LoadCenterInput = {
            items: [...input.items, pickRow(LOAD_CENTER_ITEMS[1], 2, 'ตัว'), pickRow('', 3, 'ตัว'), pickRow(LOAD_CENTER_ITEMS[0], 0, 'ตัว')],
        };
        const rows = loadCenterRows(next);
        expect(rows).toHaveLength(9);
        expect(rows[8]?.itemNo).toBe('9)');
        expect(rows[8]?.key).toBe('load-center:items:เซอร์กิตเบรกเกอร์ย่อยชนิดกันดูด (ELCB) 20 A~2');
        expect(rows[8]?.total).toBe(2400);                       // 2 × 1,200
        expect(section26(next)?.total).toBe(47520 + 2400);
    });

    it('typed price overrides the catalogue; choosing another item re-prices the row', () => {
        const overridden = input.items.map((r, i) => (i === 0 ? { ...r, mat: 3500 } : r));   // lab stays 3,000
        expect(loadCenterRows({ items: overridden })[0]).toMatchObject({ matUnit: 3500, labUnit: 3000, total: 6500 });
        expect(section26({ items: overridden })?.total).toBe(47520 + 500);
        // CB 20 A (row 8) → CB 16 A: the BOQ takes the CB 16 A price (Excel would keep 140, spec 05 §0.3)
        const swapped = input.items.map((r, i) => (i === 3 ? selectItem({ ...r, mat: 999 }, LOAD_CENTER_ITEMS[2], LOAD_CENTER_CATALOGUE) : r));
        const cb = loadCenterRows({ items: swapped })[3];
        expect(cb).toMatchObject({ matUnit: 120, labUnit: 0, total: 960, key: 'load-center:items:เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 16 A~2' });
        // an item outside the catalogue is priced 0 unless typed
        expect(pickRowCalc({ item: 'อื่น ๆ', qty: 2, unit: 'ชุด', mat: null, lab: 100 }, LOAD_CENTER_CATALOGUE))
            .toMatchObject({ known: false, mat: 0, lab: 100, total: 200 });
    });
});
