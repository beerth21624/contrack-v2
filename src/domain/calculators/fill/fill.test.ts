import { describe, expect, it } from 'vitest';
import { fill } from '.';
import { demolition } from '../demolition';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };

const r13 = (calcInput?: unknown) => {
    const project = createProject();
    if (calcInput !== undefined) project.calculators.fill = calcInput;
    const res = computeProject(project, [demolition, fill]);
    const sec = res.boq.sections.find(s => s.no === 1);
    const row = sec?.rows.find(r => r.key === 'R13') as BoqItemRow;
    return { row, section: sec };
};

describe('ถมดิน (sheet 34)', () => {
    it('Excel sample inputs (D4:D7)', () => {
        expect(fill.defaults()).toEqual({
            width: 20, length: 20, height: 0.45, settlementPct: 30, material: 'ลูกค้าจัดหาเอง',
        });
    });

    it('Excel sample: D9 ปริมาณดินที่ต้องสั่ง = 234 คิว', () => {
        expect(fill.compute(fill.defaults(), ctx).volume).toBeCloseTo(234, 9);
    });

    it('feeds BOQ R13 like Excel: E13 = 234, H13 = 257.4 (10 % waste kept), note ลูกค้าจัดหาเอง', () => {
        const { row, section } = r13();
        expect(row.qty).toBeCloseTo(golden.lines.R13.E, 9);
        expect(row.grossQty).toBeCloseTo(golden.lines.R13.H, 9);
        expect(row.total).toBe(golden.lines.R13.M);
        expect(row.fromCalc.qty).toBe(true);
        expect(row.note).toBe('ลูกค้าจัดหาเอง');
        expect(section?.total).toBeCloseTo(golden.sections['1'].M, 2);
    });

    it('changing inputs: 10 × 15 × 0.5 with 20 % settlement = 90 คิว', () => {
        const input = { ...fill.defaults(), width: 10, length: 15, height: 0.5, settlementPct: 20 };
        expect(fill.compute(input, ctx).volume).toBeCloseTo(90, 9);
        const { row } = r13(input);
        expect(row.qty).toBeCloseTo(90, 9);
        expect(row.grossQty).toBeCloseTo(99, 9);
    });

    it('fill material text goes to the BOQ note (N13)', () => {
        expect(r13({ ...fill.defaults(), material: 'ดินลูกรัง' }).row.note).toBe('ดินลูกรัง');
        expect(r13({ ...fill.defaults(), material: '' }).row.note).toBe('');
    });

    it('blank project: area and height empty, settlement % and material kept, BOQ E13 = 0', () => {
        const blank = fill.blank?.();
        expect(blank).toEqual({ width: 0, length: 0, height: 0, settlementPct: 30, material: 'ลูกค้าจัดหาเอง' });
        if (!blank) return;
        const out = fill.compute(blank, ctx);
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
        expect(out.volume).toBe(0);
        const res = computeProject(createProject('blank'), [demolition, fill]);
        const row = res.boq.sections.find(s => s.no === 1)?.rows.find(r => r.key === 'R13') as BoqItemRow;
        expect(row.qty).toBe(0);
        expect(row.total).toBe(0);
    });

    it('links D9 to BOQ R13 qty', () => {
        expect(fill.boqLinks).toEqual([{ line: 'R13', field: 'qty', output: 'volume' }]);
    });
});
