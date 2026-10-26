// Oracle-test helpers for the two pipe-run sheets (05 ท่อน้ำทิ้ง_Waste Pipe, 06 ท่อน้ำดี_Water Pipe) — TEST ONLY.
// See docs/rebuild/ORACLE_TESTS.md. Both sheets: B รายการ | C ขนาดท่อ/ชนิด | D แนวราบ | E แนวดิ่ง | F = D + E, rows 5–18.
// The BOQ reads the first rows by position (D<line> = B<n>, E<line> = F<n>), adds 15 % waste, charges labour on the
// gross quantity (L = K × H) and a consumables row (I = pct × Σ J + L of the pipe rows).
//
// Decisions the app applies (src/domain/calculators/waste-pipe/pipe-runs.ts, asserted as exact deltas here):
//  - D5 (unlimited rows): a run past the wired rows is added to the BOQ line whose sample row has the same pipe size
//    (Excel drops it); a run with another or no size reaches no BOQ row (`unlinked`).
//  - D1 (short SUM ranges): Excel's section J / L subtotal leaves out the pipe rows (J95 = SUM(J88:J94),
//    J216 = SUM(J210:J211)); the app's subtotal sums every row. M (SUM over the whole section) is unchanged.
//  - BOQ D: a blank B leaves Excel's D blank; the app keeps the template text (pipeRunsBoqText).
import { expect } from 'vitest';
import type { PipeRun, PipeRunsInput } from '../domain/calculators/waste-pipe/pipe-runs';
import { computeProject, createProject, type ProjectResult } from '../domain/project';
import { type ExcelOracle, type OracleInput } from './excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom } from './oracle-helpers';

const BOQ = 'BOQ (Home)';

export interface PipeRunsSheet {
    calc: string;
    sheet: string;
    firstRow: number;
    capacity: number;
    /** First BOQ row fed by the sheet (E = F firstRow) and the number of wired rows. */
    boqFirstRow: number;
    boqRows: number;
    /** Consumables row and its percentage. */
    consumablesRow: number;
    consumablesPct: number;
    section: number;
    subtotalRow: number;
    /** BOQ rows Excel's J / L subtotal leaves out (D1). */
    shortRangeRows: readonly number[];
    /** Template description of each wired BOQ row (shown by the app when B is blank). */
    templateDesc: readonly string[];
    items: readonly string[];
    /** C dropdown, verbatim (stray spaces included). */
    sizes: readonly string[];
    sample: PipeRunsInput;
    blank: PipeRunsInput;
    freeText: readonly string[];
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
const at = (s: PipeRunsSheet, col: string, i: number) => `${s.sheet}!${col}${s.firstRow + i}`;
const boq = (col: string, row: number) => `${BOQ}!${col}${row}`;

export function pipeRunsExcelInputs(s: PipeRunsSheet, input: PipeRunsInput): Record<string, OracleInput> {
    if (input.runs.length > s.capacity) throw new Error(`${s.sheet} has ${s.capacity} rows`);
    const out: Record<string, OracleInput> = {};
    for (let i = 0; i < s.capacity; i++) {
        const r = input.runs[i];
        out[at(s, 'B', i)] = r && r.label.trim() !== '' ? r.label : null;
        out[at(s, 'C', i)] = r && r.size.trim() !== '' ? r.size : null;
        out[at(s, 'D', i)] = r ? r.horizontal : null;
        out[at(s, 'E', i)] = r ? r.vertical : null;
    }
    return out;
}

/** Pipe size each wired BOQ row is priced for: C of the sample row it reads (workbook values). */
export const lineSizes = (oracle: ExcelOracle, s: PipeRunsSheet): string[] =>
    Array.from({ length: s.boqRows }, (_, k) => { const v = oracle.cached(at(s, 'C', k)); return typeof v === 'string' ? norm(v) : ''; });

/** D5 deltas from Excel's own F of the runs past the wired rows: added to the line of the same size, or unlinked. */
export function d5Deltas(oracle: ExcelOracle, s: PipeRunsSheet, input: PipeRunsInput): { line: number[]; unlinked: number } {
    const sizes = lineSizes(oracle, s);
    const line = sizes.map(() => 0);
    let unlinked = 0;
    input.runs.forEach((r, i) => {
        if (i < s.boqRows) return;
        const f = oracle.num(at(s, 'F', i));
        const j = norm(r.size) === '' ? -1 : sizes.indexOf(norm(r.size));
        if (j >= 0) line[j] = (line[j] ?? 0) + f;
        else unlinked += f;
    });
    return { line, unlinked };
}

export function pipeRunsAppResult(s: PipeRunsSheet, input: PipeRunsInput): ProjectResult {
    const p = createProject();
    p.calculators[s.calc] = input;
    return computeProject(p);
}

export const pipeRunsComparedRefs = (s: PipeRunsSheet): string[] => [
    `${s.sheet}!F${s.firstRow}`, `${s.sheet}!F${s.firstRow + s.capacity - 1}`,
    ...[...Array.from({ length: s.boqRows }, (_, k) => s.boqFirstRow + k), s.consumablesRow, s.subtotalRow]
        .flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => boq(c, r))),
];

export function checkPipeRunsCase(oracle: ExcelOracle, s: PipeRunsSheet, input: PipeRunsInput): void {
    oracle.replaceInputs(pipeRunsExcelInputs(s, input));
    const res = pipeRunsAppResult(s, input);
    const out = res.calcOutputs[s.calc] ?? {};
    const n = (ref: string) => oracle.num(ref);
    const d5 = d5Deltas(oracle, s, input);

    // 1. F = D + E on every row (unused rows 0)
    input.runs.forEach((r, i) => expectClose(r.horizontal + r.vertical, n(at(s, 'F', i)), `F${s.firstRow + i} = D + E`));
    for (let i = input.runs.length; i < s.capacity; i++) expect(n(at(s, 'F', i)), `unused row ${s.firstRow + i}`).toBe(0);

    // 2. every output of compute() (unmapped keys fail)
    const total = oracle.evaluate(`=SUM(F${s.firstRow}:F${s.firstRow + s.capacity - 1})`, s.sheet);
    const expected: Record<string, number> = { total: typeof total === 'number' ? total : NaN, unlinked: d5.unlinked };
    for (let k = 0; k < s.boqRows; k++) expected[`R${s.boqFirstRow + k}`] = n(boq('E', s.boqFirstRow + k)) + (d5.line[k] ?? 0);
    for (const [key, v] of Object.entries(out)) {
        const e = expected[key];
        if (e === undefined) expect.fail(`output ${key} has no Excel mapping`);
        else expectClose(v, e, `output ${key}`);
    }
    expect(Object.keys(out).sort()).toEqual(Object.keys(expected).sort());

    // 3. wired BOQ rows: D = B (blank → the app keeps the template text), E/H/J/L/M exact unless D5 added runs
    let dJ = 0;
    let dL = 0;
    for (let k = 0; k < s.boqRows; k++) {
        const er = s.boqFirstRow + k;
        const key = `R${er}`;
        const row = boqItem(res.boq, key);
        const label = input.runs[k]?.label.trim() ?? '';
        const d = oracle.get(boq('D', er));
        if (label !== '') {
            expect(d, `D${er} = B${s.firstRow + k}`).toBe(label);
            expect(row?.desc, `${key} desc`).toBe(label);
        } else {
            expect(d === null || d === '', `D${er} blank`).toBe(true);
            expect(row?.desc, `${key} desc (template)`).toBe(s.templateDesc[k]);
        }
        const delta = d5.line[k] ?? 0;
        if (delta === 0) { expectBoqRow(oracle, res.boq, key, er); continue; }
        // D5: runs past the wired rows with this line's size; same G / I / K, labour on gross (L = K × H).
        const g = n(boq('G', er));
        expectClose((row?.qty ?? NaN) - n(boq('E', er)), delta, `E${er} − D5 delta`);
        expectClose(row?.grossQty ?? NaN, (row?.qty ?? NaN) * (1 + g), `H${er} = E × (1 + G)`);
        const dj = n(boq('I', er)) * delta * (1 + g);
        const dl = n(boq('K', er)) * delta * (1 + g);
        expectClose((row?.matTotal ?? NaN) - n(boq('J', er)), dj, `J${er} delta = I × Δ × (1 + G)`);
        expectClose((row?.labTotal ?? NaN) - n(boq('L', er)), dl, `L${er} delta = K × Δ × (1 + G)`);
        dJ += dj;
        dL += dl;
    }

    // 4. consumables row: pct × Σ (J + L) of the pipe rows
    const dC = s.consumablesPct * (dJ + dL);
    if (dC === 0) expectBoqRow(oracle, res.boq, `R${s.consumablesRow}`, s.consumablesRow);
    else expectClose((boqItem(res.boq, `R${s.consumablesRow}`)?.total ?? NaN) - n(boq('M', s.consumablesRow)), dC, `M${s.consumablesRow} − pct × D5 delta`);

    // 5. section subtotal: D1 — Excel's J / L leave the pipe rows out, M includes them
    const sec = res.boq.sections.find(x => x.no === s.section);
    const left = (col: string) => s.shortRangeRows.reduce((t, r) => t + n(boq(col, r)), 0);
    expectClose((sec?.matTotal ?? NaN) - n(boq('J', s.subtotalRow)), left('J') + dJ + dC, `J${s.subtotalRow}: app − Excel = pipe rows (D1) + D5 delta`);
    expectClose((sec?.labTotal ?? NaN) - n(boq('L', s.subtotalRow)), left('L') + dL, `L${s.subtotalRow}: app − Excel = pipe rows (D1) + D5 delta`);
    expectClose((sec?.total ?? NaN) - n(boq('M', s.subtotalRow)), dJ + dL + dC, `M${s.subtotalRow} − D5 delta`);
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

export function randomPipeRuns(s: PipeRunsSheet, seed: number): PipeRunsInput {
    const rng = seededRandom(seed);
    const r = rng.next();
    const n = r < 0.1 ? s.capacity : r < 0.15 ? 0 : r < 0.45 ? rng.int(1, s.boqRows) : rng.int(s.boqRows + 1, s.capacity - 1);
    const base = rng.chance(0.5) ? s.sample.runs : [];
    const runs: PipeRun[] = [];
    for (let i = 0; i < n; i++) {
        const sample = base[i];
        const l = rng.next();
        const label = sample && rng.chance(0.7) ? sample.label
            : l < 0.7 ? rng.pick(s.items) : l < 0.85 ? rng.pick(s.freeText) : '';
        const z = rng.next();
        let size = sample && rng.chance(0.6) ? sample.size : z < 0.8 ? rng.pick(s.sizes) : z < 0.9 ? '' : `${rng.pick(s.sizes).trim()}  `;
        if (size !== '' && rng.chance(0.08)) size = ` ${size}`;
        runs.push({
            label, size,
            horizontal: rng.chance(0.1) ? 0 : rng.step(0.1, 40, 0.1),
            vertical: rng.chance(0.25) ? 0 : rng.step(0.1, 8, 0.1),
        });
    }
    return { runs };
}

export const randomPipeRunsCases = (s: PipeRunsSheet, base: number, count = 50): [string, PipeRunsInput][] =>
    Array.from({ length: count }, (_, k): [string, PipeRunsInput] => [`random #${k} (seed ${base + k})`, randomPipeRuns(s, base + k)]);

export function namedPipeRunsCases(s: PipeRunsSheet): [string, PipeRunsInput][] {
    const sample = s.sample.runs;
    const run = (label: string, size: string, horizontal: number, vertical: number): PipeRun => ({ label, size, horizontal, vertical });
    const extraPerLine = sample.map((r, k) => run(r.label, r.size, 3.5 + k, 1.2));
    return [
        ['Excel sample', s.sample],
        ['blank(): the fixed rows with no length', s.blank],
        ['no runs at all', { runs: [] }],
        ['D5: one more run of each line size (added to that line)', { runs: [...sample, ...extraPerLine] }],
        ['D5: runs past the wired rows with an unpriced and a blank size (unlinked)', {
            runs: [...sample, run(s.freeText[0] ?? 'ท่ออื่น', 'PVC 6"', 5, 1), run('', '', 2.5, 0)],
        }],
        [`full sheet: ${s.capacity} runs`, { runs: Array.from({ length: s.capacity }, (_, i) => ({ ...(sample[i % sample.length] ?? run('', '', 0, 0)), horizontal: 1 + i, vertical: 0.5 * i })) }],
        ['wired rows with swapped sizes and a blank label (Excel and the app stay positional)', {
            runs: sample.map((r, i) => ({ ...r, label: i === 0 ? '' : r.label, size: sample[(i + 1) % sample.length]?.size ?? r.size })),
        }],
    ];
}

/** Branches of the comparison a case exercises (for the coverage test). */
export function pipeRunsBranches(oracle: ExcelOracle, s: PipeRunsSheet, input: PipeRunsInput): Set<string> {
    const out = new Set<string>();
    const sizes = lineSizes(oracle, s);
    const n = input.runs.length;
    out.add(n === 0 ? 'no runs' : n <= s.boqRows ? 'only wired rows' : n === s.capacity ? 'full sheet' : 'runs past the wired rows');
    input.runs.forEach((r, i) => {
        if (r.horizontal + r.vertical === 0) out.add('zero length');
        if (r.size !== '' && r.size !== r.size.trim()) out.add('size with stray spaces');
        if (r.label.trim() !== '' && !s.items.some(x => norm(x) === norm(r.label))) out.add('free-text label');
        if (i < s.boqRows) {
            if (r.label.trim() === '') out.add('blank label on a wired row');
            if (norm(r.size) !== sizes[i]) out.add('wired row with another size (positional)');
            return;
        }
        const j = norm(r.size) === '' ? -1 : sizes.indexOf(norm(r.size));
        out.add(j >= 0 ? `D5: added to line ${j + 1}` : norm(r.size) === '' ? 'D5: unlinked (blank size)' : 'D5: unlinked (unpriced size)');
    });
    return out;
}

export const requiredPipeRunsBranches = (s: PipeRunsSheet): string[] => [
    'no runs', 'only wired rows', 'full sheet', 'runs past the wired rows', 'zero length', 'size with stray spaces',
    'free-text label', 'blank label on a wired row', 'wired row with another size (positional)',
    'D5: unlinked (blank size)', 'D5: unlinked (unpriced size)',
    ...Array.from({ length: s.boqRows }, (_, j) => `D5: added to line ${j + 1}`),
].sort();
