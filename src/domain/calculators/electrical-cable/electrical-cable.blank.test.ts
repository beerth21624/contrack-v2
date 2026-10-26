import { describe, expect, it } from 'vitest';
import {
    circuitsToSuggest, electricalCable, fillSuggestedWiring, isBlankWiring, rewireForKind, sizeKey, suggestWiring,
} from '.';
import { applyKind, electricalPipe, newCircuitOfKind, type ElectricalPipeInput } from '../electrical-pipe';
import type { CalcContext } from '../types';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import golden from '../../boq/__tests__/golden.v5.json';

function ctxFor(p: ElectricalPipeInput): CalcContext {
    const pipeOut = electricalPipe.compute(p, { outputs: () => undefined });
    return { outputs: id => (id === 'electrical-pipe' ? pipeOut : undefined) };
}

describe('สายไฟ — blank project', () => {
    it('no wire settings; compute is finite and R193…R195 = 0', () => {
        const blank = electricalCable.blank?.() ?? { wiring: {} };
        expect(blank).toEqual({ wiring: {} });
        const out = electricalCable.compute(blank, ctxFor({ circuits: [] }));
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
        for (const line of ['R193', 'R194', 'R195']) expect(out[line]).toBe(0);
        const res = computeProject(createProject('blank'), [electricalPipe, electricalCable]);
        const rows = res.boq.sections.flatMap(s => s.rows).filter((r): r is BoqItemRow => r.type === 'item');
        for (const line of ['R185', 'R193', 'R194', 'R195']) expect(rows.find(r => r.key === line)?.total, line).toBe(0);
    });

    it('compute never applies suggestions: a circuit with blank settings still counts nothing (D8)', () => {
        const pipe = electricalPipe.defaults();
        const out = electricalCable.compute({ wiring: {} }, ctxFor(pipe));
        expect(out.R193).toBe(0);
        expect(out.R194).toBe(0);
        expect(out.R195).toBe(0);
        expect(out.unassigned).toBeCloseTo(369.9, 9);   // every metre of the conduit runs (G + H = Pipe I)
    });
});

describe('สายไฟ — journey pre-selection', () => {
    const pipe = electricalPipe.defaults();

    it('the suggestions by circuit kind are exactly the Excel sample settings of its 14 circuits', () => {
        const filled = fillSuggestedWiring({ wiring: {} }, pipe.circuits);
        expect(filled).toEqual(electricalCable.defaults());
        const out = electricalCable.compute(filled, ctxFor(pipe));
        expect(out.R193).toBeCloseTo(golden.lines.R193.E, 9);
        expect(out.R194).toBeCloseTo(golden.lines.R194.E, 9);
        expect(out.R195).toBeCloseTo(golden.lines.R195.E, 9);
        expect(circuitsToSuggest(electricalCable.defaults(), pipe.circuits)).toEqual([]);
    });

    it('fills only blank circuits; "other" circuits get no suggestion', () => {
        const light = newCircuitOfKind(pipe.circuits, 'light');
        const other = newCircuitOfKind([...pipe.circuits, light], 'other');
        const input = electricalCable.defaults();
        input.wiring.c1 = { mainSize: 'THW 4', deviceSize: 'THW 4', conductors: 3 };   // chosen by the user
        const circuits = [...pipe.circuits, light, other];
        expect(circuitsToSuggest(input, circuits).map(c => c.id)).toEqual([light.id]);
        const filled = fillSuggestedWiring(input, circuits);
        expect(filled.wiring.c1).toEqual({ mainSize: 'THW 4', deviceSize: 'THW 4', conductors: 3 });
        expect(filled.wiring[light.id]).toEqual({ mainSize: 'THW 2.5', deviceSize: 'THW 1.5', conductors: 2 });
        expect(filled.wiring[other.id]).toBeUndefined();
        expect(suggestWiring(other)).toBeUndefined();
        expect(isBlankWiring(filled.wiring[other.id])).toBe(true);
    });

    it('a new light circuit, 7 switches: its cable counts once wiring is filled', () => {
        const c = { ...newCircuitOfKind([], 'light'), mainH: 22.4, deviceH: 25.6, deviceV: 16.1, points: 7 };
        const p: ElectricalPipeInput = { circuits: [c] };
        const out = electricalCable.compute(fillSuggestedWiring({ wiring: {} }, p.circuits), ctxFor(p));
        expect(out[sizeKey('THW 2.5')]).toBeCloseTo(23.9 * 2, 9);   // = Excel J6
        expect(out[sizeKey('THW 1.5')]).toBeCloseTo(41.7 * 2, 9);   // = Excel I6
        expect(out.unassigned).toBe(0);
    });

    it('changing a circuit kind re-suggests untouched settings and keeps chosen ones', () => {
        const light = newCircuitOfKind([], 'light');
        const asSocket = applyKind(light, 'socket');
        const suggested = fillSuggestedWiring({ wiring: {} }, [light]);
        expect(rewireForKind(suggested, light, asSocket).wiring[light.id])
            .toEqual({ mainSize: 'THW 4', deviceSize: 'THW 2.5', conductors: 3 });
        expect(rewireForKind({ wiring: {} }, light, asSocket).wiring[light.id])
            .toEqual({ mainSize: 'THW 4', deviceSize: 'THW 2.5', conductors: 3 });
        const chosen = { wiring: { [light.id]: { mainSize: 'THW 6', deviceSize: 'THW 1.5', conductors: 2 } } };
        expect(rewireForKind(chosen, light, asSocket)).toEqual(chosen);
    });
});
