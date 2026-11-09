// ─── Dev mode ("calculation check mode") trace types (docs/dev-mode/README.md) ───
// A trace explains where a number comes from: the inputs (with their source), the calculation steps (formula in words
// and with numbers), and where the outputs go (BOQ lines, other steps). Pure data — the UI renders it with the
// calculator's label file (CalcTraceLabels) and the 'devMode' messages.
// User-facing rule: never mention the spreadsheet (no sheet names, column letters or row numbers). BOQ lines are
// shown by item number + description.
import type { BoqLineKey } from '../boq/types';

/**
 * Where an input value comes from.
 *  - user        ✎ typed by the user
 *  - default     ⚠ hard-coded default: editable, but still equal to the calculator's defaults() value
 *  - constant    🔒 hard-coded constant inside the formula (not editable on screen), recorded by tr.constant()
 *  - dependency  ← output of another step (read through ctx.outputs)
 */
export type TraceSourceKind = 'user' | 'default' | 'constant' | 'dependency';

/** Literal text substituted into a label / formula placeholder (e.g. the bar size 'DB12'). */
export type TraceParams = Readonly<Record<string, string | number>>;

export interface TraceInput {
    /**
     * Path in the calculator input ('rows.0.width', 'price'), `const:<key>` for a constant,
     * `dep:<calc>:<output>` for a dependency value.
     */
    path: string;
    /**
     * Term id for the label file: the field name for inputs ('width'; rows use the field name without index),
     * the constant id, or the dependency output key.
     */
    term: string;
    value: number | string | boolean;
    source: TraceSourceKind;
    /** 0-based row index for inputs inside an array of rows. */
    row?: number;
    /** Name of the array field the row belongs to ('rows'). */
    rowsField?: string;
    /** For source 'dependency'. */
    from?: { calc: string; output: string };
    /** The calculator's defaults() value at this path (source 'default' / 'user'), when there is one. */
    defaultValue?: number | string | boolean;
    params?: TraceParams;
}

/** A value substituted into a formula: one number, or several (a Σ over rows) shown as "a + b + c". */
export type TraceOperandValue = number | readonly number[];

export interface TraceStep {
    /** Unique within the trace: `row.<i>.<id>` inside a row, `<id>` or `<id>.<params…>` otherwise. */
    key: string;
    /** Step id = key into the label file's `steps` (label, formula, unit). */
    id: string;
    value: number;
    /** Values of the formula placeholders, by term name. */
    operands: Readonly<Record<string, TraceOperandValue>>;
    params?: TraceParams;
    /** 0-based row index; undefined for totals. */
    row?: number;
    /** What the row is called on screen (e.g. the footing name 'F1'); undefined for totals. */
    rowLabel?: string;
}

/** A BOQ cell an output fills. */
export interface TraceBoqLink {
    line: BoqLineKey;
    field: 'qty' | 'mat' | 'lab';
    itemNo?: string;
    desc: string;
    unit?: string;
    /** A BOQ page edit replaces this output (the cell shows the edit). */
    overridden: boolean;
    /** The output reached the cell (false when it was not a finite number, or the step was skipped). */
    applied: boolean;
}

/** A BOQ row the calculator supplies itself (variable runs such as rebar sizes). */
export interface TraceSlotRow {
    slot: string;
    /** Project-unique key of the BOQ row (`${calc}:${slot}:${rowKey}`). */
    line: BoqLineKey;
    itemNo?: string;
    desc: string;
    unit: string;
    qty: number | null;
}

export interface TraceOutput {
    key: string;
    value: number;
    links: TraceBoqLink[];
    /** Steps that read this output (found by running them with a recording context). */
    usedBy: string[];
}

export interface TraceDependency {
    calc: string;
    /** false = that step has no outputs yet: every value read from it counts as 0. */
    available: boolean;
    /** Output keys this step read from it. */
    read: string[];
}

export type TraceWarning =
    /** Hard-coded defaults still in use (paths of the inputs). */
    | { kind: 'defaultsInUse'; paths: string[] }
    /** A dependency step has no outputs yet, or lacks the value read (→ 0). */
    | { kind: 'dependencyMissing'; calc: string; outputs: string[] }
    /** Input values that were not valid numbers (NaN / Infinity) and are counted as 0. */
    | { kind: 'invalidInput'; paths: string[] }
    /** Outputs that are not finite numbers: the BOQ line keeps its template value instead. */
    | { kind: 'invalidOutput'; outputs: string[] }
    /** A BOQ page edit replaces this output on the BOQ line. */
    | { kind: 'boqOverride'; output: string; line: BoqLineKey; field: 'qty' | 'mat' | 'lab'; itemNo?: string; desc: string }
    /** The step is marked "not in this project": its outputs are 0 and its BOQ lines get quantity 0. */
    | { kind: 'skipped' };

export interface CalcTrace {
    calcId: string;
    /** false = the calculator does not record steps yet (inputs, outputs, links and warnings are still there). */
    instrumented: boolean;
    inputs: TraceInput[];
    steps: TraceStep[];
    outputs: TraceOutput[];
    slotRows: TraceSlotRow[];
    deps: TraceDependency[];
    /** Steps that list this one in their deps. */
    dependents: string[];
    warnings: TraceWarning[];
}

// ─── Labels (one file per calculator, e.g. footing/trace.labels.ts) ─────────

export interface TraceStepLabel {
    /** What the value is, e.g. 'พื้นที่หลุมขุด'. May use {param} placeholders. */
    label: string;
    /**
     * The formula with {term} placeholders, e.g. '({width} + 2 × {margin}) × ({length} + 2 × {margin})'.
     * Rendered twice: terms → on-screen names (formula in words) and terms → numbers.
     */
    formula: string;
    unit?: string;
}

export interface TraceLabelSet {
    /**
     * Names of inputs, constants, dependency values and outputs as shown on screen. Keys may use '*' for one
     * dynamic path segment ('rebar.*', 'row.*.width'); the matched segments are {0}, {1}… in the text (numeric
     * segments are shown 1-based).
     */
    terms: Readonly<Record<string, string>>;
    steps: Readonly<Record<string, TraceStepLabel>>;
    /** Units of terms (inputs, constants, outputs), same key rules as `terms`. */
    units?: Readonly<Record<string, string>>;
}

export interface CalcTraceLabels {
    th: TraceLabelSet;
    en: TraceLabelSet;
}

// ─── BOQ cell explanation (explainBoq) ──────────────────────────────────────

/** Where a step output reached the BOQ from. */
export interface BoqLinkOrigin {
    calc: string;
    output: string;
}

/** Where a line's net quantity comes from (same precedence as computeBoq). */
export type BoqNetSource =
    | { kind: 'override' }                                         // edited on the BOQ page
    | { kind: 'calc'; calc?: string; output?: string }             // step output
    | { kind: 'skipped'; calc?: string }                           // forced to 0: "not in this project"
    | { kind: 'slot'; calc: string; slot: string }                 // a row the step supplied itself
    | { kind: 'template' }                                         // hard-coded template value
    | { kind: 'line'; ref: BoqLineKey; factor: number; refValue: number }
    | { kind: 'sumLines'; refs: { line: BoqLineKey; value: number }[] }
    | { kind: 'none' };                                            // the line has no net quantity

export type BoqGrossExplanation =
    | { kind: 'none' }
    | { kind: 'std'; net: number; waste: number }
    /** round up to a whole number */
    | { kind: 'ceilInt'; net: number; waste: number; unrounded: number }
    /** round up to 0.25, at least 1 (0 when there is no quantity) */
    | { kind: 'concrete'; net: number; waste: number; unrounded: number }
    /** Σ gross (or net) of other lines × ratio */
    | { kind: 'tieWire'; refs: { line: BoqLineKey; value: number }[]; ratio: number };

export type BoqPriceSource =
    | { kind: 'override' }
    | { kind: 'calc'; calc?: string; output?: string }
    | { kind: 'slot'; calc: string; slot: string }                 // price set by the step's own row
    | { kind: 'template' }                                         // hard-coded unit price in the BOQ template
    | { kind: 'linePrice'; ref: BoqLineKey; factor: number; refValue: number }
    | { kind: 'consumables'; refs: { line: BoqLineKey; value: number }[]; pct: number };

export interface BoqPriceExplanation {
    unit: number;
    source: BoqPriceSource;
    /** A value that was not a finite number was counted as 0. */
    cleaned: boolean;
    basis: 'net' | 'gross';
    basisValue: number;
    total: number;
}

export interface BoqLineExplanation {
    key: BoqLineKey;
    section: number;
    itemNo?: string;
    desc: string;
    unit: string;
    net: { value: number; source: BoqNetSource; cleaned: boolean };
    waste: { value: number; source: 'override' | 'template' };
    gross: { value: number | null; rule: BoqGrossExplanation };
    mat: BoqPriceExplanation;
    lab: BoqPriceExplanation;
    total: number;
}

/** Number cells of a BOQ line that can be explained. */
export type BoqCellField = 'qty' | 'waste' | 'gross' | 'matUnit' | 'matTotal' | 'labUnit' | 'labTotal' | 'total';

export interface BoqCellExplanation {
    line: BoqLineExplanation;
    field: BoqCellField;
    value: number | null;
}

export interface BoqExplanation {
    lines: Record<BoqLineKey, BoqLineExplanation>;
    /** Item line keys in BOQ order. */
    order: BoqLineKey[];
}
