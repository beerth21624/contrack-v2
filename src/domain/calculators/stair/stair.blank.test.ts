import { describe, expect, it } from 'vitest';
import { newStairRow, stair, stairRow, withStepChange, type StairInput } from '.';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const blank = (): StairInput => {
    const b = stair.blank?.();
    if (!b) throw new Error('stair has no blank()');
    return b;
};

describe('บันได — blank project', () => {
    it('starts with no stairs', () => {
        expect(blank()).toEqual({ rows: [] });
    });

    it('compute(blank) is finite and every BOQ-linked output is 0', () => {
        const o = stair.compute(blank(), ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        for (const link of stair.boqLinks) expect(o[link.output], link.output).toBe(0);
        for (const k of Object.keys(o).filter(k => k.startsWith('rebar.'))) expect(o[k], k).toBe(0);
        expect(stair.boqSlots?.(blank(), ctx)).toEqual({ rebar: [] });
    });

    it('in a blank project the BOQ rows it fills are 0 and there are no stair rebar rows', () => {
        const r = computeProject(createProject('blank'), [stair]);
        const rows = (r.boq.sections.find(s => s.no === 13)?.rows ?? []).filter((x): x is BoqItemRow => x.type === 'item');
        for (const link of stair.boqLinks) {
            const row = rows.find(x => x.key === link.line);
            expect(row?.qty, link.line).toBe(0);
            expect(row?.total, link.line).toBe(0);
        }
        expect(rows.filter(x => x.key.startsWith('stair:'))).toEqual([]);
    });

    it('a new stair has no size and RB9 @0.15 bars; later stairs copy the previous bars', () => {
        const n = newStairRow();
        expect(n).toMatchObject({ name: '', width: 0, waist: 0, rise: 0, run: 0, steps: 0, riser: 0, tread: 0 });
        expect(n).toMatchObject({
            waistMainSize: 'RB9', waistMainSpacing: 0.15, waistTempSize: 'RB9', waistTempSpacing: 0.15,
            stepMainSize: 'RB9', stepMainSpacing: 0.15, stepTempSize: 'RB9', stepTempSpacing: 0.15,
        });
        const prev = { ...n, name: 'บันไดหน้าบ้าน', width: 2, waistMainSize: 'DB12', waistMainSpacing: 0.2 };
        expect(newStairRow(prev)).toEqual({ ...n, waistMainSize: 'DB12', waistMainSpacing: 0.2 });
        // An empty stair computes to 0 everywhere (no NaN from √0 or the spacings).
        const r = stairRow(n);
        expect([r.concrete, r.formwork, r.props, r.waistMain.kg, r.stepTemp.kg]).toEqual([0, 0, 0, 0, 0]);
    });

    it('steps × riser / tread fill the total rise and run while they still match', () => {
        let row = newStairRow();
        row = withStepChange(row, { steps: 3 });
        row = withStepChange(row, { riser: 0.15 });
        row = withStepChange(row, { tread: 0.3 });
        expect(row.rise).toBeCloseTo(0.45, 9);
        expect(row.run).toBeCloseTo(0.9, 9);
        // Sample stair rows already match (3 × 0.15, 3 × 0.3): one more step updates both.
        const sample = stair.defaults().rows[0];
        if (!sample) throw new Error('no sample row');
        const more = withStepChange(sample, { steps: 4 });
        expect(more.rise).toBeCloseTo(0.6, 9);
        expect(more.run).toBeCloseTo(1.2, 9);
        // A rise typed by hand is kept.
        const typed = withStepChange({ ...sample, rise: 0.5 }, { steps: 4 });
        expect(typed.rise).toBe(0.5);
        expect(typed.run).toBeCloseTo(1.2, 9);
    });
});
