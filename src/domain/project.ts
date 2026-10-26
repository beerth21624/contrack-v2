// ─── Project = everything the user typed. Results are always recomputed from it. ───
import { computeBoq } from './boq/engine';
import { BOQ_TEMPLATE_V5 } from './boq/template.v5';
import type { BoqLineKey, BoqLineOverride, BoqResult, LinkedValues } from './boq/types';
import { calculatorsInOrder } from './calculators/registry';
import type { CalculatorDef } from './calculators/types';

export const PROJECT_SCHEMA_VERSION = 1;

/** Header block of BOQ (Home), rows 2–4. */
export interface ProjectMeta {
    projectName: string;   // D2 📂 โครงการ
    siteAddress: string;   // D3 📍 สถานที่ก่อสร้าง
    ownerName: string;     // D4 👤 เจ้าของบ้าน
    revision: string;      // M2 📝 Revision
    documentDate: string;  // M3 📅 Date
    preparedBy: string;    // M4 👤 Prepared By
}

export interface Project {
    schemaVersion: number;
    meta: ProjectMeta;
    /** Input of each calculator sheet, keyed by calculator id. Missing = the Excel sample (defaults). */
    calculators: Record<string, unknown>;
    /** Edits made on the BOQ (Home) page. */
    boqOverrides: Record<BoqLineKey, BoqLineOverride>;
}

export const DEFAULT_PROJECT_META: ProjectMeta = {
    projectName: 'บ้านพักอาศัย คสล. 1 ชั้น',
    siteAddress: '',
    ownerName: '',
    revision: '00',
    documentDate: '',
    preparedBy: '',
};

export function createProject(): Project {
    return {
        schemaVersion: PROJECT_SCHEMA_VERSION,
        meta: { ...DEFAULT_PROJECT_META },
        calculators: {},
        boqOverrides: {},
    };
}

/** A calculator's current input: stored values over its defaults (so newly added fields get a default). */
export function calculatorInput<I>(project: Project, def: CalculatorDef<I>): I {
    const stored = project.calculators[def.id];
    const defaults = def.defaults();
    return stored && typeof stored === 'object' ? { ...defaults, ...(stored as Partial<I>) } : defaults;
}

export interface ProjectResult {
    /** Outputs of every calculator, by calculator id. */
    calcOutputs: Record<string, Record<string, number>>;
    boq: BoqResult;
}

export function computeProject(project: Project, calculators?: CalculatorDef[]): ProjectResult {
    const calcOutputs: Record<string, Record<string, number>> = {};
    const linked: LinkedValues = {};

    for (const def of calculatorsInOrder(calculators)) {
        const outputs = def.compute(calculatorInput(project, def), { outputs: id => calcOutputs[id] });
        calcOutputs[def.id] = outputs;
        for (const link of def.boqLinks) {
            const v = outputs[link.output];
            if (v === undefined || !Number.isFinite(v)) continue;
            linked[link.line] = { ...linked[link.line], [link.field]: v };
        }
    }

    const boq = computeBoq({ sections: BOQ_TEMPLATE_V5, overrides: project.boqOverrides, linked });
    return { calcOutputs, boq };
}
