// ─── Project = everything the user typed. Results are always recomputed from it. ───
import { computeBoq } from './boq/engine';
import { BOQ_TEMPLATE_V5 } from './boq/template.v5';
import type {
    BoqHeadingTemplate, BoqItemTemplate, BoqLineKey, BoqLineOverride, BoqResult, BoqSectionTemplate, GrossRule,
    LinkedValues, PriceRule, QtyRule, SlotLines,
} from './boq/types';
import { calculatorsInOrder } from './calculators/registry';
import type { CalculatorDef, SlotRow } from './calculators/types';
import { blankPlanningInput, computePlanning, resolvePlanningInput, type PlanningInput, type PlanningResult } from './planning';
import { JOURNEY_LEVELS } from './journey/levels';
import type { JourneyProgress } from './journey/progress';

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
    /** Man-Day / S-Curve / CashFlow inputs. Missing parts = the Excel sample (see resolvePlanningInput). */
    planning?: Partial<PlanningInput>;
    /**
     * What untouched calculators start from: 'blank' (a real project, filled from its plan) or 'sample' (the
     * Excel v5 training house). Missing = 'sample', so projects saved before this field keep their numbers.
     */
    start?: ProjectStart;
    /** Levels of the guided journey passed or marked "ไม่มีในโครงการนี้". Missing = none yet. */
    journey?: JourneyProgress;
}

export type ProjectStart = 'blank' | 'sample';

export const DEFAULT_PROJECT_META: ProjectMeta = {
    projectName: 'บ้านพักอาศัย คสล. 1 ชั้น',
    siteAddress: '',
    ownerName: '',
    revision: '00',
    documentDate: '',
    preparedBy: '',
};

/** A new project. Without an argument it is the Excel v5 sample house (what the golden tests check). */
export function createProject(start: ProjectStart = 'sample'): Project {
    return {
        schemaVersion: PROJECT_SCHEMA_VERSION,
        meta: { ...DEFAULT_PROJECT_META, projectName: start === 'blank' ? '' : DEFAULT_PROJECT_META.projectName },
        calculators: {},
        boqOverrides: {},
        start,
        journey: {},
    };
}

/** What a calculator shows before the user types anything: empty for a blank project, else the Excel sample. */
export function calculatorBase<I>(project: Project, def: CalculatorDef<I>): I {
    return project.start === 'blank' && def.blank ? def.blank() : def.defaults();
}

/** A calculator's current input: stored values over its base (so newly added fields get a default). */
export function calculatorInput<I>(project: Project, def: CalculatorDef<I>): I {
    const stored = project.calculators[def.id];
    const base = calculatorBase(project, def);
    return stored && typeof stored === 'object' ? { ...base, ...(stored as Partial<I>) } : base;
}

/** Planning input as shown and computed: stored values over the sample plan (a blank project drops the sample's progress tracking). */
export function projectPlanningInput(project: Project): PlanningInput {
    return resolvePlanningInput(project.planning, project.start === 'blank' ? blankPlanningInput() : undefined);
}

/** Item line keys of BOQ (Home) sections (a BOQ-typed journey level). */
function boqItemKeys(sections: number[]): BoqLineKey[] {
    return BOQ_TEMPLATE_V5.filter(s => sections.includes(s.no)).flatMap(s => s.lines.flatMap(l => (l.type === 'item' ? [l.key] : [])));
}

/** Journey levels marked "ไม่มีในโครงการนี้": their calculators and extra lines put nothing into the BOQ. */
function skippedWork(project: Project): { calcs: Set<string>; lines: Set<BoqLineKey> } {
    const progress = project.journey ?? {};
    const levels = JOURNEY_LEVELS.filter(l => progress[l.id] === 'skipped');
    return {
        calcs: new Set(levels.flatMap(l => (l.kind.type === 'calc' ? [l.kind.calc] : []))),
        lines: new Set(levels.flatMap(l => [
            ...(l.extraRows ?? []),
            // A level typed straight into BOQ rows (column plates): skipping it zeroes those rows' quantities.
            ...(l.kind.type === 'boq' ? boqItemKeys(l.kind.sections) : []),
        ])),
    };
}

/**
 * A blank project starts with no quantity on the BOQ rows typed directly in a journey level (e.g. column
 * plates); the Excel sample counts would otherwise show up as money nobody entered.
 */
const BLANK_TEMPLATE_V5: BoqSectionTemplate[] = (() => {
    const typed = new Set(JOURNEY_LEVELS.flatMap(l => (l.kind.type === 'boq' ? l.kind.sections : [])));
    return BOQ_TEMPLATE_V5.map(s => (!typed.has(s.no) ? s : {
        ...s,
        lines: s.lines.map(l => (l.type === 'item' && l.qty.kind === 'input' ? { ...l, qty: { kind: 'input', value: 0 } } : l)),
    }));
})();

/** Drops the quantity the user typed on the BOQ page for lines that must be 0 (skipped work). */
function withoutQtyOverrides(overrides: Project['boqOverrides'], lines: Set<BoqLineKey>): Project['boqOverrides'] {
    if (lines.size === 0) return overrides;
    return Object.fromEntries(Object.entries(overrides).flatMap(([key, ov]) => {
        if (!lines.has(key)) return [[key, ov]];
        const rest = Object.fromEntries(Object.entries(ov).filter(([f]) => f !== 'qty')) as BoqLineOverride;
        return Object.keys(rest).length === 0 ? [] : [[key, rest]];
    }));
}

export interface ProjectResult {
    /** Outputs of every calculator, by calculator id. */
    calcOutputs: Record<string, Record<string, number>>;
    boq: BoqResult;
    /** Man-Day_Basic, S-Curve_Plan_Basic and CashFLOW_Basic, computed from the BOQ. */
    planning: PlanningResult;
}

export function computeProject(project: Project, calculators?: CalculatorDef[]): ProjectResult {
    const calcOutputs: Record<string, Record<string, number>> = {};
    const linked: LinkedValues = {};
    const slots: SlotLines = {};
    const slotRow = new Map<string, number>();
    for (const s of BOQ_TEMPLATE_V5) for (const l of s.lines) if (l.type === 'slot') slotRow.set(`${l.calc}.${l.slot}`, l.excelRow);
    const skipped = skippedWork(project);
    // Lines forced to quantity 0 by "ไม่มีในโครงการนี้" (a quantity typed on the BOQ page must not bring them back).
    const zeroed = new Set(skipped.lines);

    for (const def of calculatorsInOrder(calculators)) {
        const input = calculatorInput(project, def);
        const ctx = { outputs: (id: string) => calcOutputs[id] };
        if (skipped.calcs.has(def.id)) {
            // "ไม่มีในโครงการนี้": every output 0, every BOQ line it fills gets quantity 0, its slots stay empty.
            calcOutputs[def.id] = Object.fromEntries(Object.keys(def.compute(input, ctx)).map(k => [k, 0]));
            for (const link of def.boqLinks) zeroed.add(link.line);
            for (const slot of Object.keys(def.boqSlots?.(input, ctx) ?? {})) slots[`${def.id}.${slot}`] = [];
            continue;
        }
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

    for (const line of zeroed) linked[line] = { ...linked[line], qty: 0 };

    const boq = computeBoq({
        sections: project.start === 'blank' ? BLANK_TEMPLATE_V5 : BOQ_TEMPLATE_V5,
        overrides: withoutQtyOverrides(project.boqOverrides, zeroed),
        linked,
        slots,
    });
    const planning = computePlanning(projectPlanningInput(project), boq);
    return { calcOutputs, boq, planning };
}
