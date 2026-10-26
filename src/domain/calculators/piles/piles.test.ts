import { describe, expect, it } from 'vitest';
import { composePileSpec, missingPileSpec, piles } from '.';
import { computeProject, createProject } from '../../project';
import { BOQ_TEMPLATE_V5 } from '../../boq/template.v5';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const goldenLines = golden.lines as Record<string, { E?: number; M?: number }>;
const goldenSections = golden.sections as Record<string, { M?: number }>;

const r35Template = BOQ_TEMPLATE_V5.flatMap(s => s.lines).find(l => l.key === 'R35');

function boqRow(result: ReturnType<typeof computeProject>, key: string): BoqItemRow | undefined {
    return result.boq.sections.flatMap(s => s.rows).find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
}

describe('งานเสาเข็ม (BOQ row 35, no Excel sheet)', () => {
    it('Excel sample: 21 ต้น × 2,500 บาท', () => {
        expect(piles.compute(piles.defaults(), ctx)).toEqual({ count: 21, pricePerPile: 2500 });
    });

    it('default spec equals Excel note N35 exactly', () => {
        expect(composePileSpec(piles.defaults())).toBe('เสาเข็มตอก (I - 22 x 22 ยาว 6 ม.)');
        expect(r35Template?.type === 'item' ? r35Template.note : undefined).toBe('เสาเข็มตอก (I - 22 x 22 ยาว 6 ม.)');
        expect(piles.boqText?.(piles.defaults(), ctx)).toEqual({ R35: { note: 'เสาเข็มตอก (I - 22 x 22 ยาว 6 ม.)' } });
        expect(missingPileSpec(piles.defaults())).toEqual([]);
    });

    it('links match the BOQ (Home) cells they feed', () => {
        expect(piles.boqLinks).toEqual([
            { line: 'R35', field: 'qty', output: 'count' },
            { line: 'R35', field: 'lab', output: 'pricePerPile' },
        ]);
        const out = piles.compute(piles.defaults(), ctx);
        expect(out.count).toBe(goldenLines.R35?.E);
        expect(r35Template?.type === 'item' ? r35Template.lab : undefined).toBe(out.pricePerPile);
        expect(r35Template?.type === 'item' ? r35Template.mat : undefined).toBe(0);
    });

    it('in the project: R35 = 52,500, R39 ตัดหัวเสาเข็ม follows, sections 5/6 match Excel', () => {
        const result = computeProject(createProject(), [piles]);
        const r35 = boqRow(result, 'R35');
        expect(r35?.qty).toBe(21);
        expect(r35?.total).toBe(goldenLines.R35?.M);
        expect(r35?.note).toBe('เสาเข็มตอก (I - 22 x 22 ยาว 6 ม.)');
        expect(boqRow(result, 'R39')?.qty).toBe(goldenLines.R39?.E);
        const sec = (no: number) => result.boq.sections.find(s => s.no === no)?.total;
        expect(sec(5)).toBeCloseTo(goldenSections['5']?.M ?? NaN, 2);
        expect(sec(6)).toBeCloseTo(goldenSections['6']?.M ?? NaN, 2);
    });

    it('changing the inputs: 30 bored piles Ø 35 ซม. 12 ม. at 4,200 + extra spec', () => {
        const input = {
            ...piles.defaults(),
            pileType: 'เสาเข็มเจาะ', section: 'กลม Ø 35 ซม.', length: 12.5, count: 30, pricePerPile: 4200,
            extraSpec: 'รับน้ำหนัก 30 ตัน/ต้น',
        };
        expect(composePileSpec(input)).toBe('เสาเข็มเจาะ (กลม Ø 35 ซม. ยาว 12.5 ม.) รับน้ำหนัก 30 ตัน/ต้น');
        const project = { ...createProject(), calculators: { piles: input } };
        const result = computeProject(project, [piles]);
        expect(boqRow(result, 'R35')?.total).toBe(30 * 4200); // 126,000
        expect(boqRow(result, 'R39')?.qty).toBe(30);
        expect(boqRow(result, 'R39')?.total).toBe(30 * 170); // 5,100
    });

    it('warns about empty spec fields and leaves them out of the note', () => {
        const input = { ...piles.defaults(), section: '', length: 0 };
        expect(missingPileSpec(input)).toEqual(['หน้าตัด/รูปทรง', 'ความยาว']);
        expect(composePileSpec(input)).toBe('เสาเข็มตอก');
        expect(missingPileSpec({ ...piles.defaults(), pileType: '  ' })).toEqual(['ชนิดเสาเข็ม']);
        expect(composePileSpec({ ...piles.defaults(), pileType: '' })).toBe('(I - 22 x 22 ยาว 6 ม.)');
    });

    it('blank (a new project): spec and count empty, price kept; R35 and R39 are 0', () => {
        const blank = piles.blank?.();
        expect(blank).toEqual({ pileType: '', section: '', length: 0, count: 0, pricePerPile: 2500, extraSpec: '' });
        if (!blank) return;
        expect(piles.compute(blank, ctx)).toEqual({ count: 0, pricePerPile: 2500 });
        expect(composePileSpec(blank)).toBe('');
        expect(missingPileSpec(blank)).toEqual(['ชนิดเสาเข็ม', 'หน้าตัด/รูปทรง', 'ความยาว']);
        const result = computeProject(createProject('blank'), [piles]);
        expect(boqRow(result, 'R35')?.qty).toBe(0);
        expect(boqRow(result, 'R35')?.total).toBe(0);
        expect(boqRow(result, 'R39')?.qty).toBe(0);
        expect(boqRow(result, 'R39')?.total).toBe(0);
        // defaults() is still the Excel sample
        expect(piles.compute(piles.defaults(), ctx)).toEqual({ count: 21, pricePerPile: 2500 });
    });

    it('non-numeric inputs give 0, not NaN', () => {
        expect(piles.compute({ ...piles.defaults(), count: NaN, pricePerPile: Infinity }, ctx))
            .toEqual({ count: 0, pricePerPile: 0 });
    });
});
