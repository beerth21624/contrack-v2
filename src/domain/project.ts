// ─── Project = everything the user typed. Results are always recomputed from it. ───
import { computeBoq } from './boq/engine';
import { BOQ_TEMPLATE_V5 } from './boq/template.v5';
import type { BoqLineKey, BoqLineOverride, BoqResult, CalcOutputs } from './boq/types';

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
    /** Input of each calculator sheet, keyed by calculator id (filled from phase P1 on). */
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

export interface ProjectResult {
    calcOutputs: CalcOutputs;
    boq: BoqResult;
}

/** Recomputes calculators (none yet in P0) and the BOQ from the project input. */
export function computeProject(project: Project): ProjectResult {
    const calcOutputs: CalcOutputs = {};
    const boq = computeBoq({ sections: BOQ_TEMPLATE_V5, overrides: project.boqOverrides, calcOutputs });
    return { calcOutputs, boq };
}
