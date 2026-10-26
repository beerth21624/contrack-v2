// ─── Calculator sheets ───────────────────────────────────────────────────────
// One calculator = one Excel calculator sheet (e.g. "ค่าตรวจสอบที่ดิน", "ฐานราก_Footing").
// It turns its own input into named outputs, and declares which BOQ (Home) cells those outputs fill.

import type { BoqHeadingTemplate, BoqItemTemplate, BoqLineKey } from '../boq/types';

/** A row a calculator supplies for a BOQ slot. `key` must be unique and stable within the slot. */
export type SlotRow = Omit<BoqItemTemplate, 'excelRow'> | Omit<BoqHeadingTemplate, 'excelRow'>;

/** Which BOQ cell a calculator output fills. */
export interface BoqLink {
    line: BoqLineKey;                // e.g. 'R9'
    field: 'qty' | 'mat' | 'lab';    // Excel E, I or K of that row
    output: string;                  // key in the calculator's outputs
}

export interface CalcContext {
    /** Outputs of another calculator (must be listed in `deps`). Undefined if it has none yet. */
    outputs(calcId: string): Record<string, number> | undefined;
}

export interface CalculatorDef<I = unknown> {
    id: string;
    /** Excel sheet the calculator mirrors (verbatim). */
    sheetName: string;
    title: string;
    titleEn: string;
    /** BOQ (Home) sections this calculator feeds. */
    sections: number[];
    /** Calculators whose outputs this one reads. */
    deps: string[];
    // Method signatures (not arrow properties) so calculators with different input types
    // can share one registry array.
    /** Excel v5 sample input — used as the initial value and in golden tests. */
    defaults(): I;
    /**
     * Input for a project started from scratch: everything read off the plan (sizes, lengths, counts, rows)
     * empty, while prices, waste and spec choices keep the Excel values. Without it a blank project uses `defaults()`.
     */
    blank?(): I;
    /** Pure: same input → same outputs. Outputs are plain numbers keyed by name. */
    compute(input: I, ctx: CalcContext): Record<string, number>;
    boqLinks: BoqLink[];
    /** Optional text for BOQ cells (description D / unit F / note N), e.g. a pile spec built from the inputs. */
    boqText?(input: I, ctx: CalcContext): Record<BoqLineKey, { desc?: string; note?: string; unit?: string }>;
    /**
     * Rows for the BOQ slots this calculator owns (see BoqSlotTemplate in boq/types.ts), keyed by slot name.
     * Row keys are prefixed with `${calcId}:${slot}:` by the project so they stay unique.
     */
    boqSlots?(input: I, ctx: CalcContext): Record<string, SlotRow[]>;
}

/** Helper that keeps the input type when registering. */
export function defineCalculator<I>(def: CalculatorDef<I>): CalculatorDef<I> {
    return def;
}
