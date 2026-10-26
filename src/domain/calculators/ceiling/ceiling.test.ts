import { describe, expect, it } from 'vitest';
import { ceiling, ceilingRowArea, setCeilingCode, CEILING_DEFAULT_PAINT, type CeilingInput, type CeilingRow } from '.';
import golden from '../../boq/__tests__/golden.v5.json';

const ctx = { outputs: () => undefined };

describe('ฝ้าเพดาน_Ceiling (sheet 15)', () => {
    it('Excel sample: F5…F21', () => {
        const areas = ceiling.defaults().rows.map(ceilingRowArea);
        const expected = [
            9, 9, 15, 2.4, 1.8, 12.25, 1.8, 12, 9, 6.9, 3.6,
            4.568925513, 5.221629157,   // F16:F17 = (D*E)/COS(RADIANS(40))
            37.38, 1, 14, 4.5,
        ];
        expect(areas).toHaveLength(expected.length);
        areas.forEach((a, i) => expect(a).toBeCloseTo(expected[i] ?? NaN, 9));
    });

    it('outputs E199–E202 = golden BOQ', () => {
        const out = ceiling.compute(ceiling.defaults(), ctx);
        expect(out.R199).toBeCloseTo(golden.lines.R199.E, 9);
        expect(out.R200).toBeCloseTo(golden.lines.R200.E, 9);
        expect(out.R201).toBeCloseTo(golden.lines.R201.E, 9);
        expect(out.R202).toBeCloseTo(golden.lines.R202.E, 9);
        expect([out.C1, out.C2, out.C3, out.C4]).toEqual([out.R199, out.R200, out.R201, out.R202]);
    });

    it('paint-group totals for the paint sheet (C7/C8/C9)', () => {
        const out = ceiling.compute(ceiling.defaults(), ctx);
        expect(out['paint.ภายนอก']).toBeCloseTo(37.38, 9);
        expect(out['paint.ภายใน']).toBeCloseTo(92.54055467, 8);
        expect(out['paint.ไม้ระแนง']).toBeCloseTo(19.5, 9);
        expect(out.total).toBeCloseTo(37.38 + 92.54055467 + 19.5, 8);
    });

    it('added rows count by code and paint group; slope is per row; blank rows are 0', () => {
        const input: CeilingInput = ceiling.defaults();
        input.rows.push({ code: 'C3', width: 2, length: 5, location: 'โรงรถ', paint: 'ภายนอก' });
        input.rows.push({ code: 'C1', width: 2, length: 3, location: 'ห้องเก็บของ', paint: 'ภายใน', slope: 60 }); // 6 / cos 60° = 12
        input.rows.push({ code: '', width: 0, length: 0, location: '', paint: '' });
        input.rows.push({ code: 'C4', width: 1, length: 2, location: '', paint: '' });           // no paint flag
        const out = ceiling.compute(input, ctx);
        expect(out.R201).toBeCloseTo(37.38 + 10, 9);
        expect(out.R199).toBeCloseTo(72.25 + 12, 9);
        expect(out.R202).toBeCloseTo(19.5 + 2, 9);
        expect(out['paint.ภายนอก']).toBeCloseTo(37.38 + 10, 9);
        expect(out['paint.ภายใน']).toBeCloseTo(92.54055467 + 12, 8);
        expect(out['paint.ไม้ระแนง']).toBeCloseTo(19.5, 9);
    });

    it('setting a sloped row to 0° makes it flat (D×E); changing a code moves its area', () => {
        const input = ceiling.defaults();
        input.rows = input.rows.map((r, i): CeilingRow => {
            if (i === 11) return { ...r, slope: 0 };   // เฉลียง 1: 1 × 3.5
            if (i === 0) return { ...r, code: 'C2' };  // ทานอาหาร 9 m² C1 → C2
            return r;
        });
        const out = ceiling.compute(input, ctx);
        expect(out.R199).toBeCloseTo(72.25 - 9, 9);
        expect(out.R200).toBeCloseTo(20.29055467 - 4.568925513 + 3.5 + 9, 8);
        expect(ceilingRowArea({ code: 'C1', width: 1, length: 1, location: '', paint: '', slope: 90 })).toBe(0);
    });

    it('blank(): no rooms; every output finite, BOQ lines and paint totals 0', () => {
        const input = ceiling.blank?.();
        expect(input).toEqual({ rows: [] });
        if (!input) return;
        const out = ceiling.compute(input, ctx);
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
        for (const l of ceiling.boqLinks) expect(out[l.output], l.line).toBe(0);
        for (const k of ['paint.ภายนอก', 'paint.ภายใน', 'paint.ไม้ระแนง']) expect(out[k], k).toBe(0);
    });

    it('setCeilingCode: paint group follows the type until the user picks another one', () => {
        const empty: CeilingRow = { code: '', width: 3, length: 4, location: 'ห้องนอน', paint: '' };
        const c1 = setCeilingCode(empty, 'C1');
        expect(c1).toEqual({ ...empty, code: 'C1', paint: 'ภายใน' });
        expect(setCeilingCode(c1, 'C3').paint).toBe('ภายนอก');             // still the usual group → follows
        expect(setCeilingCode(c1, 'C4').paint).toBe('ไม้ระแนง');
        const custom: CeilingRow = { ...c1, paint: 'ภายนอก' };               // user's own choice → kept
        expect(setCeilingCode(custom, 'C2').paint).toBe('ภายนอก');
        expect(setCeilingCode(c1, '').paint).toBe('ภายใน');
        for (const r of ceiling.defaults().rows) {
            if (r.code !== '') expect(CEILING_DEFAULT_PAINT[r.code], r.location).toBe(r.paint);   // matches the sample
        }
    });
});
