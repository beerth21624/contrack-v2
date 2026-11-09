// ─── Dev-mode traces of a whole project: one calculator's trace, or the explanation of every BOQ cell ───
import { computeBoq } from '../boq/engine';
import type { BoqResult } from '../boq/types';
import { getCalculator } from '../calculators/registry';
import { calculatorInput, projectBoqInput, type Project, type ProjectBoqInput } from '../project';
import { explainBoq } from './explain-boq';
import { runTrace } from './run';
import type { BoqExplanation, CalcTrace } from './types';

/** Prepared once per project change and shared by every trace / explanation (avoids recomputing the project). */
export interface ProjectTraceBase {
    prepared: ProjectBoqInput;
    boq: BoqResult;
}

export function projectTraceBase(project: Project): ProjectTraceBase {
    const prepared = projectBoqInput(project);
    return { prepared, boq: computeBoq(prepared.boqInput) };
}

/** The trace of one step as the project stands (its input, the real outputs of its deps, BOQ edits, skipped state). */
export function traceProjectCalculator(project: Project, calcId: string, base: ProjectTraceBase = projectTraceBase(project)): CalcTrace | undefined {
    const def = getCalculator(calcId);
    if (!def) return undefined;
    const { prepared, boq } = base;
    return runTrace(def, calculatorInput(project, def), { outputs: id => prepared.calcOutputs[id] }, {
        overrides: prepared.boqInput.overrides,
        boq,
        skipped: prepared.skippedCalcs.has(def.id),
        inputOf: d => calculatorInput(project, d),
    });
}

/** "Explain this cell" data for every BOQ line of the project; the numbers are computeBoq's. */
export function explainProjectBoq(project: Project, base: ProjectTraceBase = projectTraceBase(project)): BoqExplanation {
    const { prepared, boq } = base;
    return explainBoq({ ...prepared.boqInput, origins: prepared.origins, zeroed: prepared.zeroed }, boq);
}
