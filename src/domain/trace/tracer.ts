// ─── Tracer: what a calculator's compute() calls to record its calculation steps (docs/dev-mode/README.md §2) ───
// compute(input, ctx, tr = NO_TRACE): with dev mode off nothing passes a tracer, NO_TRACE does nothing and the
// calculator returns exactly what it returned before. The tracer only observes values — it must never change one.
import type { TraceOperandValue, TraceParams, TraceStep } from './types';

export interface StepOptions {
    /** Literal text for {placeholders} in the step label / formula (e.g. { size: 'DB12' }). Also makes the key unique. */
    params?: TraceParams;
}

export interface ConstantOptions {
    params?: TraceParams;
}

export interface Tracer {
    /** false for NO_TRACE: guard expensive trace-only work (`if (tr.enabled) …`). */
    readonly enabled: boolean;
    /**
     * Record one calculation step. `id` is the key into the label file's `steps`; `value` is the value the
     * calculator already computed (pass the variable, never recompute it); `operands` are the values put into
     * the formula's {placeholders}.
     */
    step(id: string, value: number, operands: Readonly<Record<string, TraceOperandValue>>, opts?: StepOptions): void;
    /**
     * Record a hard-coded constant of the formula (🔒, not editable on screen), e.g. the 0.40 m excavation margin.
     * Recorded once per id + params; `id` is a term of the label file.
     */
    constant(id: string, value: number, opts?: ConstantOptions): void;
    /** Run `fn` with steps attributed to row `index` (0-based), shown as `label` (e.g. the footing name). */
    row<T>(index: number, label: string, fn: () => T): T;
}

/** The tracer used when dev mode is off: records nothing, costs nothing. */
export const NO_TRACE: Tracer = {
    enabled: false,
    step: () => undefined,
    constant: () => undefined,
    row: (_index, _label, fn) => fn(),
};

export interface RecordedConstant {
    key: string;
    id: string;
    value: number;
    params?: TraceParams;
}

const paramSuffix = (params: TraceParams | undefined): string =>
    params === undefined ? '' : Object.values(params).map(v => `.${v}`).join('');

/** A tracer that keeps everything it is given (used by runTrace). */
export class RecordingTracer implements Tracer {
    readonly enabled = true;
    readonly steps: TraceStep[] = [];
    readonly constants: RecordedConstant[] = [];
    private readonly seenSteps = new Set<string>();
    private readonly seenConstants = new Set<string>();
    private current: { index: number; label: string } | undefined;

    step(id: string, value: number, operands: Readonly<Record<string, TraceOperandValue>>, opts?: StepOptions): void {
        const base = `${id}${paramSuffix(opts?.params)}`;
        const key = this.current === undefined ? base : `row.${this.current.index}.${base}`;
        // A calculator may evaluate the same row twice (e.g. totals then outputs): keep the first record only.
        if (this.seenSteps.has(key)) return;
        this.seenSteps.add(key);
        const s: TraceStep = { key, id, value, operands: { ...operands } };
        if (opts?.params !== undefined) s.params = opts.params;
        if (this.current !== undefined) { s.row = this.current.index; s.rowLabel = this.current.label; }
        this.steps.push(s);
    }

    constant(id: string, value: number, opts?: ConstantOptions): void {
        const key = `${id}${paramSuffix(opts?.params)}`;
        if (this.seenConstants.has(key)) return;
        this.seenConstants.add(key);
        const c: RecordedConstant = { key, id, value };
        if (opts?.params !== undefined) c.params = opts.params;
        this.constants.push(c);
    }

    row<T>(index: number, label: string, fn: () => T): T {
        const prev = this.current;
        this.current = { index, label };
        try { return fn(); } finally { this.current = prev; }
    }
}
