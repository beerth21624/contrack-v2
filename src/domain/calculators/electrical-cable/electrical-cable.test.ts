import { describe, expect, it } from 'vitest';
import { cableRows, electricalCable, sizeKey, type ElectricalCableInput } from '.';
import { electricalPipe, newCircuit, type Circuit, type ElectricalPipeInput } from '../electrical-pipe';
import { CALCULATORS } from '../registry';
import type { CalcContext } from '../types';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';

/** ctx with the conduit outputs of `p`. */
function ctxFor(p: ElectricalPipeInput = electricalPipe.defaults()): CalcContext {
    const pipeOut = electricalPipe.compute(p, { outputs: () => undefined });
    return { outputs: id => (id === 'electrical-pipe' ? pipeOut : undefined) };
}

describe('สายไฟ_Electrical Cable (sheet 09)', () => {
    it('Excel sample: G, H, I, J, K, L of rows 6…19', () => {
        const rows = cableRows(electricalCable.defaults(), ctxFor());
        // [G, H, I, J, K] from the v5 dump; L is 0 on every row.
        const expected = [
            [23.9, 41.7, 83.4, 47.8, 0], [26, 52.8, 105.6, 52, 0], [28.9, 28.8, 0, 86.4, 86.7],
            [22.5, 12.8, 0, 38.4, 67.5], [21.5, 6.4, 0, 19.2, 64.5], [15, 0, 0, 0, 45], [6, 0, 0, 0, 18],
            [19.4, 0, 0, 0, 58.2], [13.4, 0, 0, 0, 40.2], [9.4, 0, 0, 0, 28.2], [8.8, 0, 0, 0, 26.4],
            [9.8, 0, 0, 0, 29.4], [9.4, 0, 0, 0, 28.2], [6.5, 6.9, 0, 20.7, 19.5],
        ];
        expect(rows).toHaveLength(expected.length);
        rows.forEach((r, i) => {
            const [g, h, iv, j, k] = expected[i] ?? [];
            expect(r.main).toBeCloseTo(g ?? NaN, 9);
            expect(r.device).toBeCloseTo(h ?? NaN, 9);
            expect(r.bySize['THW 1.5']).toBeCloseTo(iv ?? NaN, 9);
            expect(r.bySize['THW 2.5']).toBeCloseTo(j ?? NaN, 9);
            expect(r.bySize['THW 4']).toBeCloseTo(k ?? NaN, 9);
            expect(r.bySize['THW 6']).toBe(0);
            expect(r.unassigned).toBe(0);
        });
    });

    it('I4…L4 and the BOQ quantities R193…R195 = golden', () => {
        const out = electricalCable.compute(electricalCable.defaults(), ctxFor());
        expect(out[sizeKey('THW 1.5')]).toBeCloseTo(189, 9);
        expect(out[sizeKey('THW 2.5')]).toBeCloseTo(264.5, 9);
        expect(out[sizeKey('THW 4')]).toBeCloseTo(511.8, 9);
        expect(out[sizeKey('THW 6')]).toBe(0);
        expect(out.R193).toBeCloseTo(golden.lines.R193.E, 9);
        expect(out.R194).toBeCloseTo(golden.lines.R194.E, 9);
        expect(out.R195).toBeCloseTo(golden.lines.R195.E, 9);
        expect(out.unassigned).toBe(0);
        expect(electricalCable.boqLinks.map(l => l.line)).toEqual(['R193', 'R194', 'R195']);
    });

    it('counts every circuit of the conduit sheet, not only Excel rows 6–19 (D6)', () => {
        const pipe = electricalPipe.defaults();
        const c15: Circuit = { ...newCircuit(pipe.circuits), name: 'วงจร 15', mainH: 10, mainV: 1.5, deviceH: 2, deviceV: 4 };
        pipe.circuits.push(c15);
        const c16: Circuit = { ...newCircuit(pipe.circuits), name: 'วงจร 16', mainH: 5, mainV: 1 };
        pipe.circuits.push(c16);
        const input: ElectricalCableInput = electricalCable.defaults();
        input.wiring[c15.id] = { mainSize: 'THW 6', deviceSize: 'THW 1.5', conductors: 3 };
        input.wiring[c16.id] = { mainSize: 'THW 2.5', deviceSize: '', conductors: 2 };
        const out = electricalCable.compute(input, ctxFor(pipe));
        expect(out['circuit.count']).toBe(16);
        expect(out[sizeKey('THW 6')]).toBeCloseTo(11.5 * 3, 9);  // no BOQ row (D7)
        expect(out.R193).toBeCloseTo(189 + 6 * 3, 9);
        expect(out.R194).toBeCloseTo(264.5 + 6 * 2, 9);
        expect(out.R195).toBeCloseTo(511.8, 9);
    });

    it('a circuit with no cable settings counts nothing and is reported as unassigned (D8)', () => {
        const pipe = electricalPipe.defaults();
        const c = { ...newCircuit(pipe.circuits), mainH: 7, deviceV: 3 };
        pipe.circuits.push(c);
        const input = electricalCable.defaults();
        let out = electricalCable.compute(input, ctxFor(pipe));
        const sum = ['R193', 'R194', 'R195', sizeKey('THW 6')].reduce((s, k) => s + (out[k] ?? NaN), 0);
        expect(sum).toBeCloseTo(189 + 264.5 + 511.8, 9);
        expect(out.unassigned).toBeCloseTo(10, 9);
        // size chosen for the main run only → the device drop is still unassigned
        input.wiring[c.id] = { mainSize: 'THW 4', deviceSize: '', conductors: 3 };
        out = electricalCable.compute(input, ctxFor(pipe));
        expect(out.R195).toBeCloseTo(511.8 + 21, 9);
        expect(out.unassigned).toBeCloseTo(3, 9);
    });

    it('changing a wire size / conductor count moves the metres between columns', () => {
        const input = electricalCable.defaults();
        input.wiring.c1 = { mainSize: 'THW 4', deviceSize: 'THW 1.5', conductors: 3 }; // was 2.5 / 1.5 / 2
        const out = electricalCable.compute(input, ctxFor());
        expect(out.R193).toBeCloseTo(189 - 83.4 + 41.7 * 3, 9);
        expect(out.R194).toBeCloseTo(264.5 - 47.8, 9);
        expect(out.R195).toBeCloseTo(511.8 + 23.9 * 3, 9);
    });

    it('follows the conduit lengths; deleting a circuit removes its cable', () => {
        const pipe = electricalPipe.defaults();
        pipe.circuits = pipe.circuits.filter(c => c.id !== 'c3');           // 86.4 THW 2.5 + 86.7 THW 4
        pipe.circuits = pipe.circuits.map(c => (c.id === 'c1' ? { ...c, mainH: c.mainH + 1 } : c)); // +1 m main × 2 (THW 2.5)
        const out = electricalCable.compute(electricalCable.defaults(), ctxFor(pipe));
        expect(out.R194).toBeCloseTo(264.5 - 86.4 + 2, 9);
        expect(out.R195).toBeCloseTo(511.8 - 86.7, 9);
        expect(out.R193).toBeCloseTo(189, 9);
    });

    it('project: sections 17 and 18 totals = Excel M187 / M197', () => {
        const ids = new Set(['electrical-pipe', 'electrical-cable']);
        const calcs = [...CALCULATORS.filter(c => !ids.has(c.id)), electricalPipe, electricalCable];
        const result = computeProject(createProject(), calcs);
        expect(result.calcOutputs['electrical-cable']?.R195).toBeCloseTo(511.8, 9);
        for (const no of [17, 18] as const) {
            const s = result.boq.sections.find(x => x.no === no);
            expect(s?.total).toBeCloseTo(golden.sections[String(no) as '17' | '18'].M, 2);
        }
    });
});
