import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '../../project';

// Sheet 24 cached v5 values (rows 6–14 and row 18), docs/excel-spec/02 §1.2.
describe('ตารางสรุปวัสดุงานโครงสร้าง (sheet 24)', () => {
    const out = computeProject(createProject()).calcOutputs['structure-summary'] ?? {};

    it('element rows read the element sheets', () => {
        expect(out['footing.excavation']).toBeCloseTo(53.508, 6);
        expect(out['footing.backfill']).toBeCloseTo(43.7115, 6);
        expect(out['pedestal.rebar.DB12']).toBeCloseTo(156.6432, 6);
        expect(out['ground-beam.lean']).toBeCloseTo(1.152, 6);
        expect(out['slab-on-grade.backfill']).toBeCloseTo(20.04, 6);
        expect(out['precast-slab.wiremesh']).toBeCloseTo(74.75, 6);
    });

    it('row 18 totals match Excel (D18…P18); Q18 also counts the footing backfill (D1)', () => {
        expect(out['total.sand']).toBeCloseTo(5.70375, 6);
        expect(out['total.lean']).toBeCloseTo(3.21, 6);
        expect(out['total.plastic']).toBeCloseTo(50.1, 6);
        expect(out['total.rebar.RB6']).toBeCloseTo(419.7576, 4);
        expect(out['total.rebar.RB9']).toBeCloseTo(942.3859, 4);
        expect(out['total.rebar.DB12']).toBeCloseTo(1835.5848, 4);
        expect(out['total.props']).toBeCloseTo(114, 6);
        expect(out['total.concrete']).toBeCloseTo(32.8802, 4);
        expect(out['total.backfill']).toBeCloseTo(20.04 + 43.7115, 6);
        expect(out['total.rebar']).toBeCloseTo(3197.73, 2);
    });
});
