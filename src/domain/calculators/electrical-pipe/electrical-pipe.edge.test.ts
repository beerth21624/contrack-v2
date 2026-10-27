import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import type { CalcContext } from '../types';
import {
    BOQ_PIPE_TYPE, BREAKER_SIZES, CIRCUIT_KINDS, PIPE_TYPES, applyKind, circuitDeviceLength, circuitKey, circuitKind,
    circuitLengths, circuitMainLength, circuitSummary, circuitTotal, electricalPipe, guessCircuitKind, hasPoints,
    kindInfo, newCircuit, newCircuitId, newCircuitOfKind, pipeTypeKey, setDeviceV, setDropEach, setPoints,
    type Circuit, type CircuitKind, type ElectricalPipeInput,
} from '.';

// QA edge tests for "electrical-pipe" (sheet 08 → BOQ section 17, R185 + R186; feeds the cable sheet).
// Expected values are hand-computed: I = E + F + G + H per circuit, R185 = Σ I, H = 1.15 × E,
// J = 25 × H, L = 35 × H, R186 = 15 % × (J + L) (spec 05 §4).

const ctx = { outputs: () => undefined };
const c = (
    id: string, mainH: number, deviceH: number, mainV: number, deviceV: number, extra: Partial<Circuit> = {},
): Circuit => ({ id, name: id, breaker: '20A.', pipeType: 'PVC 1/2"', mainH, deviceH, mainV, deviceV, ...extra });
const compute = (circuits: Circuit[]) => electricalPipe.compute({ circuits }, ctx);
const bad = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

function project(circuits: Circuit[] | undefined, mutate?: (p: ReturnType<typeof createProject>) => void) {
    const p = createProject('blank');
    if (circuits) p.calculators['electrical-pipe'] = { circuits };
    mutate?.(p);
    const res = computeProject(p);
    const row = (key: string) => res.boq.sections.flatMap(s => s.rows).find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { res, row };
}

describe('electrical-pipe edge — blank', () => {
    it('blank(): no circuits; every output finite and 0', () => {
        const b = electricalPipe.blank?.();
        expect(b).toEqual({ circuits: [] });
        const out = electricalPipe.compute(b ?? { circuits: [] }, ctx);
        expect(out).toEqual({ total: 0, R185: 0, 'circuit.count': 0 });
    });

    it('blank project: R185 and its consumables row R186 are 0', () => {
        const { row } = project(undefined);
        expect(row('R185')?.qty).toBe(0);
        expect(row('R185')?.total).toBe(0);
        expect(row('R186')?.total).toBe(0);
    });

    it('Excel sample: 14 circuits, Σ I = 369.9 = BOQ E185', () => {
        const out = electricalPipe.compute(electricalPipe.defaults(), ctx);
        expect(out['circuit.count']).toBe(14);
        expect(out.total).toBeCloseTo(369.9, 9);
        expect(out.R185).toBeCloseTo(369.9, 9);
    });

    it('links R185 qty only; section 17; no deps', () => {
        expect(electricalPipe.boqLinks).toEqual([{ line: 'R185', field: 'qty', output: 'R185' }]);
        expect(electricalPipe.sections).toEqual([17]);
        expect(electricalPipe.deps).toEqual([]);
    });
});

describe('electrical-pipe edge — each length column alone (I = E + F + G + H)', () => {
    const fields: [string, Circuit, number, number, number][] = [
        // [column, circuit, I (total), cable G (main), cable H (device)]
        ['E mainH', c('a', 7, 0, 0, 0), 7, 7, 0],
        ['F deviceH', c('a', 0, 7, 0, 0), 7, 0, 7],
        ['G mainV', c('a', 0, 0, 7, 0), 7, 7, 0],
        ['H deviceV', c('a', 0, 0, 0, 7), 7, 0, 7],
    ];
    it.each(fields)('%s = 7 m → I 7, main %#', (_n, circ, total, main, device) => {
        expect(circuitTotal(circ)).toBe(total);
        expect(circuitMainLength(circ)).toBe(main);
        expect(circuitDeviceLength(circ)).toBe(device);
        const out = compute([circ]);
        expect(out.total).toBe(total);
        expect(out[circuitKey('a', 'main')]).toBe(main);
        expect(out[circuitKey('a', 'device')]).toBe(device);
        expect(out[circuitKey('a', 'total')]).toBe(total);
    });

    it('all four columns: 10 + 2 + 1.5 + 4 = 17.5; main 11.5, device 6', () => {
        const circ = c('a', 10, 2, 1.5, 4);
        expect(circuitTotal(circ)).toBeCloseTo(17.5, 12);
        expect(circuitMainLength(circ)).toBeCloseTo(11.5, 12);
        expect(circuitDeviceLength(circ)).toBeCloseTo(6, 12);
    });

    it('one circuit → BOQ: E = 17.5, H = 20.125, J = 503.125, L = 704.375, R186 = 181.125', () => {
        const { row } = project([c('a', 10, 2, 1.5, 4)]);
        expect(row('R185')?.qty).toBeCloseTo(17.5, 12);
        expect(row('R185')?.grossQty).toBeCloseTo(20.125, 12);
        expect(row('R185')?.matTotal).toBeCloseTo(503.125, 9);
        expect(row('R185')?.labTotal).toBeCloseTo(704.375, 9);
        expect(row('R185')?.total).toBeCloseTo(1207.5, 9);
        expect(row('R186')?.total).toBeCloseTo(181.125, 9);
    });

    it('output keys are circuit|<id>|main / device / total', () => {
        expect(circuitKey('c9', 'main')).toBe('circuit|c9|main');
        expect(circuitKey('c9', 'device')).toBe('circuit|c9|device');
        expect(circuitKey('c9', 'total')).toBe('circuit|c9|total');
    });
});

describe('electrical-pipe edge — value classes (zero, decimal, negative, huge, bad)', () => {
    it('all zero → 0', () => {
        expect(compute([c('a', 0, 0, 0, 0)]).total).toBe(0);
    });

    it('decimals: 0.1 + 0.2 + 0.3 + 0.4 = 1 (within float error)', () => {
        expect(compute([c('a', 0.1, 0.2, 0.3, 0.4)]).total).toBeCloseTo(1, 12);
    });

    it('negative length is summed as is (a deduction), finite', () => {
        expect(compute([c('a', 10, 0, 0, -3)]).total).toBe(7);
    });

    it.each(bad)('a %s cell counts as 0 in every column', v => {
        for (const circ of [c('a', v, 5, 5, 5), c('a', 5, v, 5, 5), c('a', 5, 5, v, 5), c('a', 5, 5, 5, v)]) {
            expect(compute([circ]).total).toBe(15);
            expect(circuitMainLength(circ) + circuitDeviceLength(circ)).toBe(15);
        }
    });

    it('huge length (1e12) stays finite through the BOQ', () => {
        const { row } = project([c('a', 1e12, 1e12, 0, 0)]);
        expect(row('R185')?.qty).toBe(2e12);
        expect(Number.isFinite(row('R185')?.total)).toBe(true);
    });

    it('many huge circuits (1e15 × 1000) stay finite', () => {
        const out = compute(Array.from({ length: 1000 }, (_, i) => c(`c${i}`, 1e15, 0, 0, 0)));
        expect(out.total).toBeCloseTo(1e18, -3);
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
    });
});

describe('electrical-pipe edge — pipe type and breaker (informational)', () => {
    it.each([...PIPE_TYPES])('pipe type %s: counted in R185 and in its own pipe| key', t => {
        const out = compute([c('a', 10, 0, 0, 0, { pipeType: t })]);
        expect(out.R185).toBe(10);
        expect(out[pipeTypeKey(t)]).toBe(10);
    });

    it('oddity D3: R185 adds every circuit whatever the pipe type (3/4" counts as well)', () => {
        const out = compute([c('a', 10, 0, 0, 0), c('b', 4, 0, 0, 0, { pipeType: 'PVC 3/4"' })]);
        expect(out.R185).toBe(14);
        expect(out['pipe|PVC 1/2"']).toBe(10);
        expect(out['pipe|PVC 3/4"']).toBe(4);
    });

    it('pipe type with stray spaces shares a key with its clean spelling; empty type has its own key', () => {
        const out = compute([c('a', 1, 0, 0, 0, { pipeType: ' PVC 1/2" ' }), c('b', 2, 0, 0, 0), c('d', 5, 0, 0, 0, { pipeType: '' })]);
        expect(out['pipe|PVC 1/2"']).toBe(3);
        expect(out['pipe|']).toBe(5);
        expect(out.R185).toBe(8);
    });

    it('BOQ pipe type constant is PVC 1/2" and is a dropdown option', () => {
        expect(BOQ_PIPE_TYPE).toBe('PVC 1/2"');
        expect(PIPE_TYPES).toContain(BOQ_PIPE_TYPE);
    });

    it.each([...BREAKER_SIZES])('breaker size %s has no effect on any length', b => {
        const base = compute([c('a', 10, 2, 1.5, 4, { breaker: '20A.' })]);
        const out = compute([c('a', 10, 2, 1.5, 4, { breaker: b })]);
        expect(out).toEqual(base);
    });

    it('circuit name, kind, points and dropEach never change a length (helpers only)', () => {
        const base = compute([c('a', 10, 2, 1.5, 4)]);
        const out = compute([c('a', 10, 2, 1.5, 4, { name: 'อะไรก็ได้', kind: 'pump', points: 99, dropEach: 99 })]);
        expect(out).toEqual(base);
    });
});

describe('electrical-pipe edge — table size, order, delete', () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => c(`c${i + 1}`, i + 1, 0, 0, 0));

    it('0 / 1 circuits', () => {
        expect(compute([]).total).toBe(0);
        expect(compute(make(1)).total).toBe(1);
    });

    it('14 circuits (Excel count): Σ 1…14 = 105', () => {
        const out = compute(make(14));
        expect(out.total).toBe(105);
        expect(out['circuit.count']).toBe(14);
    });

    it('more than Excel: 24 circuits (Excel rows 6–29) and 50 are all summed (D6)', () => {
        expect(compute(make(24)).total).toBe(300);
        const out = compute(make(50));
        expect(out.total).toBe(1275);
        expect(out['circuit.count']).toBe(50);
    });

    it('deleting a circuit removes exactly its metres and its keys', () => {
        const all = make(5);
        const less = compute(all.filter(x => x.id !== 'c3'));
        expect(less.total).toBe(15 - 3);
        expect(less[circuitKey('c3', 'main')]).toBeUndefined();
        expect(less[circuitKey('c4', 'main')]).toBe(4);
        expect(less['circuit.count']).toBe(4);
    });

    it('deleting the last circuit leaves a finite empty sheet', () => {
        const out = compute(make(1).slice(1));
        expect(out).toEqual({ total: 0, R185: 0, 'circuit.count': 0 });
    });

    it('order of circuits does not change any output', () => {
        const a = compute(make(6));
        const b = compute(make(6).reverse());
        expect(b).toEqual(a);
    });

    it('same metres on two circuits: both are counted (no merge by name)', () => {
        const out = compute([c('a', 5, 0, 0, 0, { name: 'x' }), c('b', 5, 0, 0, 0, { name: 'x' })]);
        expect(out.total).toBe(10);
    });
});

describe('electrical-pipe edge — circuitLengths (what the cable sheet reads)', () => {
    const ctxWith = (circuits: Circuit[]): CalcContext => {
        const out = compute(circuits);
        return { outputs: id => (id === 'electrical-pipe' ? out : undefined) };
    };

    it('no conduit outputs → []', () => {
        expect(circuitLengths({ outputs: () => undefined })).toEqual([]);
        expect(circuitLengths({ outputs: () => ({}) })).toEqual([]);
    });

    it('one entry per circuit, in circuit order, main = E + G, device = F + H', () => {
        const lens = circuitLengths(ctxWith([c('x', 1, 2, 3, 4), c('y', 10, 0, 0, 5)]));
        expect(lens).toEqual([{ id: 'x', main: 4, device: 6 }, { id: 'y', main: 10, device: 5 }]);
    });

    it('ignores unrelated keys (total, R185, pipe|…, circuit.count, …|total)', () => {
        expect(circuitLengths(ctxWith([c('x', 1, 0, 0, 0)])).map(l => l.id)).toEqual(['x']);
    });

    it('an id containing "|" is read back whole', () => {
        const lens = circuitLengths(ctxWith([c('a|b', 2, 0, 3, 0)]));
        expect(lens).toEqual([{ id: 'a|b', main: 5, device: 0 }]);
    });

    it('an id spelled "main" or "total" is not confused with a field', () => {
        const lens = circuitLengths(ctxWith([c('main', 2, 0, 0, 0), c('total', 0, 3, 0, 0)]));
        expect(lens).toEqual([{ id: 'main', main: 2, device: 0 }, { id: 'total', main: 0, device: 3 }]);
    });

    it('non-finite output values are read as 0', () => {
        const fake: CalcContext = { outputs: () => ({ 'circuit|z|main': Number.NaN, 'circuit|z|device': Number.POSITIVE_INFINITY }) };
        expect(circuitLengths(fake)).toEqual([{ id: 'z', main: 0, device: 0 }]);
    });
});

describe('electrical-pipe edge — new circuit ids', () => {
    it('newCircuit: blank row, zero lengths, empty strings', () => {
        const n = newCircuit([]);
        expect(n).toMatchObject({ name: '', breaker: '', pipeType: '', mainH: 0, deviceH: 0, mainV: 0, deviceV: 0 });
        expect(n.id.length).toBeGreaterThan(0);
    });

    it('ids never collide with existing ones (100 draws, each added to the list)', () => {
        const list: Circuit[] = [c('c1', 0, 0, 0, 0)];
        for (let i = 0; i < 100; i++) list.push(newCircuit(list));
        expect(new Set(list.map(x => x.id)).size).toBe(101);
        expect(newCircuitId(list)).not.toBe('c1');
    });
});

describe('electrical-pipe edge — circuit kinds and the points helper', () => {
    it.each([
        ['แสงสว่าง : ห้องนอน', 'light'],
        ['แสง สว่าง', 'light'],
        ['เต้ารับไฟฟ้า : ห้องนอน', 'socket'],
        ['ปลั๊กไฟ', 'socket'],
        ['เต้ารับไฟฟ้า : ห้องครัว', 'kitchen-socket'],
        ['ปลั๊กครัว', 'kitchen-socket'],
        ['เครื่องทำน้ำอุ่น : ห้องน้ำ 1', 'heater'],
        ['เครื่องปรับอากาศห้องนอน 1', 'ac'],
        ['เครื่องปรับอากาคห้องนอน 2', 'ac'],
        ['แอร์ห้องนั่งเล่น', 'ac'],
        ['เครื่องปั๊มน้ำ', 'pump'],
        ['เครื่องปั้มน้ำ', 'pump'],
        ['อื่น ๆ', undefined],
        ['', undefined],
    ])('guessCircuitKind(%j) = %s', (name, kind) => {
        expect(guessCircuitKind(name)).toBe(kind);
    });

    it('chosen kind wins over the name', () => {
        expect(circuitKind(c('a', 0, 0, 0, 0, { name: 'แสงสว่าง', kind: 'pump' }))).toBe('pump');
        expect(circuitKind(c('a', 0, 0, 0, 0, { name: 'แสงสว่าง' }))).toBe('light');
    });

    it('presets: breaker 16A for lights, 20A for the rest; G = 1.5 + rise', () => {
        const expected: Record<CircuitKind, [string, number]> = {
            light: ['16A.', 1.5], socket: ['20A.', 1.5], 'kitchen-socket': ['20A.', 1.5], heater: ['20A.', 3],
            ac: ['20A.', 2.4], pump: ['20A.', 4.4], other: ['20A.', 1.5],
        };
        for (const k of CIRCUIT_KINDS) {
            const [breaker, mainV] = expected[k.kind];
            expect(k.breaker, k.kind).toBe(breaker);
            expect(k.mainV, k.kind).toBeCloseTo(mainV, 12);
        }
        expect(CIRCUIT_KINDS).toHaveLength(7);
        expect(kindInfo(undefined)).toBeUndefined();
    });

    it.each(CIRCUIT_KINDS.map(k => k.kind))('applyKind(%s) on a blank row: breaker, G and name follow the preset', kind => {
        const k = kindInfo(kind);
        const out = applyKind(newCircuit([]), kind);
        expect(out.kind).toBe(kind);
        expect(out.breaker).toBe(k?.breaker);
        expect(out.mainV).toBeCloseTo(k?.mainV ?? NaN, 12);
        expect(out.name).toBe(k?.name);
        if (k?.dropEach === undefined) expect(out.deviceV).toBe(0);
    });

    it('applyKind keeps a name the user typed; replaces another kind\'s preset name', () => {
        expect(applyKind(c('a', 0, 0, 0, 0, { name: 'ห้องนอนใหญ่' }), 'light').name).toBe('ห้องนอนใหญ่');
        expect(applyKind(c('a', 0, 0, 0, 0, { name: 'เต้ารับไฟฟ้า :' }), 'light').name).toBe('แสงสว่าง : ');
    });

    it('applyKind with points recomputes H = points × drop; a single appliance drops points and H', () => {
        const light = applyKind(c('a', 0, 0, 0, 99, { points: 7 }), 'light');
        expect(light.deviceV).toBeCloseTo(16.1, 12);
        const pump = applyKind(light, 'pump');
        expect(pump.deviceV).toBe(0);
        expect(pump.points).toBeUndefined();
        expect(pump.dropEach).toBeUndefined();
    });

    it('setPoints: H = points × drop (row drop, else kind drop, else 0)', () => {
        expect(setPoints(c('a', 0, 0, 0, 0, { kind: 'light' }), 7).deviceV).toBeCloseTo(16.1, 12);
        expect(setPoints(c('a', 0, 0, 0, 0, { kind: 'socket' }), 9).deviceV).toBeCloseTo(28.8, 12);
        expect(setPoints(c('a', 0, 0, 0, 0, { dropEach: 2 }), 3).deviceV).toBe(6);
        expect(setPoints(c('a', 0, 0, 0, 0, { name: 'x' }), 5).deviceV).toBe(0);
        expect(setPoints(c('a', 0, 0, 0, 0, { kind: 'light' }), 0).deviceV).toBe(0);
        expect(setPoints(c('a', 0, 0, 0, 0, { kind: 'light' }), Number.NaN).deviceV).toBe(0);
    });

    it('setDropEach follows points only when points are known; setDeviceV drops the helper', () => {
        expect(setDropEach(c('a', 0, 0, 0, 5, { points: 4 }), 2.5).deviceV).toBe(10);
        expect(setDropEach(c('a', 0, 0, 0, 5), 2.5).deviceV).toBe(5);
        const typed = setDeviceV(c('a', 0, 0, 0, 5, { points: 4, dropEach: 2 }), 12);
        expect(typed.deviceV).toBe(12);
        expect(typed.points).toBeUndefined();
    });

    it('hasPoints: wall-drop kinds and unknown kinds yes, single appliances no', () => {
        expect(hasPoints(c('a', 0, 0, 0, 0, { kind: 'light' }))).toBe(true);
        expect(hasPoints(c('a', 0, 0, 0, 0, { kind: 'pump' }))).toBe(false);
        expect(hasPoints(c('a', 0, 0, 0, 0, { name: 'ไม่รู้จัก' }))).toBe(true);
        expect(hasPoints(c('a', 0, 0, 0, 0, { kind: 'pump', points: 1 }))).toBe(true);
    });

    it('newCircuitOfKind: PVC 1/2", zero lengths except the preset G', () => {
        const ac = newCircuitOfKind([], 'ac');
        expect(ac).toMatchObject({ pipeType: 'PVC 1/2"', breaker: '20A.', mainH: 0, deviceH: 0, deviceV: 0, kind: 'ac' });
        expect(ac.mainV).toBeCloseTo(2.4, 12);
        expect(circuitTotal(ac)).toBeCloseTo(2.4, 12);
    });

    it('circuitSummary: circuits per breaker, switches (lights) and sockets', () => {
        const s = circuitSummary([
            c('a', 0, 0, 0, 0, { breaker: '16A.', kind: 'light', points: 7 }),
            c('b', 0, 0, 0, 0, { breaker: '16A.', kind: 'light', points: 11 }),
            c('d', 0, 0, 0, 0, { breaker: '20A.', kind: 'socket', points: 9 }),
            c('e', 0, 0, 0, 0, { breaker: '20A.', kind: 'kitchen-socket', points: 3 }),
            c('f', 0, 0, 0, 0, { breaker: '20A.', kind: 'heater', points: 5 }),
            c('g', 0, 0, 0, 0, { breaker: ' ' }),
        ]);
        expect(s).toEqual({ byBreaker: { '16A.': 2, '20A.': 3 }, switches: 18, sockets: 12 });
        expect(circuitSummary([])).toEqual({ byBreaker: {}, switches: 0, sockets: 0 });
    });
});

describe('electrical-pipe edge — level skipped (ไม่มีในโครงการนี้)', () => {
    const sample = (): Circuit[] => [c('a', 10, 2, 1.5, 4)];

    it('skipped: outputs 0, R185 and R186 0', () => {
        const { res, row } = project(sample(), p => { p.journey = { 'electrical-pipe': 'skipped' }; });
        expect(Object.values(res.calcOutputs['electrical-pipe'] ?? {}).every(v => v === 0)).toBe(true);
        expect(row('R185')?.qty).toBe(0);
        expect(row('R185')?.total).toBe(0);
        expect(row('R186')?.total).toBe(0);
    });

    it('skipped: a quantity typed on the BOQ page cannot bring R185 back', () => {
        const { row } = project(sample(), p => { p.journey = { 'electrical-pipe': 'skipped' }; p.boqOverrides.R185 = { qty: 50 }; });
        expect(row('R185')?.qty).toBe(0);
        expect(row('R185')?.total).toBe(0);
    });

    it('un-skipped: the stored circuits are back', () => {
        const { row } = project(sample(), p => { p.journey = { 'electrical-pipe': 'done' }; });
        expect(row('R185')?.qty).toBeCloseTo(17.5, 12);
    });

    it('skipping the cable level does not touch the conduit', () => {
        const { row } = project(sample(), p => { p.journey = { 'electrical-cable': 'skipped' }; });
        expect(row('R185')?.qty).toBeCloseTo(17.5, 12);
    });
});

describe('electrical-pipe edge — types', () => {
    it('dropdown lists as in Excel', () => {
        expect([...BREAKER_SIZES]).toEqual(['16A.', '20A.', '32A.', '40A.']);
        expect([...PIPE_TYPES]).toEqual(['PVC 1/2"', 'PVC 3/4"']);
    });

    it('input type round-trips through JSON (stored form of a project)', () => {
        const input: ElectricalPipeInput = JSON.parse(JSON.stringify(electricalPipe.defaults())) as ElectricalPipeInput;
        expect(electricalPipe.compute(input, ctx).total).toBeCloseTo(369.9, 9);
    });
});
