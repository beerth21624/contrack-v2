import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import { catalogueItem, pickRow } from '../shared/pick-list';
import { loadCenter } from '../load-center';
import { EQUIPMENT_CATALOGUE, EQUIPMENT_ITEMS, electricalEquipment, type ElectricalEquipmentInput } from '.';

const ctx = { outputs: () => undefined };
const goldenLines = golden.lines as Record<string, { E?: number; I?: number; J?: number; K?: number; L?: number; M?: number }>;
const goldenSections = golden.sections as Record<string, { J: number; L: number; M: number }>;

const section26 = (input?: ElectricalEquipmentInput) => {
    const project = createProject();
    if (input) project.calculators['electrical-equipment'] = input;
    return computeProject(project, [loadCenter, electricalEquipment]).boq.sections.find(s => s.no === 26);
};
const equipmentRows = (input?: ElectricalEquipmentInput): BoqItemRow[] =>
    (section26(input)?.rows ?? []).filter((r): r is BoqItemRow => r.type === 'item' && r.key.startsWith('electrical-equipment:'));

describe('อุปกรณ์ไฟฟ้า_Equipment (sheet 11)', () => {
    const input = electricalEquipment.defaults();

    it('Excel sample rows 5–10 (item, qty, unit); every dropdown option is priced', () => {
        expect(input.items.map(r => [r.item, r.qty, r.unit])).toEqual([
            ['โคมไฟดาวน์ไลท์', 25, 'ชุด'],
            ['โคมไฟซาลาเปา', 5, 'ชุด'],
            ['โคมไฟฟลูออเรสเซนต์ ชนิดกันน้ำ', 1, 'ชุด'],
            ['สวิตซ์ทางเดียว (พร้อมหน้ากาก)', 18, 'ตัว'],
            ['เต้ารับไฟฟ้าคู่ชนิดมีกราวน์ (พร้อมหน้ากาก)', 17, 'ตัว'],
            ['เต้ารับไฟฟ้าคู่ชนิดมีกราวน์ ชนิดกันน้ำ (พร้อมหน้ากาก)', 2, 'ตัว'],
        ]);
        for (const item of EQUIPMENT_ITEMS) expect(catalogueItem(EQUIPMENT_CATALOGUE, item)).toBeDefined();
    });

    it('BOQ slot = Excel rows 265–270 (C, D, F, E, I, J, K, L, M)', () => {
        const rows = equipmentRows();
        const excel = ['R265', 'R266', 'R267', 'R268', 'R269', 'R270'];
        expect(rows).toHaveLength(excel.length);
        rows.forEach((r, i) => {
            const g = goldenLines[excel[i] ?? ''];
            expect(r.itemNo).toBe(`${i + 1})`);
            expect(r.key).toBe(`electrical-equipment:items:${input.items[i]?.item ?? ''}`);
            expect(r.desc).toBe(input.items[i]?.item);
            expect(r.unit).toBe(input.items[i]?.unit);
            expect(r.qty).toBe(g?.E);
            expect(r.matUnit).toBe(g?.I);
            expect(r.matTotal).toBe(g?.J);
            expect(r.labUnit).toBe(g?.K);
            expect(r.labTotal).toBe(g?.L);
            expect(r.total).toBe(g?.M);
        });
    });

    it('sheet totals = Σ J265:J270 / L265:L270; section 26 (with Load Center) = Excel J/L/M271', () => {
        expect(electricalEquipment.compute(input, ctx)).toEqual({ rows: 6, mat: 9920, lab: 7640, total: 17560 });
        const s = section26();
        expect(s?.matTotal).toBe(goldenSections['26']?.J);
        expect(s?.labTotal).toBe(goldenSections['26']?.L);
        expect(s?.total).toBe(goldenSections['26']?.M);
    });

    it('a 7th row (10 more downlights → key ~2) and a qty change flow to the BOQ', () => {
        const next: ElectricalEquipmentInput = {
            items: [...input.items.map((r, i) => (i === 3 ? { ...r, qty: 20 } : r)), pickRow('โคมไฟดาวน์ไลท์', 10, 'ชุด')],
        };
        const rows = equipmentRows(next);
        expect(rows).toHaveLength(7);
        expect(rows[6]?.key).toBe('electrical-equipment:items:โคมไฟดาวน์ไลท์~2');
        expect(rows[6]?.total).toBe(2700);                       // 10 × (150 + 120)
        expect(rows[3]?.total).toBe(3200);                       // 20 × (80 + 80)
        expect(section26(next)?.total).toBe(47520 + 2700 + 320);
    });

    it('typed labour price overrides the catalogue; an empty list empties the group', () => {
        const overridden = input.items.map((r, i) => (i === 0 ? { ...r, lab: 100 } : r));   // 25 × (150 + 100)
        expect(equipmentRows({ items: overridden })[0]).toMatchObject({ matUnit: 150, labUnit: 100, total: 6250 });
        expect(equipmentRows({ items: [] })).toHaveLength(0);
        expect(section26({ items: [] })?.total).toBe(47520 - 17560);
    });
});
