// Project-level golden test: a fresh project (every calculator on its Excel v5 sample input) must
// give the same BOQ as the Excel workbook. Where a calculator now feeds a BOQ cell that Excel
// retyped by hand (decision D3) or fixes an Excel bug (D1), the difference is listed in
// KNOWN_DELTAS with its reason — anything else is a regression.
import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '../project';
import { CALCULATORS } from '../calculators/registry';
import golden from '../boq/__tests__/golden.v5.json';

const goldenSections = golden.sections as Record<string, { M?: number }>;

/** section no → expected difference (app − Excel) and why. */
const KNOWN_DELTAS: Record<number, { delta: number; reason: string }> = {
    2: { delta: -31, reason: 'D3: material 6,469 from น้ำไฟชั่วคราว C30 instead of the retyped 6,500 in BOQ I16' },
    12: {
        delta: 4191.90522,
        reason: 'D1: roof-beam formwork 2·D·E + C·E instead of Excel (2·D·E)+C (+6.4 m² ไม้แบบ incl. ไม้คร่าว/ตะปู = +3,984); '
            + 'roof-beam rebar waste per size (RB6 6 %, DB12 12 %) instead of Excel G116/G117 swapped (+207.90522)',
    },
    22: {
        delta: 684,
        reason: 'D1: BOQ E218/E219 SUMIF criteria swapped in Excel — R218 บัว 0.3 (400/200) now takes the 0.3 moulding '
            + '(13 m, not 11), R219 บัว 0.1 (180/100) the 0.1 moulding (11 m, not 13)',
    },
};

describe('project with Excel sample inputs', () => {
    const result = computeProject(createProject());

    it('runs every registered calculator', () => {
        expect(Object.keys(result.calcOutputs).sort()).toEqual(CALCULATORS.map(c => c.id).sort());
    });

    it.each(result.boq.sections.map(s => [s.no, s.total] as const))('section %i total matches Excel', (no, total) => {
        const excel = goldenSections[String(no)]?.M ?? 0;
        expect(total).toBeCloseTo(excel + (KNOWN_DELTAS[no]?.delta ?? 0), 2);
    });

    it('construction total = Excel M310 + known deltas', () => {
        const deltas = Object.entries(KNOWN_DELTAS).filter(([no]) => no !== '0').reduce((s, [, d]) => s + d.delta, 0);
        expect(result.boq.constructionTotal).toBeCloseTo(golden.constructionTotal + deltas, 2);
    });
});
