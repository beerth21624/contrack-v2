import { describe, expect, it } from 'vitest';
import { roofBeam, roofBeamRow, roofBeamTotals, type RoofBeamRow } from '.';
import { roofSlab } from '../roof-slab';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const g = golden.lines;

function section12(input?: unknown) {
    const project = createProject();
    if (input !== undefined) project.calculators['roof-beam'] = input;
    const sec = computeProject(project, [roofBeam]).boq.sections.find(s => s.no === 12);
    const row = (key: string) => sec?.rows.find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { sec, row };
}

describe('คานดาดฟ้า_RoofBeam (sheet 31)', () => {
    it('Excel sample rows 8–9: every computed cell', () => {
        const [r8, r9] = roofBeam.defaults().rows.map(roofBeamRow);
        expect(r8).toMatchObject({ mainLength: 150, stirrupCount: 167, stirrupPerimeter: 1, stirrupLength: 167, props: 42 });
        expect(r8?.mainKg).toBeCloseTo(133.2, 9);
        expect(r8?.stirrupKg).toBeCloseTo(37.074, 9);
        expect(r8?.formworkExcel).toBeCloseTo(15.2, 9);   // Excel T8 = (2·D·E)+C
        expect(r8?.concrete).toBeCloseTo(1.5, 9);
        expect(r9).toMatchObject({ mainLength: 54, stirrupCount: 60, stirrupPerimeter: 1, stirrupLength: 60, props: 15 });
        expect(r9?.mainKg).toBeCloseTo(47.952, 9);
        expect(r9?.stirrupKg).toBeCloseTo(13.32, 9);
        expect(r9?.formworkExcel).toBeCloseTo(5.6, 9);
        expect(r9?.concrete).toBeCloseTo(0.54, 9);
    });

    it('Excel sample row 6 totals (G6..P6, S6, T6, V6)', () => {
        const t = roofBeamTotals(roofBeam.defaults());
        expect(t.main.DB12).toBeCloseTo(181.152, 9);                 // I6
        expect(t.main.RB6 + t.main.RB9 + t.main.DB16 + t.main.DB20).toBe(0);
        expect(t.stirrup.RB6).toBeCloseTo(50.394, 9);                // L6
        expect(t.stirrup.RB9 + t.stirrup.DB12 + t.stirrup.DB16 + t.stirrup.DB20).toBe(0);
        expect(t.props).toBe(57);                                     // S6
        expect(t.formworkExcel).toBeCloseTo(20.8, 9);                 // T6 (Excel formula)
        expect(t.concrete).toBeCloseTo(2.04, 9);                      // V6
    });

    it('formwork = 2·D·E + C·E (soffit), not Excel 2·D·E + C (D1): 20 + 7.2 = 27.2 m²', () => {
        const [r8, r9] = roofBeam.defaults().rows.map(roofBeamRow);
        expect(r8?.formwork).toBeCloseTo(20, 9);
        expect(r9?.formwork).toBeCloseTo(7.2, 9);
        expect(roofBeam.compute(roofBeam.defaults(), ctx).formwork).toBeCloseTo(27.2, 9);
    });

    it('standard outputs', () => {
        const out = roofBeam.compute(roofBeam.defaults(), ctx);
        expect(out.props).toBe(g.R119.E);
        expect(out.concrete).toBeCloseTo(g.R124.E, 9);
        expect(out['rebar.RB6']).toBeCloseTo(g.R116.E, 9);
        expect(out['rebar.DB12']).toBeCloseTo(g.R117.E, 9);
        expect(out['rebar.RB9']).toBe(0);
        expect(out['rebar.DB16']).toBe(0);
        expect(out['rebar.DB20']).toBe(0);
    });

    it('feeds BOQ section 12 (งานคานดาดฟ้า): props, concrete and rebar kg as Excel; formwork fixed', () => {
        const { row } = section12();
        expect(row('R119')?.qty).toBe(g.R119.E);
        expect(row('R119')?.total).toBeCloseTo(g.R119.M, 6);
        expect(row('R124')?.qty).toBeCloseTo(g.R124.E, 9);
        expect(row('R124')?.grossQty).toBeCloseTo(g.R124.H, 9);       // Excel row 124 is not rounded up
        expect(row('R124')?.total).toBeCloseTo(g.R124.M, 6);
        expect(row('R121')?.qty).toBeCloseTo(27.2, 9);
        expect(row('R122')?.qty).toBeCloseTo(0.6 * 27.2, 9);
        expect(row('R123')?.qty).toBeCloseTo(0.25 * 27.2, 9);
        // Rebar comes from the slot with per-size waste (RB6 6 %, DB12 12 %; Excel had them swapped).
        const rb6 = row('roof-beam:rebar:RB6'), db12 = row('roof-beam:rebar:DB12'), wire = row('roof-beam:rebar:tie-wire');
        expect(row('R116')).toBeUndefined();
        expect(rb6?.qty).toBeCloseTo(g.R116.E, 9);
        expect(rb6?.waste).toBe(0.06);
        expect(db12?.qty).toBeCloseTo(g.R117.E, 9);
        expect(db12?.waste).toBe(0.12);
        expect(wire?.grossQty).toBeCloseTo((50.394 * 1.06 + 181.152 * 1.12) * 0.03, 9);
    });

    it('section 12 = Excel + formwork fix 3,984 + rebar waste fix 207.90522', () => {
        // Formwork: +6.4 m² × (250 + 150) + 0.6·6.4 ลบ.ฟ. × 350 + 0.25·6.4 กก. × 50 = 2,560 + 1,344 + 80.
        const formworkDelta = 6.4 * 400 + 0.6 * 6.4 * 350 + 0.25 * 6.4 * 50;
        // Rebar: material is on gross kg; labour (net kg) is unchanged.
        const grossExcel = 50.394 * 1.12 + 181.152 * 1.06;
        const grossApp = 50.394 * 1.06 + 181.152 * 1.12;
        const rebarDelta = (grossApp - grossExcel) * 25 + (grossApp - grossExcel) * 0.03 * 50;
        expect(formworkDelta).toBeCloseTo(3984, 9);
        expect(rebarDelta).toBeCloseTo(207.90522, 9);
        expect(section12().sec?.total).toBeCloseTo(golden.sections['12'].M + formworkDelta + rebarDelta, 2);
        // With the roof slab linked too (it reproduces Excel exactly): KNOWN_DELTAS[12] = +4,191.90522.
        const both = computeProject(createProject(), [roofBeam, roofSlab]).boq.sections.find(s => s.no === 12);
        expect(both?.total).toBeCloseTo(golden.sections['12'].M + 4191.90522, 2);
    });

    it('every row counts (Excel S6/T6/V6 stop at row 17), and added rows are summed', () => {
        const input = roofBeam.defaults();
        const extra: RoofBeamRow = {
            name: 'B6', width: 0.2, depth: 0.4, length: 6, mainSize: 'DB16', mainCount: 4, stirrupSize: 'RB9', stirrupSpacing: 0.2,
        };
        input.rows.push(...Array.from({ length: 10 }, () => extra));   // rows 3–12 → beyond Excel row 17
        const out = roofBeam.compute(input, ctx);
        // per extra row: props ROUNDUP(6/0.6) = 10; formwork 2·0.4·6 + 0.2·6 = 6; concrete 0.48;
        // main 4 × 6 = 24 m × 1.58 = 37.92 kg DB16; stirrups ROUNDUP(6/0.2) = 30 × 2(0.6) = 36 m × 0.499 = 17.964 kg RB9
        expect(out.props).toBe(57 + 100);
        expect(out.formwork).toBeCloseTo(27.2 + 60, 9);
        expect(out.concrete).toBeCloseTo(2.04 + 4.8, 9);
        expect(out['rebar.DB16']).toBeCloseTo(379.2, 9);
        expect(out['rebar.RB9']).toBeCloseTo(179.64, 9);
        expect(out['rebar.DB12']).toBeCloseTo(181.152, 9);
        const slot = roofBeam.boqSlots?.(input, ctx).rebar ?? [];
        expect(slot.map(r => r.key)).toEqual(['RB6', 'RB9', 'DB12', 'DB16', 'tie-wire']);
    });

    it('no stirrup spacing → จำนวนปลอก "_" and 0 kg; unknown bar size weighs 0', () => {
        const r = roofBeamRow({
            name: 'B1', width: 0.2, depth: 0.3, length: 4, mainSize: '', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0,
        });
        expect(r.stirrupCount).toBeNull();
        expect(r.stirrupLength).toBeNull();
        expect(r.stirrupKg).toBe(0);
        expect(r.mainLength).toBe(24);
        expect(r.mainKg).toBe(0);
        expect(r.props).toBe(7);   // ROUNDUP(4/0.6) = ROUNDUP(6.67)
    });

    it('links', () => {
        expect(roofBeam.boqLinks).toEqual([
            { line: 'R119', field: 'qty', output: 'props' },
            { line: 'R121', field: 'qty', output: 'formwork' },
            { line: 'R124', field: 'qty', output: 'concrete' },
        ]);
    });
});
