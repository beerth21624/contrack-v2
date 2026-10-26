// ─── Project = everything the user typed. Results are always recomputed from it. ───
import { computeBoq } from './boq/engine';
import { BOQ_TEMPLATE_V5 } from './boq/template.v5';
import type {
    BoqHeadingTemplate, BoqItemTemplate, BoqLineKey, BoqLineOverride, BoqResult, GrossRule, LinkedValues, PriceRule,
    QtyRule, SlotLines,
} from './boq/types';
import { calculatorsInOrder } from './calculators/registry';
import type { CalculatorDef, SlotRow } from './calculators/types';

/** Gives slot rows project-unique keys (`${calc}:${slot}:${key}`), rewriting references between them. */
function prefixSlotRows(rows: SlotRow[], prefix: string, excelRow: number): (BoqItemTemplate | BoqHeadingTemplate)[] {
    const local = new Set(rows.map(r => r.key));
    const k = (key: string) => (local.has(key) ? `${prefix}${key}` : key);
    const qty = (q: QtyRule): QtyRule => q.kind === 'line' ? { ...q, ref: k(q.ref) }
        : q.kind === 'sumLines' ? { ...q, refs: q.refs.map(k) } : q;
    const gross = (g: GrossRule): GrossRule => (typeof g === 'object' ? { ...g, refs: g.refs.map(k) } : g);
    const price = (p: PriceRule): PriceRule => typeof p === 'number' ? p
        : p.kind === 'linePrice' ? { ...p, ref: k(p.ref) } : { ...p, refs: p.refs.map(k) };
    return rows.map(r => r.type === 'heading'
        ? { ...r, key: k(r.key), excelRow }
        : { ...r, key: k(r.key), excelRow, qty: qty(r.qty), gross: gross(r.gross), mat: price(r.mat), lab: price(r.lab) });
}

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
    const slots: SlotLines = {};
    const slotRow = new Map<string, number>();
    for (const s of BOQ_TEMPLATE_V5) for (const l of s.lines) if (l.type === 'slot') slotRow.set(`${l.calc}.${l.slot}`, l.excelRow);

    for (const def of calculatorsInOrder(calculators)) {
        const input = calculatorInput(project, def);
        const ctx = { outputs: (id: string) => calcOutputs[id] };
        const outputs = def.compute(input, ctx);
        calcOutputs[def.id] = outputs;
        for (const link of def.boqLinks) {
            const v = outputs[link.output];
            if (v === undefined || !Number.isFinite(v)) continue;
            linked[link.line] = { ...linked[link.line], [link.field]: v };
        }
        for (const [line, text] of Object.entries(def.boqText?.(input, ctx) ?? {})) {
            linked[line] = { ...linked[line], ...text };
        }
        for (const [slot, rows] of Object.entries(def.boqSlots?.(input, ctx) ?? {})) {
            const id = `${def.id}.${slot}`;
            slots[id] = prefixSlotRows(rows, `${def.id}:${slot}:`, slotRow.get(id) ?? 0);
        }
    }

    const boq = computeBoq({ sections: BOQ_TEMPLATE_V5, overrides: project.boqOverrides, linked, slots });
    return { calcOutputs, boq };
}
