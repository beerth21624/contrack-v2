// Shared logic of the two pipe-run sheets "ท่อน้ำทิ้ง_Waste Pipe" (05) and "ท่อน้ำดี_Water Pipe" (06).
// Both have the same table: รายการ (B) | ขนาดท่อ/ชนิด (C) | ยาว แนวราบ (D) | ยาว แนวดิ่ง (E) | ยาว รวม (F = D + E).
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §1–§2, §0.3 (positional coupling).
import type { BoqLineKey } from '../../boq/types';

export interface PipeRun {
    label: string;       // B รายการ (dropdown)
    size: string;        // C ขนาดท่อ/ชนิด (dropdown)
    horizontal: number;  // D ยาว แนวราบ (ม.)
    vertical: number;    // E ยาว แนวดิ่ง (ม.)
}

export interface PipeRunsInput {
    /** Rows 5, 6, … of the sheet. Excel has 14 rows; decision D5: unlimited. */
    runs: PipeRun[];
}

/** A BOQ (Home) row fed by the sheet, and the pipe size its typed price / unit are for (Excel sample row). */
export interface PipeBoqLine {
    line: BoqLineKey;
    size: string;
}

const num = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** F = D + E (blank cells count as 0). */
export const runLength = (r: PipeRun) => num(r.horizontal) + num(r.vertical);

/** Dropdown values compared without stray spaces (Excel's `PVC 1" ` has a trailing space). */
export const normalizeSize = (s: string | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');

/**
 * BOQ line each run feeds: index into `lines`, or null.
 * Excel's BOQ reads the first `lines.length` rows by position (E84 = F5, E85 = F6, …), so run i < n feeds line i
 * whatever its size (kept: the sample rows are these positions).
 * A later run (Excel drops it — decision D5: unlimited rows reach the BOQ) is summed into the line priced for the same pipe size
 * (`PipeBoqLine.size`); a run with another (or no) size has no BOQ row.
 */
export function pipeRunTargets(runs: PipeRun[], lines: readonly PipeBoqLine[]): (number | null)[] {
    const sizes = lines.map(l => normalizeSize(l.size));
    return runs.map((r, i) => {
        if (i < lines.length) return i;
        const size = normalizeSize(r.size);
        if (!size) return null;
        const j = sizes.indexOf(size);
        return j >= 0 ? j : null;
    });
}

/**
 * Outputs of a pipe-run sheet: one total length per BOQ line (keyed by the line, e.g. `R84`),
 * `total` (F of every run) and `unlinked` (length of runs that reach no BOQ row).
 */
export function computePipeRuns(input: PipeRunsInput, lines: readonly PipeBoqLine[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const l of lines) out[l.line] = 0;
    let total = 0;
    let unlinked = 0;
    const targets = pipeRunTargets(input.runs, lines);
    input.runs.forEach((r, i) => {
        const len = runLength(r);
        total += len;
        const t = targets[i];
        const line = t === null || t === undefined ? undefined : lines[t]?.line;
        if (line === undefined) unlinked += len;
        else out[line] = (out[line] ?? 0) + len;
    });
    return { ...out, total, unlinked };
}

/** Runs with a length that reach no BOQ row (shown as a note on the page). */
export function unlinkedRuns(input: PipeRunsInput, lines: readonly PipeBoqLine[]): { index: number; size: string; length: number }[] {
    const targets = pipeRunTargets(input.runs, lines);
    return input.runs
        .map((r, index) => ({ index, size: normalizeSize(r.size), length: runLength(r), target: targets[index] }))
        .filter(r => r.target === null && r.length !== 0)
        .map(({ index, size, length }) => ({ index, size, length }));
}

/**
 * Positional runs whose picked size is not the size the BOQ line is priced for (Excel keeps the typed price / unit
 * when the dropdown changes, §0.3) — shown as a note on the page.
 */
export function sizeMismatches(input: PipeRunsInput, lines: readonly PipeBoqLine[]): { index: number; size: string; line: PipeBoqLine }[] {
    return lines.flatMap((line, index) => {
        const size = normalizeSize(input.runs[index]?.size);
        return size && size !== normalizeSize(line.size) ? [{ index, size, line }] : [];
    });
}

/** BOQ D cells: Excel links D84 = B5, D85 = B6, … (blank → the template text). */
export function pipeRunsBoqText(input: PipeRunsInput, lines: readonly PipeBoqLine[]): Record<BoqLineKey, { desc?: string }> {
    const out: Record<BoqLineKey, { desc?: string }> = {};
    lines.forEach((l, i) => {
        const label = (input.runs[i]?.label ?? '').trim();
        if (label) out[l.line] = { desc: label };
    });
    return out;
}

/** The size written at the end of a dropdown item (`ท่อน้ำทิ้งชักโครก PVC 4"` → `PVC 4"`), or ''. */
export function sizeFromLabel(label: string, sizes: readonly string[]): string {
    const l = normalizeSize(label);
    return sizes.find(s => l.endsWith(normalizeSize(s))) ?? '';
}
