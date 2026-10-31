import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type Project } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import type { CalcContext } from '../types';
import { electricalPipe, type Circuit } from '../electrical-pipe';
import {
    BLANK_WIRING, CONDUCTOR_COUNTS, KIND_WIRING, WIRE_BUCKETS, WIRE_SIZES, cableRows, circuitsToSuggest, electricalCable,
    fillSuggestedWiring, isBlankWiring, sizeKey, suggestWiring, type CircuitWiring, type ElectricalCableInput, type WireSize,
} from '.';

// QA edge tests for "electrical-cable" (sheet 09 → BOQ section 18, R193…R196).
// Per circuit: size bucket gets  G × F  (main run, if D = that size)  +  H × F  (device run, if E = that size),
// G = Pipe E + G, H = Pipe F + H, F = number of conductors. R19x: H = 1.15 × E, J = I × H, L = K × H
// (THW 1.5 15/7, THW 2.5 20/10, THW 4 30/15); R196 = 15 % × Σ(J + L) (spec 05 §5).

const circ = (id: string, mainH: number, deviceH: number, mainV: number, deviceV: number, extra: Partial<Circuit> = {}): Circuit =>
    ({ id, name: id, breaker: '20A.', pipeType: 'PVC 1/2"', mainH, deviceH, mainV, deviceV, ...extra });
const w = (mainSize: string, deviceSize: string, conductors: number): CircuitWiring => ({ mainSize, deviceSize, conductors });
const ctxFor = (circuits: Circuit[]): CalcContext => {
    const out = electricalPipe.compute({ circuits }, { outputs: () => undefined });
    return { outputs: id => (id === 'electrical-pipe' ? out : undefined) };
};
const compute = (circuits: Circuit[], wiring: Record<string, CircuitWiring>) =>
    electricalCable.compute({ wiring }, ctxFor(circuits));
const bad = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

function project(circuits: Circuit[] | undefined, wiring: Record<string, CircuitWiring> | undefined, mutate?: (p: Project) => void) {
    const p = createProject('blank');
    if (circuits) p.calculators['electrical-pipe'] = { circuits };
    if (wiring) p.calculators['electrical-cable'] = { wiring };
    mutate?.(p);
    const res = computeProject(p);
    const row = (key: string) => res.boq.sections.flatMap(s => s.rows).find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { res, row };
}

/** [size, BOQ line, I, K] of the sizes that have a BOQ row. */
const PRICED: [WireSize, string, number, number][] = [['THW 1.5', 'R193', 15, 7], ['THW 2.5', 'R194', 20, 10], ['THW 4', 'R195', 30, 15]];

describe('electrical-cable edge — blank and dependencies', () => {
    it('blank(): no wiring; with no circuits every output is finite 0', () => {
        expect(electricalCable.blank?.()).toEqual({ wiring: {} });
        const out = compute([], {});
        expect(Object.values(out).every(v => v === 0)).toBe(true);
        expect(Object.keys(out).sort()).toEqual(
            ['R193', 'R194', 'R195', 'circuit.count', 'size|THW 1.5', 'size|THW 2.5', 'size|THW 4', 'size|THW 6', 'unassigned'].sort());
    });

    it('conduit sheet not computed yet (ctx has no outputs): 0 circuits, 0 metres', () => {
        const out = electricalCable.compute({ wiring: { a: w('THW 4', 'THW 4', 3) } }, { outputs: () => undefined });
        expect(out['circuit.count']).toBe(0);
        expect(out.R195).toBe(0);
        expect(cableRows({ wiring: {} }, { outputs: () => undefined })).toEqual([]);
    });

    it('blank project: R193…R196 are 0', () => {
        const { row } = project(undefined, undefined);
        for (const k of ['R193', 'R194', 'R195', 'R196']) expect(row(k)?.total, k).toBe(0);
    });

    it('declares its dependency, section and links', () => {
        expect(electricalCable.deps).toEqual(['electrical-pipe']);
        expect(electricalCable.sections).toEqual([18]);
        expect(electricalCable.boqLinks).toEqual([
            { line: 'R193', field: 'qty', output: 'R193' },
            { line: 'R194', field: 'qty', output: 'R194' },
            { line: 'R195', field: 'qty', output: 'R195' },
        ]);
    });

    it('dropdown lists as in Excel', () => {
        expect([...WIRE_SIZES]).toEqual(['THW 1.5', 'THW 2.5', 'THW 4', 'THW 6']);
        expect([...CONDUCTOR_COUNTS]).toEqual([2, 3]);
        expect(WIRE_BUCKETS.map(b => [b.size, b.column, b.line])).toEqual([
            ['THW 1.5', 'I', 'R193'], ['THW 2.5', 'J', 'R194'], ['THW 4', 'K', 'R195'], ['THW 6', 'L', undefined],
        ]);
        expect(BLANK_WIRING).toEqual({ mainSize: '', deviceSize: '', conductors: 0 });
        expect(sizeKey('THW 4')).toBe('size|THW 4');
    });
});

describe('electrical-cable edge — every wire size × conductor count', () => {
    // one circuit: main run 10 m (mainH 8 + mainV 2), device run 5 m (deviceH 3 + deviceV 2)
    const one = [circ('a', 8, 3, 2, 2)];

    it.each(WIRE_SIZES.flatMap(s => CONDUCTOR_COUNTS.map(f => [s, f] as const)))('main size %s × %i conductors → 10 × F in that bucket only', (size, f) => {
        const out = compute(one, { a: w(size, '', f) });
        for (const s of WIRE_SIZES) expect(out[sizeKey(s)], s).toBe(s === size ? 10 * f : 0);
        expect(out.unassigned).toBe(5);     // device run has no size
    });

    it.each(WIRE_SIZES.flatMap(s => CONDUCTOR_COUNTS.map(f => [s, f] as const)))('device size %s × %i conductors → 5 × F in that bucket only', (size, f) => {
        const out = compute(one, { a: w('', size, f) });
        for (const s of WIRE_SIZES) expect(out[sizeKey(s)], s).toBe(s === size ? 5 * f : 0);
        expect(out.unassigned).toBe(10);
    });

    it('same size on main and device: both runs add up (15 × F)', () => {
        const out = compute(one, { a: w('THW 4', 'THW 4', 3) });
        expect(out[sizeKey('THW 4')]).toBe(45);
        expect(out.unassigned).toBe(0);
    });

    it('different sizes on main and device go to different buckets', () => {
        const out = compute(one, { a: w('THW 4', 'THW 1.5', 2) });
        expect(out[sizeKey('THW 4')]).toBe(20);
        expect(out[sizeKey('THW 1.5')]).toBe(10);
        expect(out.R195).toBe(20);
        expect(out.R193).toBe(10);
    });

    it.each(PRICED)('%s: BOQ %s E = 20 (10 m × 2), H = 23, J = I×H, L = K×H', (size, line, i, k) => {
        const { row } = project(one, { a: w(size, '', 2) });
        const r = row(line);
        expect(r?.qty).toBe(20);
        expect(r?.grossQty).toBeCloseTo(23, 12);
        expect(r?.matTotal).toBeCloseTo(i * 23, 9);
        expect(r?.labTotal).toBeCloseTo(k * 23, 9);
        expect(r?.total).toBeCloseTo((i + k) * 23, 9);
        // the other priced lines stay empty
        for (const [, other] of PRICED) if (other !== line) expect(row(other)?.qty, other).toBe(0);
    });

    it('THW 6 has no BOQ row (D7): counted in its own output, nowhere in the BOQ', () => {
        const { res, row } = project(one, { a: w('THW 6', '', 3) });
        expect(res.calcOutputs['electrical-cable']?.[sizeKey('THW 6')]).toBe(30);
        for (const k of ['R193', 'R194', 'R195']) expect(row(k)?.qty).toBe(0);
        expect(row('R196')?.total).toBe(0);
    });

    it('consumables R196 = 15 % × Σ(J + L): THW 4 only, 20 m → 0.15 × (690 + 345) = 155.25', () => {
        const { row } = project(one, { a: w('THW 4', '', 2) });
        expect(row('R195')?.matTotal).toBeCloseTo(690, 9);
        expect(row('R195')?.labTotal).toBeCloseTo(345, 9);
        expect(row('R196')?.total).toBeCloseTo(155.25, 9);
    });

    it('consumables with all three sizes: 20 m each → 0.15 × (345+161 + 460+230 + 690+345) = 0.15 × 2231 = 334.65', () => {
        const circuits = [circ('a', 10, 0, 0, 0), circ('b', 10, 0, 0, 0), circ('d', 10, 0, 0, 0)];
        const { row } = project(circuits, { a: w('THW 1.5', '', 2), b: w('THW 2.5', '', 2), d: w('THW 4', '', 2) });
        expect(row('R193')?.total).toBeCloseTo(506, 9);
        expect(row('R194')?.total).toBeCloseTo(690, 9);
        expect(row('R195')?.total).toBeCloseTo(1035, 9);
        expect(row('R196')?.total).toBeCloseTo(334.65, 9);
    });
});

describe('electrical-cable edge — decision table: size × conductors (D8)', () => {
    const one = [circ('a', 8, 3, 2, 2)];   // main 10, device 5

    it('blank wiring (no entry for the circuit) counts nothing, all 15 m unassigned', () => {
        const out = compute(one, {});
        expect((out.R193 ?? 0) + (out.R194 ?? 0) + (out.R195 ?? 0) + (out[sizeKey('THW 6')] ?? 0)).toBe(0);
        expect(out.unassigned).toBe(15);
    });

    it('conductors 0 with sizes chosen: nothing counted, everything unassigned', () => {
        const out = compute(one, { a: w('THW 4', 'THW 2.5', 0) });
        expect(out.R195).toBe(0);
        expect(out.R194).toBe(0);
        expect(out.unassigned).toBe(15);
    });

    it('conductors chosen, no sizes: nothing counted, unassigned 15', () => {
        const out = compute(one, { a: w('', '', 3) });
        expect((out.R195 ?? 0) + (out.R194 ?? 0) + (out.R193 ?? 0)).toBe(0);
        expect(out.unassigned).toBe(15);
    });

    it('unknown size text is unassigned, not guessed (THW 10, lower-case, other spelling)', () => {
        for (const s of ['THW 10', 'thw 4', 'THW4', 'THW  4', 'THW 4.0']) {
            const out = compute(one, { a: w(s, '', 3) });
            expect(out.R195, s).toBe(0);
            expect(out.unassigned, s).toBe(15);
        }
    });

    it('size with stray spaces around it still counts (trimmed)', () => {
        const out = compute(one, { a: w(' THW 4 ', ' THW 2.5\t', 2) });
        expect(out.R195).toBe(20);
        expect(out.R194).toBe(10);
        expect(out.unassigned).toBe(0);
    });

    it('main sized but device not: device run stays unassigned', () => {
        expect(compute(one, { a: w('THW 4', '', 3) }).unassigned).toBe(5);
        expect(compute(one, { a: w('', 'THW 4', 3) }).unassigned).toBe(10);
    });

    it('a zero-length run needs no size to be fully assigned (unassigned counts metres)', () => {
        const out = compute([circ('a', 8, 0, 2, 0)], { a: w('THW 4', '', 3) });
        expect(out.unassigned).toBe(0);
        expect(out.R195).toBe(30);
    });

    it('decimal conductor count multiplies as is (2.5 × 10 m = 25)', () => {
        expect(compute(one, { a: w('THW 4', '', 2.5) }).R195).toBe(25);
    });

    it('negative conductor count gives a negative quantity, still finite', () => {
        const out = compute(one, { a: w('THW 4', '', -1) });
        expect(out.R195).toBe(-10);
        expect(Number.isFinite(out.unassigned)).toBe(true);
    });

    it.each(bad)('conductors %s counts as 0 (nothing counted, never NaN/Infinity)', f => {
        const out = compute(one, { a: w('THW 4', 'THW 4', f) });
        expect(out.R195).toBe(0);
        expect(out.unassigned).toBe(15);
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
    });

    it('wiring for a circuit that no longer exists is ignored', () => {
        const out = compute(one, { a: w('THW 4', '', 2), ghost: w('THW 4', 'THW 4', 3) });
        expect(out.R195).toBe(20);
        expect(out['circuit.count']).toBe(1);
    });
});

describe('electrical-cable edge — lengths, huge and bad values', () => {
    it('each conduit column reaches the cable: E, G → main; F, H → device', () => {
        const wiring = { a: w('THW 1.5', 'THW 2.5', 2) };
        expect(compute([circ('a', 3, 0, 0, 0)], wiring)).toMatchObject({ R193: 6, R194: 0 });
        expect(compute([circ('a', 0, 0, 3, 0)], wiring)).toMatchObject({ R193: 6, R194: 0 });
        expect(compute([circ('a', 0, 3, 0, 0)], wiring)).toMatchObject({ R193: 0, R194: 6 });
        expect(compute([circ('a', 0, 0, 0, 3)], wiring)).toMatchObject({ R193: 0, R194: 6 });
    });

    it('decimal lengths: 22.4 + 1.5 = 23.9 main, ×2 wires = 47.8', () => {
        const out = compute([circ('a', 22.4, 25.6, 1.5, 16.1)], { a: w('THW 2.5', 'THW 1.5', 2) });
        expect(out.R194).toBeCloseTo(47.8, 9);
        expect(out.R193).toBeCloseTo(83.4, 9);
    });

    it('negative conduit length flows to a negative cable length (finite)', () => {
        const out = compute([circ('a', -4, 0, 0, 0)], { a: w('THW 4', '', 2) });
        expect(out.R195).toBe(-8);
    });

    it('non-finite conduit lengths are 0 upstream, so the cable is finite', () => {
        for (const v of bad) {
            const out = compute([circ('a', v, v, v, v)], { a: w('THW 4', 'THW 4', 3) });
            expect(Object.values(out).every(Number.isFinite)).toBe(true);
            expect(out.R195).toBe(0);
        }
    });

    it('huge: 1e12 m × 3 wires stays finite and exact in the BOQ', () => {
        const { row } = project([circ('a', 1e12, 0, 0, 0)], { a: w('THW 4', '', 3) });
        expect(row('R195')?.qty).toBe(3e12);
        expect(Number.isFinite(row('R195')?.total)).toBe(true);
    });

    it('tiny: 0.001 m × 2', () => {
        expect(compute([circ('a', 0.001, 0, 0, 0)], { a: w('THW 4', '', 2) }).R195).toBeCloseTo(0.002, 15);
    });
});

describe('electrical-cable edge — table size, delete, order', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => circ(`c${i}`, 1, 0, 0, 0));
    const allThw4 = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, w('THW 4', '', 2)]));

    it('0 / 1 / 14 / 24 / 50 circuits', () => {
        for (const n of [0, 1, 14, 24, 50]) {
            const out = compute(many(n), allThw4(n));
            expect(out.R195, String(n)).toBe(2 * n);
            expect(out['circuit.count']).toBe(n);
        }
    });

    it('deleting a circuit in the conduit sheet removes its cable even though its wiring is still stored', () => {
        const wiring = allThw4(5);
        const out = compute(many(5).filter(x => x.id !== 'c2'), wiring);
        expect(out.R195).toBe(8);
        expect(out['circuit.count']).toBe(4);
    });

    it('circuit order does not matter', () => {
        const wiring = { a: w('THW 4', '', 2), b: w('THW 2.5', 'THW 1.5', 3) };
        const cs = [circ('a', 5, 0, 0, 0), circ('b', 2, 4, 1, 1)];
        expect(compute([...cs].reverse(), wiring)).toEqual(compute(cs, wiring));
    });

    it('cableRows: bySize adds up to G×F + H×F when both sizes are valid', () => {
        const rows = cableRows({ wiring: { a: w('THW 2.5', 'THW 1.5', 3) } }, ctxFor([circ('a', 4, 1, 1, 2)]));
        expect(rows).toHaveLength(1);
        const r = rows[0];
        expect(r?.main).toBe(5);
        expect(r?.device).toBe(3);
        expect(Object.values(r?.bySize ?? {}).reduce((s, v) => s + v, 0)).toBe(24);
        expect(r?.bySize['THW 2.5']).toBe(15);
        expect(r?.bySize['THW 1.5']).toBe(9);
        expect(r?.unassigned).toBe(0);
    });
});

describe('electrical-cable edge — pipe → cable through computeProject', () => {
    const circuits = [circ('a', 10, 2, 1.5, 4), circ('b', 6, 0, 0, 0)];
    const wiring = { a: w('THW 4', 'THW 2.5', 3), b: w('THW 2.5', '', 2) };

    it('cable follows the conduit lengths: a 11.5 m main × 3 = 34.5 THW 4; 6 m × 2 = 12 THW 2.5; 6 m device × 3 = 18', () => {
        const { res, row } = project(circuits, wiring);
        const out = res.calcOutputs['electrical-cable'];
        expect(out?.R195).toBeCloseTo(34.5, 9);
        expect(out?.R194).toBeCloseTo(18 + 12, 9);
        expect(out?.R193).toBe(0);
        expect(row('R195')?.qty).toBeCloseTo(34.5, 9);
        expect(row('R185')?.qty).toBeCloseTo(17.5 + 6, 9);
    });

    it('editing a conduit length (+2 m main of circuit a) adds 2 × 3 wires to the cable', () => {
        const edited = circuits.map(x => (x.id === 'a' ? { ...x, mainH: x.mainH + 2 } : x));
        const { res } = project(edited, wiring);
        expect(res.calcOutputs['electrical-cable']?.R195).toBeCloseTo(40.5, 9);
    });

    it('adding a circuit to the conduit sheet without wiring: cable unchanged, metres reported unassigned', () => {
        const { res } = project([...circuits, circ('n', 9, 0, 0, 0)], wiring);
        expect(res.calcOutputs['electrical-cable']?.R195).toBeCloseTo(34.5, 9);
        expect(res.calcOutputs['electrical-cable']?.unassigned).toBe(9);
    });

    it('conduit skipped: its lengths are 0, so the cable is 0 as well (and nothing is NaN)', () => {
        const { res, row } = project(circuits, wiring, p => { p.journey = { 'electrical-pipe': 'skipped' }; });
        const out = res.calcOutputs['electrical-cable'];
        // 'circuit.count' still lists the conduit's (zeroed) circuit keys; it is informational and read by nobody.
        expect(Object.entries(out ?? {}).filter(([k]) => k !== 'circuit.count').every(([, v]) => v === 0)).toBe(true);
        for (const k of ['R185', 'R193', 'R194', 'R195', 'R196']) expect(row(k)?.total, k).toBe(0);
    });

    it('cable skipped: R193…R196 are 0 but the conduit keeps its quantity', () => {
        const { row } = project(circuits, wiring, p => { p.journey = { 'electrical-cable': 'skipped' }; });
        for (const k of ['R193', 'R194', 'R195', 'R196']) expect(row(k)?.total, k).toBe(0);
        expect(row('R185')?.qty).toBeCloseTo(23.5, 9);
    });

    it('cable skipped: a quantity typed on the BOQ page cannot bring R195 back', () => {
        const { row } = project(circuits, wiring, p => { p.journey = { 'electrical-cable': 'skipped' }; p.boqOverrides.R195 = { qty: 40 }; });
        expect(row('R195')?.qty).toBe(0);
    });

    it('both skipped, then only the conduit un-skipped: cable stays 0 (its own flag)', () => {
        const { row } = project(circuits, wiring, p => { p.journey = { 'electrical-cable': 'skipped', 'electrical-pipe': 'done' }; });
        expect(row('R195')?.total).toBe(0);
        expect(row('R185')?.qty).toBeCloseTo(23.5, 9);
    });
});

describe('electrical-cable edge — journey suggestions', () => {
    it.each(Object.entries(KIND_WIRING))('kind %s: suggestion is a copy of the table (mutating it changes nothing)', (kind, expected) => {
        const circuit = circ('a', 0, 0, 0, 0, { kind: kind as Circuit['kind'] });
        const s = suggestWiring(circuit);
        expect(s).toEqual(expected);
        if (s) s.conductors = 99;
        expect(suggestWiring(circuit)).toEqual(expected);
    });

    it('suggestion table: lights 2.5/1.5 × 2; sockets 4/2.5 × 3; heater, ac, pump 4/- × 3; other none', () => {
        expect(KIND_WIRING.light).toEqual(w('THW 2.5', 'THW 1.5', 2));
        expect(KIND_WIRING.socket).toEqual(w('THW 4', 'THW 2.5', 3));
        expect(KIND_WIRING['kitchen-socket']).toEqual(w('THW 4', 'THW 2.5', 3));
        for (const k of ['heater', 'ac', 'pump'] as const) expect(KIND_WIRING[k]).toEqual(w('THW 4', '', 3));
        expect(KIND_WIRING.other).toBeUndefined();
        expect(suggestWiring(circ('a', 0, 0, 0, 0, { kind: 'other' }))).toBeUndefined();
        expect(suggestWiring(circ('a', 0, 0, 0, 0, { name: 'ไม่มีชนิด' }))).toBeUndefined();
    });

    it('isBlankWiring: undefined, empty, spaces and NaN conductors are blank; any choice is not', () => {
        expect(isBlankWiring(undefined)).toBe(true);
        expect(isBlankWiring(w('', '', 0))).toBe(true);
        expect(isBlankWiring(w('  ', ' ', Number.NaN))).toBe(true);
        expect(isBlankWiring(w('THW 4', '', 0))).toBe(false);
        expect(isBlankWiring(w('', 'THW 4', 0))).toBe(false);
        expect(isBlankWiring(w('', '', 2))).toBe(false);
    });

    it('a suggested light circuit, then computed: 7 switches circuit = Excel row 6', () => {
        const light = circ('a', 22.4, 25.6, 1.5, 16.1, { kind: 'light' });
        const input: ElectricalCableInput = fillSuggestedWiring({ wiring: {} }, [light]);
        const out = electricalCable.compute(input, ctxFor([light]));
        expect(out.R194).toBeCloseTo(47.8, 9);
        expect(out.R193).toBeCloseTo(83.4, 9);
    });

    it('fill / suggest never touches rows the user already set, and an empty list changes nothing', () => {
        const set = { wiring: { a: w('THW 6', '', 2) } };
        expect(fillSuggestedWiring(set, [circ('a', 0, 0, 0, 0, { kind: 'light' })])).toEqual(set);
        expect(fillSuggestedWiring({ wiring: {} }, [])).toEqual({ wiring: {} });
        expect(circuitsToSuggest(set, [circ('a', 0, 0, 0, 0, { kind: 'light' })])).toEqual([]);
    });
});

describe('electrical-cable edge — Excel sample sanity', () => {
    it('defaults() + conduit defaults: THW 1.5 = 189, THW 2.5 = 264.5, THW 4 = 511.8, unassigned 0', () => {
        const { res } = (() => {
            const p = createProject('sample');
            return { res: computeProject(p) };
        })();
        const out = res.calcOutputs['electrical-cable'];
        expect(out?.R193).toBeCloseTo(189, 9);
        expect(out?.R194).toBeCloseTo(264.5, 9);
        expect(out?.R195).toBeCloseTo(511.8, 9);
        expect(out?.unassigned).toBe(0);
        expect(out?.['circuit.count']).toBe(14);
    });
});
