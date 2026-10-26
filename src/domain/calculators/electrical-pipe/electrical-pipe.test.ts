import { describe, expect, it } from 'vitest';
import {
    circuitKey, circuitLengths, circuitTotal, electricalPipe, newCircuit, newCircuitId, pipeTypeKey, type Circuit,
} from '.';
import { CALCULATORS } from '../registry';
import type { CalcContext } from '../types';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';

const none: CalcContext = { outputs: () => undefined };

describe('ท่อร้อยสายไฟ_Electrical Pipe (sheet 08)', () => {
    it('Excel sample: I6…I19 and I4', () => {
        const rows = electricalPipe.defaults().circuits;
        const expected = [65.6, 78.8, 57.7, 35.3, 27.9, 15, 6, 19.4, 13.4, 9.4, 8.8, 9.8, 9.4, 13.4];
        const totals = rows.map(circuitTotal);
        expect(totals).toHaveLength(expected.length);
        expected.forEach((e, i) => expect(totals[i]).toBeCloseTo(e, 9));
        const out = electricalPipe.compute(electricalPipe.defaults(), none);
        expect(out.total).toBeCloseTo(369.9, 9);
        expect(out['circuit.count']).toBe(14);
        expect(out[pipeTypeKey('PVC 1/2"')]).toBeCloseTo(369.9, 9);
    });

    it('R185 = golden BOQ E185', () => {
        const out = electricalPipe.compute(electricalPipe.defaults(), none);
        expect(out.R185).toBeCloseTo(golden.lines.R185.E, 9);
        expect(electricalPipe.boqLinks).toEqual([{ line: 'R185', field: 'qty', output: 'R185' }]);
    });

    it('per-circuit cable lengths = Cable G6:H19 (E+G, F+H)', () => {
        const out = electricalPipe.compute(electricalPipe.defaults(), none);
        const lens = circuitLengths({ outputs: id => (id === 'electrical-pipe' ? out : undefined) });
        const g = [23.9, 26, 28.9, 22.5, 21.5, 15, 6, 19.4, 13.4, 9.4, 8.8, 9.8, 9.4, 6.5];
        const h = [41.7, 52.8, 28.8, 12.8, 6.4, 0, 0, 0, 0, 0, 0, 0, 0, 6.9];
        expect(lens.map(l => l.id)).toEqual(electricalPipe.defaults().circuits.map(c => c.id));
        lens.forEach((l, i) => {
            expect(l.main).toBeCloseTo(g[i] ?? NaN, 9);
            expect(l.device).toBeCloseTo(h[i] ?? NaN, 9);
        });
        expect(circuitLengths(none)).toEqual([]);
    });

    it('every circuit is summed, whatever its pipe type (rows past Excel row 19 too — D6)', () => {
        const input = electricalPipe.defaults();
        const extra: Circuit = { ...newCircuit(input.circuits), name: 'วงจร 15', pipeType: 'PVC 3/4"', mainH: 10, deviceH: 2, mainV: 1.5, deviceV: 4.6 };
        input.circuits.push(extra);
        const out = electricalPipe.compute(input, none);
        expect(out.R185).toBeCloseTo(369.9 + 18.1, 9);
        expect(out[pipeTypeKey('PVC 1/2"')]).toBeCloseTo(369.9, 9);
        expect(out[pipeTypeKey('PVC 3/4"')]).toBeCloseTo(18.1, 9);
        expect(out[circuitKey(extra.id, 'main')]).toBeCloseTo(11.5, 9);
        expect(out[circuitKey(extra.id, 'device')]).toBeCloseTo(6.6, 9);
        expect(out['circuit.count']).toBe(15);
    });

    it('editing / deleting a circuit; blank and non-numeric cells count 0', () => {
        const input = electricalPipe.defaults();
        input.circuits = input.circuits.slice(1);                          // drop circuit 1 (65.6)
        input.circuits = input.circuits.map(c => (c.id === 'c2' ? { ...c, deviceV: 11 * 2.3 + 2.3 } : c)); // 25.3 → 27.6
        input.circuits.push({ ...newCircuit(input.circuits), mainH: Number.NaN });
        const out = electricalPipe.compute(input, none);
        expect(out.R185).toBeCloseTo(369.9 - 65.6 + 2.3, 9);
    });

    it('new circuit ids are unique', () => {
        const rows = electricalPipe.defaults().circuits;
        const id = newCircuitId(rows);
        expect(rows.some(c => c.id === id)).toBe(false);
        expect(id).not.toBe('');
    });

    it('project: section 17 total = Excel M187', () => {
        const ids = new Set(['electrical-pipe', 'electrical-cable']);
        const result = computeProject(createProject(), [...CALCULATORS.filter(c => !ids.has(c.id)), electricalPipe]);
        expect(result.calcOutputs['electrical-pipe']?.R185).toBeCloseTo(369.9, 9);
        const s17 = result.boq.sections.find(s => s.no === 17);
        expect(s17?.total).toBeCloseTo(golden.sections['17'].M, 2);
    });
});
