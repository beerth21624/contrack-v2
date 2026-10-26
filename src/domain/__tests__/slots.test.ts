// BOQ slots: a calculator that supplies rebar rows through `boqSlots` must reproduce Excel's
// fixed rebar rows (footing RB9 50.2992 kg / DB12 335.664 kg + tie wire → section 6 = Excel M59).
import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '../project';
import { defineCalculator } from '../calculators/types';
import { rebarSlotRows } from '../boq/slots';
import golden from '../boq/__tests__/golden.v5.json';

const stubFooting = defineCalculator<Record<string, never>>({
    id: 'footing', sheetName: 'ฐานราก_Footing', title: 'stub', titleEn: 'stub', sections: [6], deps: [],
    defaults: () => ({}),
    compute: () => ({}),
    boqLinks: [],
    boqSlots: () => ({ rebar: rebarSlotRows({ RB9: 50.2992, DB12: 335.664 }) }),
});

describe('BOQ slots', () => {
    it('rebar rows from a calculator match Excel rows R43–R45', () => {
        const r = computeProject(createProject(), [stubFooting]);
        const s6 = r.boq.sections.find(s => s.no === 6);
        expect(s6?.total).toBeCloseTo((golden.sections as Record<string, { M: number }>)['6']?.M ?? NaN, 2);
        const keys = s6?.rows.map(row => row.key) ?? [];
        expect(keys).toContain('footing:rebar:DB12');
        expect(keys).toContain('footing:rebar:tie-wire');
        expect(keys).not.toContain('R43');
    });

    it('a bar size with zero weight produces no row; the tie wire follows the rows present', () => {
        const calc = { ...stubFooting, boqSlots: () => ({ rebar: rebarSlotRows({ DB12: 100 }) }) };
        const r = computeProject(createProject(), [calc]);
        const rows = r.boq.sections.find(s => s.no === 6)?.rows ?? [];
        const wire = rows.find(row => row.key === 'footing:rebar:tie-wire');
        expect(rows.some(row => row.key === 'footing:rebar:RB9')).toBe(false);
        expect(wire?.type === 'item' ? wire.grossQty : null).toBeCloseTo(100 * 1.12 * 0.03, 6);
    });
});
