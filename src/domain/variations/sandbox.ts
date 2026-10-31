// ─── VO lines from the calculators (docs/erp/02-domain-model.md §5) ───
// Pure. The VO's sandbox (calculator inputs + BOQ edits) is laid over the baseline snapshot, the project is computed
// again, and its BOQ lines are compared with the baseline's: every line whose quantity or amount moved becomes a VO line
// (`source = 'calculator'`): the quantity change, the unit costs of the new state (of the old one for a removed line)
// and the change of the line total as its cost.
import { boqLineEn } from '../boq/template.v5.en';
import type { BoqLineOverride } from '../boq/types';
import { type BoqVersionLine, boqVersionLines } from '../boq-control/version-lines';
import { round2, roundQty } from '../money/money';
import { type Project, computeProject } from '../project';

export interface VariationSandboxInput {
    calculators: Record<string, unknown>;
    boqOverrides: Record<string, Record<string, unknown>>;
}

/** One VO line computed from the sandbox (before pricing). */
export interface SandboxVariationLine {
    lineKey: string;
    sectionNo: number;
    /** BOQ position, for ordering. */
    sort: number;
    descTh: string;
    descEn: string;
    unit: string;
    qtyDelta: number;
    costMatUnit: number;
    costLabUnit: number;
    /** after.total − before.total. */
    costAmount: number;
}

/** The baseline project with the sandbox laid over it (the baseline object is not changed). */
export function applyVariationSandbox(baseline: Project, sandbox: VariationSandboxInput): Project {
    return {
        ...baseline,
        calculators: { ...baseline.calculators, ...sandbox.calculators },
        boqOverrides: { ...baseline.boqOverrides, ...(sandbox.boqOverrides as Record<string, BoqLineOverride>) },
    };
}

/** BOQ lines of a project as a version stores them. */
export const projectBoqLines = (project: Project): BoqVersionLine[] => boqVersionLines(computeProject(project).boq).lines;

/** The VO lines that turn the baseline into baseline + sandbox (BOQ order). */
export function variationLinesFromSandbox(baseline: Project, sandbox: VariationSandboxInput): SandboxVariationLine[] {
    const before = new Map(projectBoqLines(baseline).map(l => [l.lineKey, l]));
    const after = projectBoqLines(applyVariationSandbox(baseline, sandbox));
    const out: SandboxVariationLine[] = [];
    const seen = new Set<string>();
    const push = (key: string, b: BoqVersionLine | undefined, a: BoqVersionLine | undefined): void => {
        const ref = a ?? b;
        if (ref === undefined) return;
        const qtyDelta = roundQty((a?.qty ?? 0) - (b?.qty ?? 0));
        const costAmount = round2((a?.total ?? 0) - (b?.total ?? 0));
        if (qtyDelta === 0 && costAmount === 0) return;
        out.push({
            lineKey: key,
            sectionNo: ref.sectionNo,
            sort: ref.sort,
            descTh: ref.descTh,
            descEn: boqLineEn(key, ref.descTh),
            unit: ref.unit,
            qtyDelta,
            costMatUnit: ref.matUnit,
            costLabUnit: ref.labUnit,
            costAmount,
        });
    };
    for (const a of after) {
        seen.add(a.lineKey);
        push(a.lineKey, before.get(a.lineKey), a);
    }
    for (const [key, b] of before) if (!seen.has(key)) push(key, b, undefined);
    return out.sort((x, y) => x.sort - y.sort);
}
