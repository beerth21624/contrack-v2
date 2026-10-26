'use client';

// The conduit step's circuits joined with this step's wire settings and results (sheet and journey views).
import {
    BLANK_WIRING, cableRows, type CableRow, type CircuitWiring, type ElectricalCableInput,
} from '@/domain/calculators/electrical-cable';
import { electricalPipe, type Circuit } from '@/domain/calculators/electrical-pipe';
import type { CalcContext } from '@/domain/calculators/types';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import type { UseCalculator } from '../useCalculator';

export interface Row {
    circuit: Circuit;
    wiring: CircuitWiring;
    cable?: CableRow;
}

export type Calc = UseCalculator<ElectricalCableInput>;

export const withWiring = (r: Row, patch: Partial<CircuitWiring>): Row => ({ ...r, wiring: { ...r.wiring, ...patch } });

/** The conduit level's circuits joined with this level's wire settings and results. */
export function useCableRows(calc: Calc): { rows: Row[]; circuits: Circuit[] } {
    // One circuit list (decision on oddity D4): names, CB and lengths come from the conduit sheet.
    const project = useProjectStore(s => s.project);
    const { input, result } = calc;
    const pipeInput = calculatorInput(project, electricalPipe);
    const pipeOut = result.calcOutputs['electrical-pipe'] ?? electricalPipe.compute(pipeInput, { outputs: () => undefined });
    const ctx: CalcContext = { outputs: id => (id === 'electrical-pipe' ? pipeOut : result.calcOutputs[id]) };
    const byId = new Map(cableRows(input, ctx).map(r => [r.id, r]));
    const rows = pipeInput.circuits.map(circuit => {
        const cable = byId.get(circuit.id);
        return { circuit, wiring: input.wiring[circuit.id] ?? BLANK_WIRING, ...(cable ? { cable } : {}) };
    });
    return { rows, circuits: pipeInput.circuits };
}
