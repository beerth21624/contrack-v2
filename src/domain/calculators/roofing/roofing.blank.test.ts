import { describe, expect, it } from 'vitest';
import { roofing, ROOFING_BOQ_ROWS, withRoofSlope } from '.';

const ctx = { outputs: () => undefined };
const blankInput = () => roofing.blank?.() ?? roofing.defaults();

describe('มุงหลังคา blank project', () => {
    it('empties roof size, pitch and typed lengths; keeps items, factors, units and links', () => {
        const sample = roofing.defaults();
        const blank = blankInput();
        expect(blank.planArea).toBe(0);
        expect(blank.slopeDeg).toBe(0);
        expect(blank.rows).toHaveLength(ROOFING_BOQ_ROWS);
        blank.rows.forEach((r, i) => {
            const s = sample.rows[i];
            expect(r.key).toBe(s?.key);
            expect(r.item).toBe(s?.item);
            expect(r.factor).toBe(s?.factor);
            expect(r.factorUnit).toBe(s?.factorUnit);
            expect(r.takeoffUnit).toBe(s?.takeoffUnit);
            expect(r.unit).toBe(s?.unit);
            expect(r.takeoff.kind).toBe(s?.takeoff.kind);
            if (r.takeoff.kind === 'lengths' || r.takeoff.kind === 'rake') expect(r.takeoff.lengths).toEqual([]);
            if (r.takeoff.kind === 'rake') expect(r.takeoff.deg).toBe(blank.slopeDeg);
            if (r.takeoff.kind === 'row' && s?.takeoff.kind === 'row') expect(r.takeoff.ref).toBe(s.takeoff.ref);
        });
        // defaults() unchanged
        expect(sample.planArea).toBe(113);
        expect(sample.slopeDeg).toBe(40);
    });

    it('computes finite zeros for every output (BOQ 162–176, fascia length for paint)', () => {
        const out = roofing.compute(blankInput(), ctx);
        for (const [k, v] of Object.entries(out)) {
            expect(Number.isFinite(v), k).toBe(true);
            expect(v, k).toBe(0);
        }
        for (const link of roofing.boqLinks) expect(out[link.output], link.line).toBe(0);
        expect(out.fasciaLength).toBe(0);
    });

    it('withRoofSlope: the rake pitch follows the roof pitch while they were equal, a different one stays', () => {
        const rakeDeg = (i: { rows: { takeoff: { kind: string; deg?: number } }[] }) =>
            i.rows.find(r => r.takeoff.kind === 'rake')?.takeoff.deg;
        const blank = withRoofSlope(blankInput(), 35);
        expect(blank.slopeDeg).toBe(35);
        expect(rakeDeg(blank)).toBe(35);
        const sample = withRoofSlope(roofing.defaults(), 30);
        expect(rakeDeg(sample)).toBe(30);
        const typed = roofing.defaults();
        typed.rows = typed.rows.map(r => (r.takeoff.kind === 'rake' ? { ...r, takeoff: { ...r.takeoff, deg: 45 } } : r));
        expect(rakeDeg(withRoofSlope(typed, 30))).toBe(45);
        // calculation unchanged: the rake row still uses its own pitch
        expect(roofing.compute(withRoofSlope(roofing.defaults(), 40), ctx)).toEqual(roofing.compute(roofing.defaults(), ctx));
    });

    it('typing only the roof size fills the area-based rows (tiles, foil, roofing labour)', () => {
        const out = roofing.compute({ ...blankInput(), planArea: 100, slopeDeg: 30 }, ctx);
        const k7 = 100 / Math.cos(Math.PI / 6);
        expect(out.slopeArea).toBeCloseTo(k7, 9);
        expect(out.R162).toBe(Math.ceil(k7 * 11));
        expect(out.R174).toBe(Math.ceil(k7 / 75));
        expect(out.R175).toBeCloseTo(k7, 9);
        expect(out.R163).toBe(0);
    });
});
