import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import { footing, footingRow, footingTotals, newFootingRow, totalKg, type FootingRow } from '.';
import { pedestal } from '../pedestal';

const ctx = { outputs: () => undefined };
const goldenLines = golden.lines as Record<string, { E?: number; H?: number }>;
const goldenSections = golden.sections as Record<string, { M: number }>;

function first<T>(rows: T[]): T {
    const [row] = rows;
    if (row === undefined) throw new Error('empty table');
    return row;
}

/** Hand-computed extra footing: pit (1.0+0.8)(1.2+0.8) = 3.6 m². */
const F2: FootingRow = {
    name: 'F2', count: 4, width: 1.0, length: 1.2, depth: 0.5,
    excavationDepth: 1.2, sandThickness: 0.05, leanThickness: 0.05,
    shortBarSize: 'DB16', shortBarCount: 6, longBarSize: 'DB16', longBarCount: 7,
    ringBarSize: 'RB9', ringBarCount: 2,
};

describe('ฐานราก_Footing (sheet 25)', () => {
    const input = footing.defaults();
    const out = footing.compute(input, ctx);

    it('Excel sample row 8: every computed cell', () => {
        const r = footingRow(first(input.rows));
        expect(r.excavation).toBeCloseTo(53.508, 9);   // I8
        expect(r.sand).toBeCloseTo(2.5725, 9);         // K8
        expect(r.lean).toBeCloseTo(2.058, 9);          // M8
        expect(r.shortLength).toBeCloseTo(1.8, 9);     // Q8
        expect(r.shortTotal).toBeCloseTo(189, 9);      // R8
        expect(r.shortKg).toBeCloseTo(167.832, 9);     // S8
        expect(r.longLength).toBeCloseTo(1.8, 9);      // V8
        expect(r.longTotal).toBeCloseTo(189, 9);       // W8
        expect(r.longKg).toBeCloseTo(167.832, 9);      // X8
        expect(r.ringLength).toBeCloseTo(2.4, 9);      // AA8
        expect(r.ringTotal).toBeCloseTo(100.8, 9);     // AB8
        expect(r.ringKg).toBeCloseTo(50.2992, 9);      // AC8
        expect(r.formwork).toBeCloseTo(30.24, 9);      // AE8
        expect(r.concrete).toBeCloseTo(4.536, 9);      // AG8
        // AI8 = 43.7115 once the pedestal V8 (0.63) is subtracted (see pedestal.test.ts)
        expect(r.backfillGross).toBeCloseTo(43.7115 + 0.63, 9);
    });

    it('Excel totals row 6 (H6, J6, L6, O6:AC6, AE6, AG6)', () => {
        const t = footingTotals(input.rows);
        expect(t.excavation).toBeCloseTo(53.508, 9);
        expect(t.sand).toBeCloseTo(2.5725, 9);
        expect(t.lean).toBeCloseTo(2.058, 9);
        const round = (w: Record<string, number>) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, Number(v.toFixed(9))]));
        expect(round(t.short)).toEqual({ RB6: 0, RB9: 0, DB12: 167.832, DB16: 0, DB20: 0 });   // O6:S6
        expect(round(t.long)).toEqual({ RB6: 0, RB9: 0, DB12: 167.832, DB16: 0, DB20: 0 });    // T6:X6
        expect(round(t.ring)).toEqual({ RB6: 0, RB9: 50.2992, DB12: 0, DB16: 0, DB20: 0 });    // Y6:AC6
        expect(t.formwork).toBeCloseTo(30.24, 9);
        expect(t.concrete).toBeCloseTo(4.536, 9);
    });

    it('sheet 24 row 6 rebar by size (I6:M6) and standard outputs', () => {
        expect(out['rebar.RB6']).toBe(0);
        expect(out['rebar.RB9']).toBeCloseTo(50.2992, 9);
        expect(out['rebar.DB12']).toBeCloseTo(335.664, 9);
        expect(out['rebar.DB16']).toBe(0);
        expect(out['rebar.DB20']).toBe(0);
        expect(out.rows).toBe(1);
        expect(out['row.0.width']).toBe(0.6);
        expect(out['row.0.depth']).toBe(0.6);
    });

    it('linked outputs equal the BOQ (Home) quantities R38, R40, R41, R55, R58', () => {
        expect(footing.boqLinks).toEqual([
            { line: 'R38', field: 'qty', output: 'excavation' },
            { line: 'R40', field: 'qty', output: 'sand' },
            { line: 'R41', field: 'qty', output: 'lean' },
            { line: 'R55', field: 'qty', output: 'formwork' },
            { line: 'R58', field: 'qty', output: 'concrete' },
        ]);
        for (const l of footing.boqLinks) expect(out[l.output]).toBeCloseTo(goldenLines[l.line]?.E ?? NaN, 9);
    });

    it('rebar slot reproduces BOQ R43 RB9 / R44 DB12 / R45 tie wire', () => {
        const rows = footing.boqSlots?.(input, ctx).rebar ?? [];
        expect(rows.map(r => r.key)).toEqual(['RB9', 'DB12', 'tie-wire']);
        const r43 = first(rows);
        expect(r43.type === 'item' && r43.qty.kind === 'input' ? r43.qty.value : NaN).toBeCloseTo(goldenLines.R43?.E ?? NaN, 9);
        const r44 = rows[1];
        expect(r44?.type === 'item' && r44.qty.kind === 'input' ? r44.qty.value : NaN).toBeCloseTo(goldenLines.R44?.E ?? NaN, 9);
    });

    it('in a project with the pedestal sheet, BOQ sections 6, 7 and 8 equal Excel', () => {
        const r = computeProject(createProject(), [footing, pedestal]);
        for (const no of [6, 7, 8]) {
            expect(r.boq.sections.find(s => s.no === no)?.total).toBeCloseTo(goldenSections[String(no)]?.M ?? NaN, 2);
        }
        const s6 = r.boq.sections.find(s => s.no === 6)?.rows ?? [];
        const wire = s6.find(row => row.key === 'footing:rebar:tie-wire');
        expect(wire?.type === 'item' ? wire.grossQty : null).toBeCloseTo(goldenLines.R45?.H ?? NaN, 6);
    });

    it('an added footing type adds to every total (hand-computed)', () => {
        const i = footing.defaults();
        i.rows.push(F2);
        const r = footingRow(F2);
        expect(r.excavation).toBeCloseTo(17.28, 9);       // 4 × 3.6 × 1.2
        expect(r.sand).toBeCloseTo(0.9, 9);               // 4 × 3.6 × 0.05 × 1.25
        expect(r.lean).toBeCloseTo(0.72, 9);
        expect(r.shortKg).toBeCloseTo(4 * 6 * 2.0 * 1.58, 9);   // bar = 1.0 + 2×0.5
        expect(r.longKg).toBeCloseTo(4 * 7 * 2.2 * 1.58, 9);    // bar = 1.2 + 2×0.5
        expect(r.ringKg).toBeCloseTo(4 * 2 * 4.4 * 0.499, 9);
        expect(r.formwork).toBeCloseTo(8.8, 9);           // 4 × 4.4 × 0.5
        expect(r.concrete).toBeCloseTo(2.4, 9);           // 4 × 1.2 × 0.5
        expect(r.backfillGross).toBeCloseTo(17.28 - 0.9 - 0.72 - 2.4, 9);
        const o = footing.compute(i, ctx);
        expect(o.excavation).toBeCloseTo(53.508 + 17.28, 9);
        expect(o['rebar.DB16']).toBeCloseTo(75.84 + 97.328, 9);
        expect(o['rebar.RB9']).toBeCloseTo(50.2992 + 17.5648, 9);
        expect(o['row.1.depth']).toBe(0.5);
        const keys = (footing.boqSlots?.(i, ctx).rebar ?? []).map(x => x.key);
        expect(keys).toEqual(['RB9', 'DB12', 'DB16', 'tie-wire']);
    });

    it('a blank bar size weighs 0 (Excel SWITCH default)', () => {
        const i = footing.defaults();
        i.rows = [{ ...first(i.rows), ringBarSize: '' }];
        const o = footing.compute(i, ctx);
        expect(o['rebar.RB9']).toBe(0);
        expect(footingRow(first(i.rows)).ringTotal).toBeCloseTo(100.8, 9);
    });
});

describe('ฐานราก_Footing — blank project (guided journey)', () => {
    it('blank() has no footing types; every output is finite and every linked output 0', () => {
        const blank = footing.blank?.();
        expect(blank).toEqual({ rows: [] });
        if (!blank) return;
        const o = footing.compute(blank, ctx);
        expect(Object.values(o).every(Number.isFinite)).toBe(true);
        for (const l of footing.boqLinks) expect(o[l.output], l.output).toBe(0);
        expect(o.backfillGross).toBe(0);
        expect(footing.boqSlots?.(blank, ctx)).toEqual({ rebar: [] });
        // defaults() is still the Excel sample
        expect(footing.compute(footing.defaults(), ctx).excavation).toBeCloseTo(53.508, 9);
    });

    it('in a blank project the footing and pedestal BOQ rows are 0 (R38–R41, R43–R49, R55–R58, R62–R65, R68)', () => {
        const r = computeProject(createProject('blank'), [footing, pedestal]);
        const rows = r.boq.sections.filter(s => [6, 7, 8].includes(s.no)).flatMap(s => s.rows);
        const qty = (key: string) => {
            const row = rows.find(x => x.key === key);
            return row?.type === 'item' ? row.qty : undefined;
        };
        for (const k of ['R38', 'R40', 'R41', 'R55', 'R56', 'R57', 'R58', 'R62', 'R63', 'R64', 'R65', 'R68']) {
            expect(qty(k), k).toBe(0);
        }
        expect(rows.some(x => x.key.startsWith('footing:') || x.key.startsWith('pedestal:'))).toBe(false);
        expect(r.calcOutputs.pedestal?.backfill).toBe(0);
    });

    it('a footing type added in the journey: plan values empty, Excel standard bed and bars, next free name', () => {
        const a = newFootingRow([]);
        expect(a).toEqual({
            name: 'F1', count: 0, width: 0, length: 0, depth: 0, excavationDepth: 0, sandThickness: 0.05, leanThickness: 0.05,
            shortBarSize: 'DB12', shortBarCount: 0, longBarSize: 'DB12', longBarCount: 0, ringBarSize: 'RB9', ringBarCount: 0,
        });
        expect(newFootingRow([a]).name).toBe('F2');
        expect(newFootingRow([a, { ...a, name: 'F2' }]).name).toBe('F4'); // Excel's list has no F3
        expect(newFootingRow([a, { ...a, name: 'F2' }, { ...a, name: 'F4' }]).name).toBe('');
        // until the plan values are typed it adds nothing
        const o = footing.compute({ rows: [a] }, ctx);
        for (const l of footing.boqLinks) expect(o[l.output]).toBe(0);
        expect(totalKg(footingTotals([a]).rebar)).toBe(0);
        // F2 of the hand-computed example: 4·6·2.0·1.58 + 4·7·2.2·1.58 + 4·2·4.4·0.499
        expect(totalKg(footingTotals([F2]).rebar)).toBeCloseTo(4 * 6 * 2 * 1.58 + 4 * 7 * 2.2 * 1.58 + 4 * 2 * 4.4 * 0.499, 9);
    });
});
