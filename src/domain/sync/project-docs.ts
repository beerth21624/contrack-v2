// ─── Project ⇄ documents, validation and summary (shared by the browser and the server) ───
import type { BoqLineOverride } from '../boq/types';
import { JOURNEY_LEVELS } from '../journey/levels';
import type { JourneyProgress } from '../journey/progress';
import { WAGE_SET_LIMITS, type PlanningInput } from '../planning';
import {
    computeProject, createProject, DEFAULT_PROJECT_META, type Project, type ProjectMeta, type ProjectResult,
    type ProjectStart,
} from '../project';
import { reviewFlagProblem, type ReviewFlag } from '../review-flags';
import { PLANNING_SHEETS, boqDocKey, calcDocKey, flagDocKey, parseDocKey, planningDocKey, type DocKey } from './doc-keys';

export interface DocEntry {
    docKey: DocKey;
    /** null = the document is reset to its default (not present in the project). */
    data: unknown;
}

/** JSON with object keys sorted, so equal values always give the same text (for diffs and sizes). */
export function stableStringify(value: unknown): string {
    if (value === undefined) return 'null';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** Size of a document as stored (UTF-8 bytes of its JSON). */
export function docBytes(data: unknown): number {
    return new TextEncoder().encode(stableStringify(data)).length;
}

/** Every document the project currently has (what a user typed). Defaults are not listed. */
export function projectToDocs(project: Project): DocEntry[] {
    const docs: DocEntry[] = [{ docKey: 'meta', data: project.meta }];
    const journey = project.journey ?? {};
    if (Object.keys(journey).length > 0) docs.push({ docKey: 'journey', data: journey });
    for (const [id, input] of Object.entries(project.calculators)) {
        if (input !== undefined) docs.push({ docKey: calcDocKey(id), data: input });
    }
    for (const [key, ov] of Object.entries(project.boqOverrides)) docs.push({ docKey: boqDocKey(key), data: ov });
    for (const sheet of PLANNING_SHEETS) {
        const v = project.planning?.[sheet];
        if (v !== undefined) docs.push({ docKey: planningDocKey(sheet), data: v });
    }
    for (const [id, flag] of Object.entries(project.reviewFlags ?? {})) docs.push({ docKey: flagDocKey(id), data: flag });
    return docs;
}

/** The project with one document set (data) or reset to its default (null). Unknown keys leave it unchanged. */
export function applyDoc(project: Project, docKey: string, data: unknown): Project {
    const parsed = parseDocKey(docKey);
    if (!parsed) return project;
    const reset = data === null || data === undefined;
    switch (parsed.kind) {
        case 'meta':
            return { ...project, meta: reset ? { ...DEFAULT_PROJECT_META } : { ...DEFAULT_PROJECT_META, ...(data as Partial<ProjectMeta>) } };
        case 'journey':
            return { ...project, journey: reset ? {} : { ...(data as JourneyProgress) } };
        case 'calc': {
            const others = Object.entries(project.calculators).filter(([k]) => k !== parsed.calcId);
            return { ...project, calculators: Object.fromEntries(reset ? others : [...others, [parsed.calcId, data]]) };
        }
        case 'boq': {
            const others = Object.entries(project.boqOverrides).filter(([k]) => k !== parsed.lineKey);
            return {
                ...project,
                boqOverrides: Object.fromEntries(reset ? others : [...others, [parsed.lineKey, data as BoqLineOverride]]),
            };
        }
        case 'planning': {
            const others = Object.entries(project.planning ?? {}).filter(([k]) => k !== parsed.sheet);
            const planning = Object.fromEntries(reset ? others : [...others, [parsed.sheet, data]]) as Partial<PlanningInput>;
            return { ...project, planning };
        }
        case 'flag': {
            const others = Object.entries(project.reviewFlags ?? {}).filter(([k]) => k !== parsed.flagId);
            return { ...project, reviewFlags: Object.fromEntries(reset ? others : [...others, [parsed.flagId, data as ReviewFlag]]) };
        }
    }
}

/** Builds the project from its stored documents (the reverse of projectToDocs). */
export function docsToProject(start: ProjectStart, docs: readonly DocEntry[]): Project {
    let project: Project = { ...createProject(start), meta: { ...DEFAULT_PROJECT_META, projectName: '' } };
    for (const d of docs) project = applyDoc(project, d.docKey, d.data);
    return project;
}

/**
 * Documents that differ between two versions of a project: changed or added ones with their new data,
 * removed ones with null. Used by the sync engine after every edit.
 */
export function diffDocs(before: Project, after: Project): DocEntry[] {
    const a = new Map(projectToDocs(before).map(d => [d.docKey, stableStringify(d.data)]));
    const b = new Map(projectToDocs(after).map(d => [d.docKey, d]));
    const out: DocEntry[] = [];
    for (const [key, entry] of b) if (a.get(key) !== stableStringify(entry.data)) out.push(entry);
    for (const key of a.keys()) if (!b.has(key)) out.push({ docKey: key, data: null });
    return out;
}

export type Validation = { ok: true } | { ok: false; reason: string };
const ok: Validation = { ok: true };
const fail = (reason: string): Validation => ({ ok: false, reason });

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const META_FIELDS = new Set<keyof ProjectMeta>(['projectName', 'siteAddress', 'ownerName', 'revision', 'documentDate', 'preparedBy']);
const OVERRIDE_NUMBERS = new Set(['qty', 'waste', 'mat', 'lab']);
const OVERRIDE_TEXTS = new Set(['desc', 'note']);
const LEVEL_IDS = new Set(JOURNEY_LEVELS.map(l => l.id));
const WAGE_SET_FIELDS = new Set(['id', 'name', 'skilled', 'labourer']);

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isWageSetId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= WAGE_SET_LIMITS.maxIdLength;

/** One wage set's rates, if given, are finite numbers (both shapes). */
function checkRates(where: string, v: Record<string, unknown>): Validation {
    for (const k of ['skilled', 'labourer'] as const) {
        if (v[k] !== undefined && !isFiniteNumber(v[k])) return fail(`${where}.${k} must be a finite number`);
    }
    return ok;
}

/**
 * planning:manday — the wage sets as a list [{ id, name, skilled, labourer }] or the older
 * { A: { skilled, labourer }, B: {...} } record; the blocks' wageSet is a set id. Other fields
 * (and partial documents) stay as free as before.
 */
function validateManDayDoc(data: Record<string, unknown>): Validation {
    const { wageSets, blocks } = data;
    if (Array.isArray(wageSets)) {
        if (wageSets.length > WAGE_SET_LIMITS.maxSets) return fail(`at most ${String(WAGE_SET_LIMITS.maxSets)} wage sets`);
        const ids = new Set<string>();
        for (const [i, set] of wageSets.entries()) {
            const where = `wageSets[${String(i)}]`;
            if (!isPlainObject(set)) return fail(`${where} must be an object`);
            for (const k of Object.keys(set)) if (!WAGE_SET_FIELDS.has(k)) return fail(`${where} has unknown field "${k}"`);
            if (!isWageSetId(set.id)) return fail(`${where}.id must be text of 1–${String(WAGE_SET_LIMITS.maxIdLength)} characters`);
            if (ids.has(set.id)) return fail(`wage set "${set.id}" is listed twice`);
            ids.add(set.id);
            if (set.name !== undefined && (typeof set.name !== 'string' || set.name.length > WAGE_SET_LIMITS.maxNameLength)) {
                return fail(`${where}.name must be text up to ${String(WAGE_SET_LIMITS.maxNameLength)} characters`);
            }
            const rates = checkRates(where, set);
            if (!rates.ok) return rates;
        }
    } else if (isPlainObject(wageSets)) {
        // Older shape, keyed by set id.
        for (const [id, set] of Object.entries(wageSets)) {
            if (!isWageSetId(id)) return fail(`a wage set id must be text of 1–${String(WAGE_SET_LIMITS.maxIdLength)} characters`);
            if (!isPlainObject(set)) return fail(`wageSets.${id} must be an object`);
            const rates = checkRates(`wageSets.${id}`, set);
            if (!rates.ok) return rates;
        }
    } else if (wageSets !== undefined) {
        return fail('wageSets must be a list or an object');
    }
    if (blocks !== undefined) {
        if (!isPlainObject(blocks)) return fail('blocks must be an object');
        for (const [id, b] of Object.entries(blocks)) {
            if (!isPlainObject(b)) return fail(`blocks.${id} must be an object`);
            if (b.wageSet !== undefined && !isWageSetId(b.wageSet)) return fail(`blocks.${id}.wageSet must be a wage set id`);
        }
    }
    return ok;
}

/** Checks one document's data against its key (shape only; whether it computes is checked by validateProject). */
export function validateDoc(docKey: string, data: unknown): Validation {
    const parsed = parseDocKey(docKey);
    if (!parsed) return fail(`unknown document "${docKey}"`);
    if (data === null) return ok;
    switch (parsed.kind) {
        case 'meta': {
            if (!isPlainObject(data)) return fail('meta must be an object');
            for (const [k, v] of Object.entries(data)) {
                if (!META_FIELDS.has(k as keyof ProjectMeta)) return fail(`meta has unknown field "${k}"`);
                if (typeof v !== 'string' || v.length > 500) return fail(`meta.${k} must be text up to 500 characters`);
            }
            return ok;
        }
        case 'journey': {
            if (!isPlainObject(data)) return fail('journey must be an object');
            for (const [k, v] of Object.entries(data)) {
                if (!LEVEL_IDS.has(k)) return fail(`journey has unknown level "${k}"`);
                if (v !== 'done' && v !== 'skipped') return fail(`journey.${k} must be "done" or "skipped"`);
            }
            return ok;
        }
        case 'boq': {
            if (!isPlainObject(data)) return fail('a BOQ line edit must be an object');
            const keys = Object.keys(data);
            if (keys.length === 0) return fail('a BOQ line edit must change something (send null to reset)');
            for (const [k, v] of Object.entries(data)) {
                if (OVERRIDE_NUMBERS.has(k)) {
                    if (typeof v !== 'number' || !Number.isFinite(v)) return fail(`${k} must be a finite number`);
                } else if (OVERRIDE_TEXTS.has(k)) {
                    if (typeof v !== 'string' || v.length > 1000) return fail(`${k} must be text up to 1000 characters`);
                } else {
                    return fail(`a BOQ line edit has unknown field "${k}"`);
                }
            }
            return ok;
        }
        case 'calc':
            return isPlainObject(data) ? ok : fail('the document must be an object');
        case 'planning':
            if (!isPlainObject(data)) return fail('the document must be an object');
            return parsed.sheet === 'manday' ? validateManDayDoc(data) : ok;
        case 'flag': {
            const problem = reviewFlagProblem(data);
            return problem === undefined ? ok : fail(problem);
        }
    }
}

/** The project must still compute with finite totals (catches inputs a calculator cannot use). */
export function validateProject(project: Project): Validation {
    let result: ProjectResult;
    try {
        result = computeProject(project);
    } catch (e) {
        return fail(`the project no longer computes: ${e instanceof Error ? e.message : String(e)}`);
    }
    const { constructionTotal, preConstructionTotal, sections } = result.boq;
    if (!Number.isFinite(constructionTotal) || !Number.isFinite(preConstructionTotal)) return fail('the BOQ total is not a number');
    const bad = sections.find(s => !Number.isFinite(s.total));
    return bad ? fail(`section ${String(bad.no)} total is not a number`) : ok;
}

export interface ProjectSummaryValues {
    constructionTotal: number;
    preConstructionTotal: number;
    levelsDone: number;
    levelsTotal: number;
}

/** What project lists show without opening the project. */
export function projectSummary(project: Project, result: ProjectResult = computeProject(project)): ProjectSummaryValues {
    const progress = project.journey ?? {};
    return {
        constructionTotal: result.boq.constructionTotal,
        preConstructionTotal: result.boq.preConstructionTotal,
        levelsDone: JOURNEY_LEVELS.filter(l => progress[l.id] !== undefined).length,
        levelsTotal: JOURNEY_LEVELS.length,
    };
}
