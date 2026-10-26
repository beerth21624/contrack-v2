// Golden test: the BOQ engine fed with the Excel v5 sample values must reproduce every number
// Excel cached in "BOQ (Home)" — each line's E/H/J/L/M, each section total and M310.
import { describe, expect, it } from 'vitest';
import { computeBoq } from '../engine';
import { BOQ_TEMPLATE_V5 } from '../template.v5';
import type { BoqItemRow, BoqResult } from '../types';
import golden from './golden.v5.json';

interface GoldenValues { E?: number; H?: number; J?: number; L?: number; M?: number }
const goldenLines = golden.lines as Record<string, GoldenValues>;
const goldenSections = golden.sections as Record<string, GoldenValues>;

/**
 * Sections whose Excel J/L sub-totals cover only part of the section (J95/L95, J216/L216, L243).
 * Decision D1: the app sums every row, so only M (which Excel sums correctly) is compared there.
 */
const SHORT_RANGE_SUBTOTALS = new Set([9, 21, 24]);

function itemRows(result: BoqResult): Map<string, BoqItemRow> {
    const map = new Map<string, BoqItemRow>();
    for (const s of result.sections) for (const r of s.rows) if (r.type === 'item') map.set(r.key, r);
    return map;
}

const result = computeBoq({ sections: BOQ_TEMPLATE_V5 });
const rowsByKey = itemRows(result);

describe('BOQ (Home) v5 golden values', () => {
    it('has all 32 sections and every Excel item row', () => {
        expect(result.sections.map(s => s.no)).toEqual(Array.from({ length: 32 }, (_, i) => i));
        expect(rowsByKey.size).toBe(Object.keys(goldenLines).length);
    });

    it.each(Object.entries(goldenLines))('line %s matches Excel', (key, g) => {
        const row = rowsByKey.get(key);
        expect(row, key).toBeDefined();
        if (!row) return;
        if (g.E !== undefined) expect(row.qty).toBeCloseTo(g.E, 4);
        if (g.H !== undefined) expect(row.grossQty ?? row.qty).toBeCloseTo(g.H, 4);
        expect(row.matTotal).toBeCloseTo(g.J ?? 0, 2);
        expect(row.labTotal).toBeCloseTo(g.L ?? 0, 2);
        expect(row.total).toBeCloseTo(g.M ?? 0, 2);
    });

    it.each(result.sections.map(s => [s.no, s] as const))('section %i sub-total matches Excel', (no, s) => {
        const g = goldenSections[String(no)];
        expect(g, `section ${no}`).toBeDefined();
        if (!g) return;
        expect(s.total).toBeCloseTo(g.M ?? 0, 2);
        if (!SHORT_RANGE_SUBTOTALS.has(no)) {
            expect(s.matTotal).toBeCloseTo(g.J ?? 0, 2);
            expect(s.labTotal).toBeCloseTo(g.L ?? 0, 2);
        }
    });

    it('construction total equals Excel M310 (1,850,317.34) and excludes section 0', () => {
        expect(result.constructionTotal).toBeCloseTo(golden.constructionTotal, 2);
        expect(result.constructionTotal).toBeCloseTo(1850317.343, 2);
        expect(result.preConstructionTotal).toBeCloseTo(7500, 2);
    });
});

describe('BOQ engine behaviour', () => {
    const section = (r: BoqResult, no: number) => {
        const s = r.sections.find(x => x.no === no);
        if (!s) throw new Error(`section ${no} missing`);
        return s;
    };
    const line = (r: BoqResult, key: string) => {
        const row = itemRows(r).get(key);
        if (!row) throw new Error(`line ${key} missing`);
        return row;
    };

    it('applies overrides for typed quantities and prices', () => {
        const base = computeBoq({ sections: BOQ_TEMPLATE_V5 });
        const r = computeBoq({ sections: BOQ_TEMPLATE_V5, overrides: { R35: { qty: 30, lab: 3000 } } });
        expect(line(r, 'R35').total).toBe(90000);
        // pile-head cutting (R39 = R35) follows: 9 more piles × 170
        expect(r.constructionTotal - base.constructionTotal).toBeCloseTo(90000 - section(base, 5).total + 9 * 170, 2);
    });

    it('derived lines follow their source (pile-head cutting = pile count)', () => {
        const r = computeBoq({ sections: BOQ_TEMPLATE_V5, overrides: { R35: { qty: 30 } } });
        expect(line(r, 'R39').qty).toBe(30);
    });

    it('uses calculator values when present; BOQ-page edits win over them', () => {
        const r = computeBoq({ sections: BOQ_TEMPLATE_V5, linked: { R13: { qty: 100 }, R9: { lab: 9000 } } });
        expect(line(r, 'R13').qty).toBe(100);
        expect(line(r, 'R13').fromCalc.qty).toBe(true);
        expect(line(r, 'R9').total).toBe(9000);
        const edited = computeBoq({
            sections: BOQ_TEMPLATE_V5, linked: { R13: { qty: 100 } }, overrides: { R13: { qty: 50 } },
        });
        expect(line(edited, 'R13').qty).toBe(50);
        expect(line(edited, 'R13').fromCalc.qty).toBe(false);
    });
});
