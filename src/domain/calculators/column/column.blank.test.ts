import { describe, expect, it } from 'vitest';
import { column, newColumnRow, type ColumnInput } from '.';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const blank = (): ColumnInput => {
    const b = column.blank?.();
    if (!b) throw new Error('column has no blank()');
    return b;
};

describe('เสา — blank project', () => {
    it('starts with no column types', () => {
        expect(blank()).toEqual({ columns: [] });
    });

    it('compute(blank) is finite and every BOQ-linked output is 0', () => {
        const o = column.compute(blank(), ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const link of column.boqLinks) expect(o[link.output], link.output).toBe(0);
        for (const k of Object.keys(o).filter(k => k.startsWith('rebar.'))) expect(o[k], k).toBe(0);
        expect(column.boqSlots?.(blank(), ctx)).toEqual({ rebar: [] });
    });

    it('in a blank project the BOQ rows it fills are 0 and there are no column rebar rows', () => {
        const r = computeProject(createProject('blank'), [column]);
        const rows = r.boq.sections.flatMap(s => s.rows).filter((x): x is BoqItemRow => x.type === 'item');
        for (const link of column.boqLinks) {
            const row = rows.find(x => x.key === link.line);
            expect(row?.qty, link.line).toBe(0);
            expect(row?.total, link.line).toBe(0);
        }
        expect(rows.filter(x => x.key.startsWith('column:'))).toEqual([]);
    });

    it('a new row has no size / count and the Excel bar spec; later rows copy height and bars', () => {
        expect(newColumnRow()).toEqual({
            name: '', count: 0, width: 0, depth: 0, height: 0, mainSize: 'DB12', mainCount: 0, stirrupSize: 'RB6', stirrupSpacing: 0.15,
        });
        const prev = { name: 'C1', count: 8, width: 0.2, depth: 0.2, height: 3.5, mainSize: 'DB16', mainCount: 4, stirrupSize: 'RB9', stirrupSpacing: 0.2 };
        expect(newColumnRow(prev)).toEqual({ ...prev, name: '', count: 0, width: 0, depth: 0 });
    });

    it('4 columns 0.2 × 0.2 × 3 m, 4-DB12, RB6 @0.15: concrete 0.48 m³, formwork 9.6 m²', () => {
        const o = column.compute({ columns: [{ ...newColumnRow(), name: 'C1', count: 4, width: 0.2, depth: 0.2, height: 3, mainCount: 4 }] }, ctx);
        expect(o.concrete).toBeCloseTo(0.48, 9);
        expect(o.formwork).toBeCloseTo(9.6, 9);
        expect(o['rebar.DB12']).toBeCloseTo(4 * 3 * 4 * 0.888, 9);     // 48 m
        expect(o['rebar.RB6']).toBeCloseTo(4 * 20 * 0.8 * 0.222, 9);   // ROUNDUP(3 / 0.15) = 20 stirrups × 0.8 m
    });
});
