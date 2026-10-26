// ─── Document keys: how a Project is split for storage and collaboration ───
// One document per thing a user edits on its own, so two people on different levels never overwrite each other:
//   meta                      the BOQ header (project name, site, owner, …)
//   journey                   which levels are passed / marked "ไม่มีในโครงการนี้"
//   calc:<calculatorId>       one calculator sheet's input
//   boq:<lineKey>             one BOQ (Home) line edited on the BOQ page
//   planning:<sheet>          Man-Day / S-Curve / CashFlow input
import { BOQ_TEMPLATE_V5 } from '../boq/template.v5';
import { CALCULATORS } from '../calculators/registry';

export const PLANNING_SHEETS = ['manday', 'schedule', 'cashflow'] as const;
export type PlanningSheet = (typeof PLANNING_SHEETS)[number];

export type DocKey =
    | 'meta'
    | 'journey'
    | `calc:${string}`
    | `boq:${string}`
    | `planning:${PlanningSheet}`;

export type ParsedDocKey =
    | { kind: 'meta' }
    | { kind: 'journey' }
    | { kind: 'calc'; calcId: string }
    | { kind: 'boq'; lineKey: string }
    | { kind: 'planning'; sheet: PlanningSheet };

const CALC_IDS = new Set(CALCULATORS.map(c => c.id));

/** Every BOQ line key the template has (items, headings, slot fallbacks) and the prefixes of calculator slot rows. */
const BOQ_LINE_KEYS = new Set<string>();
const SLOT_PREFIXES: string[] = [];
for (const s of BOQ_TEMPLATE_V5) {
    for (const l of s.lines) {
        if (l.type === 'slot') {
            SLOT_PREFIXES.push(`${l.calc}:${l.slot}:`);
            for (const f of l.fallback) BOQ_LINE_KEYS.add(f.key);
        } else {
            BOQ_LINE_KEYS.add(l.key);
        }
    }
}

export function isKnownCalculator(id: string): boolean {
    return CALC_IDS.has(id);
}

/** A BOQ line that exists in the template, or a row a calculator slot can produce (`<calc>:<slot>:<row>`). */
export function isKnownBoqLine(key: string): boolean {
    if (BOQ_LINE_KEYS.has(key)) return true;
    return SLOT_PREFIXES.some(p => key.startsWith(p) && key.length > p.length && key.length <= 128);
}

function isPlanningSheet(s: string): s is PlanningSheet {
    return (PLANNING_SHEETS as readonly string[]).includes(s);
}

/** Parses and checks a document key against the shared domain; undefined when it does not name anything real. */
export function parseDocKey(key: string): ParsedDocKey | undefined {
    if (key === 'meta') return { kind: 'meta' };
    if (key === 'journey') return { kind: 'journey' };
    const colon = key.indexOf(':');
    if (colon < 0) return undefined;
    const head = key.slice(0, colon);
    const rest = key.slice(colon + 1);
    if (head === 'calc') return isKnownCalculator(rest) ? { kind: 'calc', calcId: rest } : undefined;
    if (head === 'boq') return isKnownBoqLine(rest) ? { kind: 'boq', lineKey: rest } : undefined;
    if (head === 'planning') return isPlanningSheet(rest) ? { kind: 'planning', sheet: rest } : undefined;
    return undefined;
}

export function isDocKey(key: string): key is DocKey {
    return parseDocKey(key) !== undefined;
}

export const calcDocKey = (calcId: string): DocKey => `calc:${calcId}`;
export const boqDocKey = (lineKey: string): DocKey => `boq:${lineKey}`;
export const planningDocKey = (sheet: PlanningSheet): DocKey => `planning:${sheet}`;
