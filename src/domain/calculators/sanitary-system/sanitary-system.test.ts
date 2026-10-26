import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import { catalogueItem, pickRow } from '../shared/pick-list';
import { SANITARY_SYSTEM_CATALOGUE, SANITARY_SYSTEM_ITEMS, sanitarySystem, type SanitarySystemInput } from '.';

const ctx = { outputs: () => undefined };
const goldenLines = golden.lines as Record<string, { E?: number; I?: number; J?: number; K?: number; L?: number; M?: number }>;
const goldenSections = golden.sections as Record<string, { J: number; L: number; M: number }>;

const section27 = (input?: SanitarySystemInput) => {
    const project = createProject();
    if (input) project.calculators['sanitary-system'] = input;
    return computeProject(project, [sanitarySystem]).boq.sections.find(s => s.no === 27);
};
const boqRows = (input?: SanitarySystemInput): BoqItemRow[] =>
    (section27(input)?.rows ?? []).filter((r): r is BoqItemRow => r.type === 'item' && r.key.startsWith('sanitary-system:'));

describe('ระบบสุขาภิบาล_Sanitary System (sheet 07)', () => {
    const input = sanitarySystem.defaults();

    it('Excel sample rows 5–8 (item verbatim, qty, unit); every dropdown option is priced', () => {
        expect(input.items.map(r => [r.item, r.qty, r.unit])).toEqual([
            ['ถังดักไขมัน ขนาด 20 ลิตร', 1, 'ชุด'],
            ['ถังบำบัดน้ำเสียสาเร็จรูป ขนาด 600 ลิตร ', 2, 'ชุด'],
            ['บ่อพักน้ำทิ้งสำเร็จรูป ขนาด 40 x 40 ซม. ', 6, 'ชุด'],
            ['ท่อระบายน้า AC Dia.8”', 36, 'ม.'],
        ]);
        for (const item of SANITARY_SYSTEM_ITEMS) expect(catalogueItem(SANITARY_SYSTEM_CATALOGUE, item)).toBeDefined();
    });

    it('BOQ slot = Excel rows 273–276 (C, D, F, E, I, J, K, L, M, N รถแมคโครเล็ก on 274–276)', () => {
        const rows = boqRows();
        const excel = ['R273', 'R274', 'R275', 'R276'];
        const notes = [undefined, 'รถแมคโครเล็ก', 'รถแมคโครเล็ก', 'รถแมคโครเล็ก'];
        expect(rows).toHaveLength(excel.length);
        rows.forEach((r, i) => {
            const g = goldenLines[excel[i] ?? ''];
            expect(r.itemNo).toBe(`${i + 1})`);
            expect(r.desc).toBe(input.items[i]?.item.trim());
            expect(r.unit).toBe(input.items[i]?.unit);
            expect(r.qty).toBe(g?.E);
            expect(r.matUnit).toBe(g?.I);
            expect(r.matTotal).toBe(g?.J);
            expect(r.labUnit).toBe(g?.K);
            expect(r.labTotal).toBe(g?.L);
            expect(r.total).toBe(g?.M);
            expect(r.note).toBe(notes[i]);
        });
    });

    it('sheet totals = Σ J/L273:276; section 27 = Excel J/L/M277', () => {
        expect(sanitarySystem.compute(input, ctx)).toEqual({ rows: 4, mat: 24500, lab: 12900, total: 37400 });
        const s = section27();
        expect(s?.matTotal).toBe(goldenSections['27']?.J);
        expect(s?.labTotal).toBe(goldenSections['27']?.L);
        expect(s?.total).toBe(goldenSections['27']?.M);
    });

    it('a second septic tank row gets key ~2 and keeps the note; typed prices override', () => {
        const next: SanitarySystemInput = {
            items: [...input.items, pickRow('ถังบำบัดน้ำเสียสาเร็จรูป ขนาด 600 ลิตร', 1, '')],
        };
        const rows = boqRows(next);
        expect(rows[4]).toMatchObject({
            key: 'sanitary-system:items:ถังบำบัดน้ำเสียสาเร็จรูป ขนาด 600 ลิตร~2', itemNo: '5)', unit: 'ชุด',
            total: 10000, note: 'รถแมคโครเล็ก',
        });
        expect(section27(next)?.total).toBe(37400 + 10000);
        const overridden = input.items.map((r, i) => (i === 3 ? { ...r, mat: 250, lab: 150 } : r));   // 36 × 400
        expect(boqRows({ items: overridden })[3]?.total).toBe(14400);
        expect(section27({ items: overridden })?.total).toBe(37400 + 1800);
    });
});
