// ─── Rendering trace labels: term names, step labels, formulas in words and with numbers ───
// Pure. The UI picks the label set for its locale (labels[locale]) and passes its own number formatter.
import type { CalcTraceLabels, TraceLabelSet, TraceOperandValue, TraceParams, TraceStep } from './types';

export type TraceLocale = keyof CalcTraceLabels;

/** The label set for a locale ('th' for anything that is not English). */
export function traceLabelSet(labels: CalcTraceLabels | undefined, locale: string): TraceLabelSet | undefined {
    if (!labels) return undefined;
    return locale === 'en' ? labels.en : labels.th;
}

/**
 * Looks a key up in a term table: exact key first, then patterns with '*' for one path segment.
 * The segments matched by '*' are returned (numeric ones 1-based) for {0}, {1}… in the text.
 */
function lookup(table: Readonly<Record<string, string>> | undefined, key: string): { text: string; wild: string[] } | undefined {
    if (!table) return undefined;
    const exact = table[key];
    if (exact !== undefined) return { text: exact, wild: [] };
    const parts = key.split('.');
    for (const [pattern, text] of Object.entries(table)) {
        if (!pattern.includes('*')) continue;
        const pp = pattern.split('.');
        if (pp.length !== parts.length) continue;
        const wild: string[] = [];
        let ok = true;
        for (let i = 0; i < pp.length; i++) {
            const p = pp[i];
            const v = parts[i] ?? '';
            if (p === '*') wild.push(/^\d+$/.test(v) ? String(Number(v) + 1) : v);
            else if (p !== v) { ok = false; break; }
        }
        if (ok) return { text, wild };
    }
    return undefined;
}

/** Replaces {name} with params[name] (and {0}, {1}… with wildcard segments). Unknown placeholders stay. */
export function fillParams(text: string, params?: TraceParams, wild: readonly string[] = []): string {
    return text.replace(/\{(\w+)\}/g, (m, name: string) => {
        if (/^\d+$/.test(name)) return wild[Number(name)] ?? m;
        const p = params?.[name];
        return p === undefined ? m : String(p);
    });
}

/** On-screen name of a term (input field, constant, dependency value, output, step id); the key itself when unknown. */
export function termLabel(set: TraceLabelSet | undefined, key: string, params?: TraceParams): string {
    const t = lookup(set?.terms, key);
    if (t) return fillParams(t.text, params, t.wild);
    const s = set?.steps[key];
    if (s) return fillParams(s.label, params);
    return key;
}

/** Unit of a term ('' when none). */
export function termUnit(set: TraceLabelSet | undefined, key: string): string {
    const u = lookup(set?.units, key);
    if (u) return u.text;
    return set?.steps[key]?.unit ?? '';
}

export type NumberFormat = (n: number) => string;

/** Default number text for formulas: up to 4 decimals, no trailing zeros. */
export const plainNumber: NumberFormat = n => (Number.isFinite(n) ? String(Number(n.toFixed(4))) : String(n));

const operandNumbers = (v: TraceOperandValue, fmt: NumberFormat): string => {
    if (typeof v === 'number') return v < 0 ? `(${fmt(v)})` : fmt(v);
    if (v.length === 0) return fmt(0);
    if (v.length === 1) return operandNumbers(v[0] ?? 0, fmt);
    return `(${v.map(x => operandNumbers(x, fmt)).join(' + ')})`;
};

export interface RenderedStep {
    label: string;
    /** The formula with on-screen names. */
    words: string;
    /** The same formula with the numbers put in. */
    numbers: string;
    unit: string;
}

/** Label, formula in words, formula with numbers and unit of a recorded step. */
export function renderStep(set: TraceLabelSet | undefined, step: Pick<TraceStep, 'id' | 'operands' | 'params'>, fmt: NumberFormat = plainNumber): RenderedStep {
    const def = set?.steps[step.id];
    const formula = def?.formula ?? Object.keys(step.operands).map(k => `{${k}}`).join(' , ');
    const sub = (fn: (name: string) => string) => formula.replace(/\{(\w+)\}/g, (m, name: string) => {
        const p = step.params?.[name];
        if (p !== undefined) return String(p);
        return name in step.operands ? fn(name) : m;
    });
    return {
        label: def ? fillParams(def.label, step.params) : step.id,
        words: sub(name => termLabel(set, name, step.params)),
        numbers: sub(name => operandNumbers(step.operands[name] ?? 0, fmt)),
        unit: def?.unit ?? '',
    };
}
