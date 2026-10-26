'use client';

import { useCallback, useMemo } from 'react';
import { useProjectStore } from '@/store/project-store';
import { calculatorInput, computeProject, type ProjectResult } from '@/domain/project';
import type { CalculatorDef } from '@/domain/calculators/types';

export interface UseCalculator<I> {
    input: I;
    /** Merge a partial change (or apply a function) into the calculator's input. */
    update: (patch: Partial<I> | ((prev: I) => I)) => void;
    /** Back to the Excel v5 sample input. */
    reset: () => void;
    outputs: Record<string, number>;
    result: ProjectResult;
    isDefault: boolean;
}

export function useCalculator<I>(def: CalculatorDef<I>): UseCalculator<I> {
    const project = useProjectStore(s => s.project);
    const setCalculatorInput = useProjectStore(s => s.setCalculatorInput);

    const input = useMemo(() => calculatorInput(project, def), [project, def]);
    const result = useMemo(() => computeProject(project), [project]);

    const update = useCallback((patch: Partial<I> | ((prev: I) => I)) => {
        const prev = calculatorInput(useProjectStore.getState().project, def);
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
        setCalculatorInput(def.id, next);
    }, [def, setCalculatorInput]);

    const reset = useCallback(() => setCalculatorInput(def.id, undefined), [def, setCalculatorInput]);

    return {
        input,
        update,
        reset,
        outputs: result.calcOutputs[def.id] ?? {},
        result,
        isDefault: project.calculators[def.id] === undefined,
    };
}
