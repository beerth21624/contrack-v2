import { describe, expect, it } from 'vitest';
import golden from '../../boq/__tests__/golden.v5.json';
import { computeProject, createProject } from '../../project';
import { footing, type FootingRow } from '../footing';
import {
    footingBackfillKey, footingRefFor, newPedestalRow, pedestal, pedestalRow, pedestalsForFootings, remapPedestalFootings,
    type PedestalRow,
} from '.';

const goldenLines = golden.lines as Record<string, { E?: number; H?: number }>;
const goldenSections = golden.sections as Record<string, { M: number }>;

function first<T>(rows: T[]): T {
    const [row] = rows;
    if (row === undefined) throw new Error('empty table');
    return row;
}

const noCtx = { outputs: () => undefined };
/** Context with the footing sheet computed from the given input. */
const withFooting = (rows: FootingRow[]) => {
    const fo = footing.compute({ rows }, noCtx);
    return { outputs: (id: string) => (id === 'footing' ? fo : undefined) };
};

const F2: FootingRow = {
    name: 'F2', count: 4, width: 1.0, length: 1.2, depth: 0.5,
    excavationDepth: 1.2, sandThickness: 0.05, leanThickness: 0.05,
    shortBarSize: 'DB16', shortBarCount: 6, longBarSize: 'DB16', longBarCount: 7,
    ringBarSize: 'RB9', ringBarCount: 2,
};
const P2: PedestalRow = {
    name: 'C2', footing: 1, count: 4, width: 0.3, length: 0.3, height: 0.8,
    mainBarSize: 'DB16', mainBarCount: 8, stirrupSize: 'RB9', stirrupSpacing: 0.15,
};

describe('เสาตอม่อ_Footing Column (sheet 26)', () => {
    const footingRows = footing.defaults().rows;
    const ctx = withFooting(footingRows);
    const input = pedestal.defaults();
    const out = pedestal.compute(input, ctx);

    it('Excel sample row 8: every computed cell', () => {
        const r = pedestalRow(first(input.rows), footingRefFor(ctx.outputs('footing'), 0));
        expect(r.mainLength).toBeCloseTo(1.4, 9);        // J8 = 0.6 + 0.6 + 0.6/3
        expect(r.mainTotal).toBeCloseTo(176.4, 9);       // K8
        expect(r.mainKg).toBeCloseTo(156.6432, 9);       // L8
        expect(r.stirrupCount).toBe(8);                  // O8 = ROUNDUP(1.2/0.15)
        expect(r.stirrupLength).toBeCloseTo(0.9, 9);     // P8
        expect(r.stirrupTotal).toBeCloseTo(151.2, 9);    // Q8
        expect(r.stirrupKg).toBeCloseTo(33.5664, 9);     // R8
        expect(r.formwork).toBeCloseTo(11.34, 9);        // T8
        expect(r.concrete).toBeCloseTo(0.63, 9);         // V8
    });

    it('Excel totals row 6 and sheet 24 row 7', () => {
        expect(out['main.DB12']).toBeCloseTo(156.6432, 9);     // J6
        expect(out['stirrup.RB6']).toBeCloseTo(33.5664, 9);    // M6
        expect(out['rebar.RB6']).toBeCloseTo(33.5664, 9);
        expect(out['rebar.DB12']).toBeCloseTo(156.6432, 9);
        expect(out['rebar.RB9']).toBe(0);
        expect(out.formwork).toBeCloseTo(11.34, 9);            // T6
        expect(out.concrete).toBeCloseTo(0.63, 9);             // V6
        expect(out.backfill).toBeCloseTo(43.7115, 9);          // Footing!AI6
        expect(out[footingBackfillKey(0)]).toBeCloseTo(43.7115, 9); // Footing!AI8
    });

    it('linked outputs equal the BOQ (Home) quantities R62, R65, R68', () => {
        expect(pedestal.boqLinks).toEqual([
            { line: 'R62', field: 'qty', output: 'formwork' },
            { line: 'R65', field: 'qty', output: 'concrete' },
            { line: 'R68', field: 'qty', output: 'backfill' },
        ]);
        for (const l of pedestal.boqLinks) expect(out[l.output]).toBeCloseTo(goldenLines[l.line]?.E ?? NaN, 9);
    });

    it('rebar slot reproduces BOQ R47 RB6 / R48 DB12 / R49 tie wire in a project', () => {
        const rows = pedestal.boqSlots?.(input, ctx).rebar ?? [];
        expect(rows.map(r => r.key)).toEqual(['RB6', 'DB12', 'tie-wire']);
        const r = computeProject(createProject(), [footing, pedestal]);
        const s6 = r.boq.sections.find(s => s.no === 6)?.rows ?? [];
        const rb6 = s6.find(row => row.key === 'pedestal:rebar:RB6');
        const wire = s6.find(row => row.key === 'pedestal:rebar:tie-wire');
        expect(rb6?.type === 'item' ? rb6.qty : null).toBeCloseTo(goldenLines.R47?.E ?? NaN, 9);
        expect(wire?.type === 'item' ? wire.grossQty : null).toBeCloseTo(goldenLines.R49?.H ?? NaN, 6);
        expect(r.boq.sections.find(s => s.no === 7)?.total).toBeCloseTo(goldenSections['7']?.M ?? NaN, 2);
    });

    it('a pedestal on another footing type uses that footing (D13) and its own thickness for stirrups (D1)', () => {
        const c = withFooting([...footingRows, F2]);
        const r = pedestalRow(P2, footingRefFor(c.outputs('footing'), 1));
        expect(r.mainLength).toBeCloseTo(0.8 + 0.5 + 1.0 / 3, 9);
        expect(r.mainKg).toBeCloseTo(4 * (0.8 + 0.5 + 1 / 3) * 8 * 1.58, 9);
        // own footing: ROUNDUP((0.5 + 0.8)/0.15) = 9 (Excel's $F$8 would give ROUNDUP(1.4/0.15) = 10)
        expect(r.stirrupCount).toBe(9);
        expect(r.stirrupTotal).toBeCloseTo(4 * 9 * 1.2, 9);
        expect(r.stirrupKg).toBeCloseTo(43.2 * 0.499, 9);
        expect(r.formwork).toBeCloseTo(3.84, 9);
        expect(r.concrete).toBeCloseTo(0.288, 9);

        const o = pedestal.compute({ rows: [...input.rows, P2] }, c);
        const gross2 = 17.28 - 0.9 - 0.72 - 2.4;
        expect(o[footingBackfillKey(0)]).toBeCloseTo(43.7115, 9);
        expect(o[footingBackfillKey(1)]).toBeCloseTo(gross2 - 0.288, 9);
        expect(o.backfill).toBeCloseTo(43.7115 + gross2 - 0.288, 9);
        expect(o['rebar.RB9']).toBeCloseTo(43.2 * 0.499, 9);
        expect(o['rebar.DB16']).toBeCloseTo(r.mainKg, 9);
    });

    it('no spacing gives "-" stirrups (0 kg); a missing footing row reads as 0', () => {
        const r = pedestalRow({ ...P2, stirrupSpacing: 0 }, footingRefFor(ctx.outputs('footing'), 5));
        expect(r.stirrupCount).toBeNull();
        expect(r.stirrupTotal).toBeNull();
        expect(r.stirrupKg).toBe(0);
        expect(r.mainLength).toBeCloseTo(0.8, 9);
        // the pedestal still comes off the total backfill (Excel subtracts every pedestal row)
        const o = pedestal.compute({ rows: [...input.rows, { ...P2, footing: 5 }] }, ctx);
        expect(o.backfill).toBeCloseTo(43.7115 - 0.288, 9);
        expect(o[footingBackfillKey(0)]).toBeCloseTo(43.7115, 9);
    });

    it('deleting a footing row keeps each pedestal on its own footing (−1 when that footing is gone)', () => {
        const fRows = [...footingRows, F2, { ...F2, name: 'F4' }];
        const peds = { rows: [first(input.rows), { ...P2, footing: 1 }, { ...P2, footing: 2 }] };
        // delete footing row 2 (F2): the pedestal on F4 moves from index 2 to 1, the one on F2 loses its footing
        const after = [fRows[0], fRows[2]].filter((f): f is FootingRow => f !== undefined);
        const next = remapPedestalFootings(peds, fRows, after);
        expect(next?.rows.map(r => r.footing)).toEqual([0, -1, 1]);
        // editing (same length) or a pedestal set that does not move → no change
        expect(remapPedestalFootings(peds, fRows, fRows.map(f => ({ ...f })))).toBeUndefined();
        expect(remapPedestalFootings({ rows: [first(input.rows)] }, fRows, after)).toBeUndefined();
    });

    it('without the footing sheet it supplies no backfill (BOQ R68 keeps its value)', () => {
        expect(pedestal.compute(input, noCtx).backfill).toBeUndefined();
    });
});

describe('เสาตอม่อ_Footing Column — blank project (guided journey)', () => {
    it('blank() has no pedestals; with blank footings every output is finite and every linked output 0', () => {
        const blank = pedestal.blank?.();
        expect(blank).toEqual({ rows: [] });
        if (!blank) return;
        const c = withFooting([]);
        const o = pedestal.compute(blank, c);
        expect(Object.values(o).every(Number.isFinite)).toBe(true);
        for (const l of pedestal.boqLinks) expect(o[l.output], l.output).toBe(0);
        expect(pedestal.boqSlots?.(blank, c)).toEqual({ rebar: [] });
    });

    it('pedestals left over after the footings were emptied still compute finite numbers', () => {
        const o = pedestal.compute(pedestal.defaults(), withFooting([]));
        expect(Object.values(o).every(Number.isFinite)).toBe(true);
        expect(o.concrete).toBeCloseTo(0.63, 9);
        // Nothing dug: Excel would give −0.63; backfill is clamped at 0 (D1). The journey page asks for footings first.
        expect(o.backfill).toBe(0);
    });

    it('a pedestal added in the journey sits on the next free footing, takes its count and standard bars', () => {
        const footings: FootingRow[] = [...footing.defaults().rows, F2];
        const a = newPedestalRow([], footings);
        expect(a).toEqual({
            name: 'C1', footing: 0, count: 21, width: 0, length: 0, height: 0,
            mainBarSize: 'DB12', mainBarCount: 0, stirrupSize: 'RB6', stirrupSpacing: 0.15,
        });
        const b = newPedestalRow([a], footings);
        expect([b.name, b.footing, b.count]).toEqual(['C2', 1, 4]);
        // every footing has a pedestal → the first footing again
        expect(newPedestalRow([a, b], footings).footing).toBe(0);
        expect(pedestalsForFootings(footings).map(p => [p.name, p.footing, p.count])).toEqual([['C1', 0, 21], ['C2', 1, 4]]);
        expect(pedestalsForFootings([])).toEqual([]);
        // until the sizes are typed it adds nothing
        const o = pedestal.compute({ rows: [a, b] }, withFooting(footings));
        expect(o.concrete).toBe(0);
        expect(o.formwork).toBe(0);
        expect(o['rebar.DB12']).toBe(0);
    });
});
