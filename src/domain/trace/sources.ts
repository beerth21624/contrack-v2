// ─── Generic input classification: ✎ user-entered vs ⚠ hard-coded default, invalid numbers, dependency reads ───
// Works for any calculator input shape: plain fields, nested objects, arrays of rows (rows.0.width), arrays of values.
import type { CalcContext } from '../calculators/types';
import type { TraceInput } from './types';

type Leaf = number | string | boolean;

const isLeaf = (v: unknown): v is Leaf => typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const sameValue = (a: Leaf, b: unknown): boolean =>
    typeof a === typeof b && (a === b || (typeof a === 'number' && Number.isNaN(a) && Number.isNaN(b)));

/**
 * Every leaf value of a calculator input with its source:
 *  - 'default' when it equals the calculator's defaults() value at the same path (a row beyond the sample's
 *    rows is compared with the sample's last row, so a newly added row's pre-filled choices count as defaults);
 *  - 'user' otherwise.
 * `term` is the field name used by the label file: the dotted path without array indexes.
 */
export function classifyInputs(input: unknown, defaults: unknown): TraceInput[] {
    const out: TraceInput[] = [];
    const walk = (value: unknown, ref: unknown, path: string[], term: string[], row: { index: number; field: string } | undefined) => {
        if (isLeaf(value)) {
            const t: TraceInput = {
                path: path.join('.'),
                term: term.join('.'),
                value,
                source: isLeaf(ref) && sameValue(value, ref) ? 'default' : 'user',
            };
            if (isLeaf(ref)) t.defaultValue = ref;
            if (row) { t.row = row.index; t.rowsField = row.field; }
            out.push(t);
            return;
        }
        if (Array.isArray(value)) {
            const refs: unknown[] = Array.isArray(ref) ? (ref as unknown[]) : [];
            (value as unknown[]).forEach((item, i) => {
                const r = refs[i] ?? (isObject(item) ? refs[refs.length - 1] : undefined);
                // The outermost array of objects defines the row; nested arrays keep that row.
                const nextRow = row ?? (isObject(item) ? { index: i, field: path.join('.') } : undefined);
                walk(item, r, [...path, String(i)], term, nextRow);
            });
            return;
        }
        if (isObject(value)) {
            const refObj = isObject(ref) ? ref : {};
            for (const [k, v] of Object.entries(value)) walk(v, refObj[k], [...path, k], [...term, k], row);
        }
    };
    walk(input, defaults, [], [], undefined);
    return out;
}

/** Paths of number inputs that are not finite (the calculators count them as 0). */
export function invalidInputPaths(inputs: readonly TraceInput[]): string[] {
    return inputs.filter(i => typeof i.value === 'number' && !Number.isFinite(i.value)).map(i => i.path);
}

export interface DependencyReads {
    /** Output keys read per dependency step. */
    read: Map<string, Set<string>>;
    /** Values read per `${calc}\u0000${key}` (undefined = missing). */
    values: Map<string, number | undefined>;
    /** Steps asked for that had no outputs. */
    unavailable: Set<string>;
}

/** Wraps a context so every value a calculator reads from another step is recorded (Proxy over its outputs). */
export function recordingContext(ctx: CalcContext): { ctx: CalcContext; reads: DependencyReads } {
    const reads: DependencyReads = { read: new Map(), values: new Map(), unavailable: new Set() };
    const wrapped: CalcContext = {
        outputs(calcId: string) {
            const o = ctx.outputs(calcId);
            if (!reads.read.has(calcId)) reads.read.set(calcId, new Set());
            if (o === undefined) { reads.unavailable.add(calcId); return undefined; }
            const seen = reads.read.get(calcId) ?? new Set<string>();
            return new Proxy(o, {
                get(target, prop, receiver) {
                    const v: unknown = Reflect.get(target, prop, receiver);
                    if (typeof prop === 'string') {
                        seen.add(prop);
                        reads.values.set(`${calcId}\u0000${prop}`, typeof v === 'number' ? v : undefined);
                    }
                    return v;
                },
            });
        },
    };
    return { ctx: wrapped, reads };
}
