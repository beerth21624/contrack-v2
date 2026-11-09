'use client';

// ─── Hooks the dev-mode panels use: the trace of a step, the explanation of every BOQ cell ───
// Both compute nothing (return undefined) while dev mode is not active, so normal use costs nothing.
import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useProjectStore } from '@/store/project-store';
import type { CalculatorDef } from '@/domain/calculators/types';
import {
    explainProjectBoq, projectTraceBase, traceLabelSet, traceProjectCalculator,
    type BoqExplanation, type CalcTrace, type TraceLabelSet,
} from '@/domain/trace';
import { useDevMode } from './useDevMode';

/** The trace of a step as the project stands, with its label set for the UI locale (undefined when dev mode is off). */
export function useCalcTrace(def: Pick<CalculatorDef, 'id' | 'traceLabels'>): { trace: CalcTrace; labels: TraceLabelSet | undefined } | undefined {
    const { active } = useDevMode();
    const project = useProjectStore(s => s.project);
    const locale = useLocale();
    return useMemo(() => {
        if (!active) return undefined;
        const trace = traceProjectCalculator(project, def.id);
        return trace ? { trace, labels: traceLabelSet(def.traceLabels, locale) } : undefined;
    }, [active, project, def.id, def.traceLabels, locale]);
}

/** Explanation of every BOQ line of the project (undefined when dev mode is off). */
export function useBoqExplanation(): BoqExplanation | undefined {
    const { active } = useDevMode();
    const project = useProjectStore(s => s.project);
    return useMemo(() => (active ? explainProjectBoq(project, projectTraceBase(project)) : undefined), [active, project]);
}
