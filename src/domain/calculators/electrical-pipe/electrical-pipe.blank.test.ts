import { describe, expect, it } from 'vitest';
import {
    applyKind, circuitKind, circuitSummary, circuitTotal, electricalPipe, guessCircuitKind, hasPoints, newCircuit,
    newCircuitOfKind, setDeviceV, setDropEach, setPoints, type Circuit,
} from '.';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import type { CalcContext } from '../types';

const none: CalcContext = { outputs: () => undefined };

describe('ท่อร้อยสายไฟ — blank project', () => {
    it('starts with no circuits; compute is finite and R185 = 0', () => {
        const blank = electricalPipe.blank?.();
        expect(blank).toEqual({ circuits: [] });
        const out = electricalPipe.compute(blank ?? { circuits: [] }, none);
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
        expect(out.R185).toBe(0);
        expect(out.total).toBe(0);
        const res = computeProject(createProject('blank'), [electricalPipe]);
        const r185 = res.boq.sections.flatMap(s => s.rows).find(r => r.key === 'R185') as BoqItemRow | undefined;
        expect(r185?.qty).toBe(0);
        expect(r185?.total).toBe(0);
    });
});

describe('ท่อร้อยสายไฟ — journey helpers (no effect on the Excel numbers)', () => {
    const sample = electricalPipe.defaults().circuits;

    it('sample: points × drop per point = the typed H (=7*2.3 …); kinds read from the names', () => {
        const withPoints = sample.filter(c => c.points !== undefined);
        expect(withPoints.map(c => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c14']);
        for (const c of withPoints) expect((c.points ?? NaN) * (c.dropEach ?? NaN)).toBeCloseTo(c.deviceV, 9);
        expect(sample.map(circuitKind)).toEqual([
            'light', 'light', 'socket', 'socket', 'socket', 'heater', 'heater', 'ac', 'ac', 'ac', 'ac', 'ac', 'pump', 'kitchen-socket',
        ]);
        expect(guessCircuitKind('ห้องเก็บของ')).toBeUndefined();
        expect(sample.filter(hasPoints).map(c => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c14']);
    });

    it('sample summary: 2 × 16A + 12 × 20A circuits, 18 switches, 18 sockets', () => {
        expect(circuitSummary(sample)).toEqual({ byBreaker: { '16A.': 2, '20A.': 12 }, switches: 18, sockets: 18 });
        expect(circuitSummary([])).toEqual({ byBreaker: {}, switches: 0, sockets: 0 });
    });

    it('compute ignores the helper fields (only E…H count)', () => {
        const input = electricalPipe.defaults();
        input.circuits = input.circuits.map(c => ({ ...c, points: 99, dropEach: 9, kind: 'other' as const }));
        expect(electricalPipe.compute(input, none).R185).toBeCloseTo(369.9, 9);
    });

    it('new circuit of a kind: presets of the Excel sample, lengths 0', () => {
        const light = newCircuitOfKind(sample, 'light');
        expect(light).toMatchObject({
            kind: 'light', name: 'แสงสว่าง : ', breaker: '16A.', pipeType: 'PVC 1/2"',
            mainH: 0, deviceH: 0, mainV: 1.5, deviceV: 0, dropEach: 2.3,
        });
        expect(sample.some(c => c.id === light.id)).toBe(false);
        expect(newCircuitOfKind([], 'heater')).toMatchObject({ breaker: '20A.', mainV: 3, deviceV: 0 });
        expect(newCircuitOfKind([], 'heater').dropEach).toBeUndefined();
        expect(newCircuitOfKind([], 'ac').mainV).toBeCloseTo(2.4, 9);
        expect(newCircuitOfKind([], 'pump').mainV).toBeCloseTo(4.4, 9);
    });

    it('points → H; drop per point → H; typing H drops the points', () => {
        let c: Circuit = { ...newCircuitOfKind([], 'light'), mainH: 22.4, deviceH: 25.6 };
        c = setPoints(c, 7);
        expect(c.deviceV).toBeCloseTo(16.1, 9);
        expect(circuitTotal(c)).toBeCloseTo(65.6, 9);    // = Excel I6
        c = setDropEach(c, 2.5);
        expect(c.deviceV).toBeCloseTo(17.5, 9);
        c = setDeviceV(c, 10);
        expect(c.deviceV).toBe(10);
        expect(c.points).toBeUndefined();
        expect(setDropEach(c, 3).deviceV).toBe(10);       // no points known → H unchanged
        // a circuit with no drop yet takes its kind's (sockets 3.2)
        const s = setPoints({ ...newCircuit([]), name: 'เต้ารับไฟฟ้า : ห้องนอน 1,2,3' }, 9);
        expect(s.deviceV).toBeCloseTo(28.8, 9);
    });

    it('changing kind applies the preset; a single appliance has no wall drops', () => {
        const socket = setPoints(newCircuitOfKind([], 'socket'), 4);
        expect(socket.deviceV).toBeCloseTo(12.8, 9);
        const asLight = applyKind(socket, 'light');
        expect(asLight).toMatchObject({ kind: 'light', name: 'แสงสว่าง : ', breaker: '16A.', dropEach: 2.3, points: 4 });
        expect(asLight.deviceV).toBeCloseTo(9.2, 9);
        const asAc = applyKind({ ...asLight, name: 'ห้องนอน 1' }, 'ac');
        expect(asAc).toMatchObject({ name: 'ห้องนอน 1', deviceV: 0 });
        expect(asAc.points).toBeUndefined();
        expect(hasPoints(asAc)).toBe(false);
    });
});
