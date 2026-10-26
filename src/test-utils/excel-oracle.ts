// ─── Excel formula oracle (TEST ONLY) ────────────────────────────────────────
// Evaluates the real formulas of the Excel v5 workbook headlessly, so a calculator's `compute()` can be compared
// with Excel on any input — not only on the sample values cached in the file. See docs/rebuild/ORACLE_TESTS.md.
//
// Never import this from app code: it pulls in HyperFormula (GPLv3, used here under `licenseKey: 'gpl-v3'` for
// tests only — it is a devDependency and is never shipped) and reads the fixture from disk.
// `excel-oracle.test.ts` fails if anything outside tests imports it.
//
// How the workbook is loaded:
// - every sheet with exceljs: values, formulas (shared formulas expanded by exceljs), cached results;
//   merged-cell slaves are skipped (exceljs repeats the master's value in them).
// - formulas are rewritten for HyperFormula where Excel/Google Sheets syntax differs:
//   · LET(name, value, …, body) → body with the names substituted (HyperFormula has no LET);
//   · INDEX(range, r, 0) ("whole row") → INDEX(range, r, {1,2,…,width}); INDEX(oneRow, n) → INDEX(oneRow, 1, n);
//   · a criterion pointing at an empty cell counts as 0 (Excel), not an error (HyperFormula);
//   · shared formulas are expanded here (exceljs's own expansion shifts text inside string literals);
//   · ROUND/ROUNDUP/ROUNDDOWN round their argument to 15 significant digits first, as Excel does;
//   · ROW/COLUMN of a multi-cell range → SEQUENCE(…) (an array, as in Excel 365 / Google Sheets);
//   · PRODUCT(IF(…,blank)…) skips the blank, as Google Sheets does (the toilet sheet relies on it).
// - text constants are trimmed (whitespace-only text such as " " is kept): the cached Google Sheets results match
//   "บานอลูมิเนียม " against "บานอลูมิเนียม" (FILTER, SUMIF), HyperFormula would not. Text compares trimmed.
//   · line breaks outside strings → spaces; 1E-12 → (1*10^(-12)) (HyperFormula has no scientific notation).
// - Google-Sheets exports: the file was made in Google Sheets, which saves formulas Excel lacks as
//   `IFERROR(__xludf.DUMMYFUNCTION("<gsheets formula>"), <cached value>)` and the cells an array spilled into as
//   `…DUMMYFUNCTION("""COMPUTED_VALUE""")…`. Real Excel shows the frozen cached value; the oracle instead evaluates
//   the Google Sheets formula (REGEXEXTRACT is provided as a custom function). Array results (FILTER/TRANSPOSE) are
//   evaluated in a scratch sheet and copied into the anchor + its COMPUTED_VALUE cells after each recalculation
//   (HyperFormula reserves the predicted, larger spill area, which the next BOQ row would block). A result longer
//   than the Excel rows reserved for it makes the anchor `#SPILL!` (Google Sheets shows #REF!) — see `spillOverflows`.
// - Anything HyperFormula cannot parse or does not know (#ERROR! / #NAME?) is frozen to its cached value and listed
//   in `fallbacks`; `frozenPrecedents(ref)` tells whether a cell you compare depends on one.
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import {
    CellError, DetailedCellError, ErrorType, FunctionArgumentType, FunctionPlugin, HyperFormula,
    type CellValue, type ConfigParams, type RawCellContent, type SimpleCellAddress,
} from 'hyperformula';

/** The Excel v5 workbook (read-only copy of the owner's Training Edition v5). */
export const V5_FIXTURE = fileURLToPath(new URL('../../scripts/excel/fixtures/v5.xlsx', import.meta.url));

/**
 * Default tolerance of oracle comparisons: |a − b| ≤ max(1e-6, 1e-9·|b|). The relative part is needed because the
 * xlsx (exported by Google Sheets) caches about 10 significant digits (104693.0694 for 104693.069444).
 */
export const ORACLE_TOLERANCE = 1e-6;
export const ORACLE_RELATIVE_TOLERANCE = 1e-9;

/** True when two numbers agree within the oracle tolerance. */
export function closeTo(a: number, b: number, tol = ORACLE_TOLERANCE, rel = ORACLE_RELATIVE_TOLERANCE): boolean {
    return Math.abs(a - b) <= Math.max(tol, rel * Math.abs(b));
}

export interface OracleError { error: string; message?: string }
export type OracleValue = number | string | boolean | null | OracleError;
export type OracleInput = number | string | boolean | null;

/**
 * A formula typed into an input cell, as a user would (`=E6`, `=K7`, `=2.4+9.2+6.6`, `=(4.7+6.45)/COS(RADIANS(40))`),
 * or `formula: null` to empty it. Unlike a plain value it may replace a cell's own formula: several yellow input
 * cells hold a default link (Roofing E5 `=K7`, E12 `=E6`; Roof Structure E14 `='มุงหลังคา_Roofing'!K7`).
 * References without a sheet resolve on the cell's own sheet.
 */
export interface OracleFormula { formula: string | null }
/** What setInputs / replaceInputs accept for one cell. */
export type OracleCellInput = OracleInput | OracleFormula;
export const isOracleFormula = (v: OracleCellInput): v is OracleFormula => typeof v === 'object' && v !== null;

export const isOracleError = (v: OracleValue): v is OracleError => typeof v === 'object' && v !== null;

/** Why a cell is not evaluated live (it keeps the value cached in the workbook). */
export interface OracleFallback {
    ref: string;
    kind: 'gsheets-frozen' | 'spill-frozen' | 'unsupported';
    reason: string;
    formula?: string;
}

export interface SpillOverflow { ref: string; room: number; needed: number }

type CellKind = 'value' | 'formula' | 'gsheets' | 'gsheets-array' | 'gsheets-spill';

interface CellRecord {
    ref: string;
    sheet: string;
    sheetId: number;
    row: number;   // 0-based
    col: number;   // 0-based
    kind: CellKind;
    /** Formula as stored in the xlsx (without '='). */
    excelFormula?: string;
    /** Formula handed to HyperFormula (with '='). */
    hfFormula?: string;
    /** Value cached in the xlsx (formula result, or the constant). */
    cached: OracleValue;
    hasCached: boolean;
    /** Content the engine starts from (after freezing fallbacks) — what reset() restores. */
    baseline: RawCellContent;
    frozen?: boolean;
}

interface SpillAnchor {
    rec: CellRecord;
    scratchSheet: string;
    /** The anchor followed by its COMPUTED_VALUE cells, in spill order. */
    area: CellRecord[];
    direction: 'down' | 'right';
    live: boolean;
}

// ─── Addresses ───────────────────────────────────────────────────────────────

export function colToIndex(letters: string): number {
    let n = 0;
    for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
}

export function indexToCol(index: number): string {
    let s = '';
    let n = index + 1;
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

/** `Sheet!C5` or `'Sheet name'!$C$5` → sheet name + 0-based row/col. */
export function parseRef(ref: string): { sheet: string; row: number; col: number } {
    const bang = ref.lastIndexOf('!');
    if (bang < 0) throw new Error(`excel-oracle: reference needs a sheet: ${ref}`);
    let sheet = ref.slice(0, bang);
    if (sheet.startsWith("'") && sheet.endsWith("'")) sheet = sheet.slice(1, -1).replace(/''/g, "'");
    const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref.slice(bang + 1).trim());
    if (!m?.[1] || !m[2]) throw new Error(`excel-oracle: bad cell address in ${ref}`);
    return { sheet, row: Number(m[2]) - 1, col: colToIndex(m[1]) };
}

const refKey = (sheet: string, row: number, col: number) => `${sheet}!${indexToCol(col)}${row + 1}`;
const quoteSheet = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

// ─── Formula text helpers (strings and quoted sheet names are never touched) ──

interface Segment { text: string; code: boolean }

/** Splits a formula into code and literal parts ("strings" and 'sheet names'). */
function segments(f: string): Segment[] {
    const out: Segment[] = [];
    let i = 0;
    let code = '';
    while (i < f.length) {
        const ch = f.charAt(i);
        if (ch === '"' || ch === "'") {
            if (code) { out.push({ text: code, code: true }); code = ''; }
            let j = i + 1;
            while (j < f.length) {
                if (f.charAt(j) === ch) {
                    if (f.charAt(j + 1) === ch) { j += 2; continue; }
                    break;
                }
                j++;
            }
            out.push({ text: f.slice(i, j + 1), code: false });
            i = j + 1;
        } else {
            code += ch;
            i++;
        }
    }
    if (code) out.push({ text: code, code: true });
    return out;
}

const mapCode = (f: string, fn: (code: string) => string) =>
    segments(f).map(s => (s.code ? fn(s.text) : s.text)).join('');

/** Index of the ')' closing the '(' at `open`, respecting strings, sheet names and braces. */
function closingParen(f: string, open: number): number {
    let depth = 0;
    let i = open;
    while (i < f.length) {
        const ch = f.charAt(i);
        if (ch === '"' || ch === "'") {
            let j = i + 1;
            while (j < f.length) {
                if (f.charAt(j) === ch) {
                    if (f.charAt(j + 1) === ch) { j += 2; continue; }
                    break;
                }
                j++;
            }
            i = j + 1;
            continue;
        }
        if (ch === '(' || ch === '{') depth++;
        else if (ch === ')' || ch === '}') {
            depth--;
            if (depth === 0) return i;
        }
        i++;
    }
    return -1;
}

/** Top-level arguments of the call whose '(' is at `open`. */
function callArgs(f: string, open: number): { args: string[]; close: number } {
    const close = closingParen(f, open);
    if (close < 0) throw new Error(`excel-oracle: unbalanced formula ${f}`);
    const args: string[] = [];
    let depth = 0;
    let start = open + 1;
    let i = open + 1;
    while (i < close) {
        const ch = f.charAt(i);
        if (ch === '"' || ch === "'") {
            let j = i + 1;
            while (j < close) {
                if (f.charAt(j) === ch) {
                    if (f.charAt(j + 1) === ch) { j += 2; continue; }
                    break;
                }
                j++;
            }
            i = j + 1;
            continue;
        }
        if (ch === '(' || ch === '{') depth++;
        else if (ch === ')' || ch === '}') depth--;
        else if (ch === ',' && depth === 0) {
            args.push(f.slice(start, i));
            start = i + 1;
        }
        i++;
    }
    args.push(f.slice(start, close));
    return { args, close };
}

/** Positions of `NAME(` calls in code (not inside strings or as part of a longer name). */
function findCalls(f: string, name: string): number[] {
    const out: number[] = [];
    let pos = 0;
    const re = new RegExp(`(?<![A-Za-z0-9_.])${name.replace('.', '\\.')}\\s*\\(`, 'gi');
    for (const s of segments(f)) {
        if (s.code) {
            for (const m of s.text.matchAll(re)) out.push(pos + m.index + m[0].length - 1);
        }
        pos += s.text.length;
    }
    return out;
}

/** Index where the function name of the call whose '(' is at `open` starts. */
function callStart(f: string, open: number, name: string): number {
    let i = open;
    while (i > 0 && /\s/.test(f.charAt(i - 1))) i--;
    return i - name.length;
}

/** Replaces LET(name, value, …, body) by its body with the names substituted (innermost first). */
export function expandLet(f: string): string {
    let out = f;
    for (let guard = 0; guard < 1000; guard++) {
        const opens = findCalls(out, 'LET');
        if (opens.length === 0) return out;
        // innermost: the last LET whose arguments contain no other LET
        const open = opens[opens.length - 1] ?? 0;
        const start = callStart(out, open, 'LET');
        const { args, close } = callArgs(out, open);
        if (args.length < 3 || args.length % 2 === 0) throw new Error(`excel-oracle: bad LET in ${f}`);
        const names: [string, string][] = [];
        for (let i = 0; i < args.length - 1; i += 2) {
            const name = (args[i] ?? '').trim();
            if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) throw new Error(`excel-oracle: bad LET name ${name}`);
            names.push([name, `(${substituteNames(args[i + 1] ?? '', names)})`]);
        }
        const body = substituteNames(args[args.length - 1] ?? '', names);
        out = `${out.slice(0, start)}(${body})${out.slice(close + 1)}`;
    }
    throw new Error(`excel-oracle: LET expansion did not finish for ${f}`);
}

function substituteNames(expr: string, names: [string, string][]): string {
    let out = expr;
    for (const [name, value] of names) {
        const re = new RegExp(`(?<![A-Za-z0-9_.$!:])${name}(?![A-Za-z0-9_.(!:])`, 'gi');
        out = mapCode(out, code => code.replace(re, () => value));
    }
    return out;
}

/** Width and height of a range text such as `'Sheet'!$I:$M` or `$I$6:$M$6` (undefined when not a plain range). */
function rangeShape(range: string): { width: number; height: number | undefined } | undefined {
    const bang = range.lastIndexOf('!');
    const r = range.slice(bang + 1).trim();
    const m = /^\$?([A-Z]{1,3})\$?(\d*):\$?([A-Z]{1,3})\$?(\d*)$/.exec(r);
    if (!m?.[1] || !m[3]) return undefined;
    const height = m[2] && m[4] ? Number(m[4]) - Number(m[2]) + 1 : undefined;
    return { width: colToIndex(m[3]) - colToIndex(m[1]) + 1, height };
}

/**
 * INDEX differences: INDEX(range, r, 0) means the whole row r (HyperFormula needs the columns listed), and
 * INDEX(oneRow, n) means column n (HyperFormula reads n as a row number).
 */
export function rewriteIndex(f: string): string {
    let out = f;
    const opens = findCalls(out, 'INDEX').reverse();
    for (const open of opens) {
        const { args, close } = callArgs(out, open);
        const shape = rangeShape(args[0] ?? '');
        if (!shape) continue;
        let next: string[] | undefined;
        if (args.length === 3 && (args[2] ?? '').trim() === '0') {
            next = [args[0] ?? '', args[1] ?? '', `{${Array.from({ length: shape.width }, (_, i) => i + 1).join(',')}}`];
        } else if (args.length === 2 && shape.height === 1 && shape.width > 1) {
            next = [args[0] ?? '', '1', args[1] ?? ''];
        }
        if (next) out = `${out.slice(0, open + 1)}${next.join(',')}${out.slice(close)}`;
    }
    return out;
}

/**
 * A shared formula moved from its master cell by (dRow, dCol): relative references shift, `$` parts stay.
 * (exceljs's own translation also shifts text inside string literals — "RB6" became "RB7" — so it is not used.)
 */
export function shiftFormula(f: string, dRow: number, dCol: number): string {
    const col = (abs: string, letters: string) => (abs ? letters : indexToCol(colToIndex(letters) + dCol));
    return mapCode(f, code => code.replace(
        /(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])|(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3}):(\$?)([A-Z]{1,3})(?![A-Za-z0-9_(])/g,
        (m, ca?: string, cl?: string, ra?: string, rn?: string, c1a?: string, c1?: string, c2a?: string, c2?: string) => {
            if (cl !== undefined && rn !== undefined) {
                const row = ra ? Number(rn) : Number(rn) + dRow;
                if (row < 1 || (!ca && colToIndex(cl) + dCol < 0)) return '#REF!';
                return `${ca ?? ''}${col(ca ?? '', cl)}${ra ?? ''}${row}`;
            }
            if (c1 !== undefined && c2 !== undefined) {
                return `${c1a ?? ''}${col(c1a ?? '', c1)}:${c2a ?? ''}${col(c2a ?? '', c2)}`;
            }
            return m;
        }));
}

const CRITERIA_ARGS: Record<string, (i: number) => boolean> = {
    SUMIF: i => i === 1,
    COUNTIF: i => i === 1,
    AVERAGEIF: i => i === 1,
    SUMIFS: i => i >= 2 && i % 2 === 0,
    AVERAGEIFS: i => i >= 2 && i % 2 === 0,
    COUNTIFS: i => i % 2 === 1,
};

/**
 * Excel treats a criterion that points at an empty cell as 0; HyperFormula rejects it (#VALUE! "Incorrect
 * criterion"). Single-cell criteria become IF(ISBLANK(ref),0,ref).
 */
export function guardBlankCriteria(f: string): string {
    let out = f;
    for (const [name, isCriterion] of Object.entries(CRITERIA_ARGS)) {
        for (const open of findCalls(out, name).reverse()) {
            const { args, close } = callArgs(out, open);
            const next = args.map((a, i) => {
                const t = a.trim();
                if (!isCriterion(i) || !/^('([^']|'')+'!|[A-Za-z0-9_]+!)?\$?[A-Z]{1,3}\$?\d+$/.test(t)) return a;
                return `IF(ISBLANK(${t}),0,${t})`;
            });
            if (next.some((n, i) => n !== args[i])) out = `${out.slice(0, open + 1)}${next.join(',')}${out.slice(close)}`;
        }
    }
    return out;
}

/**
 * Excel (and Google Sheets) round the argument of ROUND / ROUNDUP / ROUNDDOWN to 15 significant digits first —
 * ROUND(2.675, 2) = 2.68, ROUNDUP((0.75+0.6)/0.15, 0) = 9 although the double is 9.000000000000002.
 * HyperFormula rounds the raw double (→ 10), so the first argument is wrapped in PRECISE15().
 */
export function excelRounding(f: string): string {
    let out = f;
    for (const name of ['ROUND', 'ROUNDUP', 'ROUNDDOWN']) {
        for (const open of findCalls(out, name).reverse()) {
            const { args, close } = callArgs(out, open);
            if (args.length === 0) continue;
            const next = [`PRECISE15(${args[0] ?? ''})`, ...args.slice(1)];
            out = `${out.slice(0, open + 1)}${next.join(',')}${out.slice(close)}`;
        }
    }
    return out;
}

/** ROW(A14:A84) / COLUMN(J1:M1) of a multi-cell range is an array in Excel/Google Sheets; HyperFormula gives one number. */
export function rewriteRowColumnArrays(f: string): string {
    let out = f;
    for (const name of ['ROW', 'COLUMN'] as const) {
        for (const open of findCalls(out, name).reverse()) {
            const { args, close } = callArgs(out, open);
            if (args.length !== 1) continue;
            const arg = args[0] ?? '';
            const m = /\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)\s*$/.exec(arg.slice(arg.lastIndexOf('!') + 1));
            if (!m?.[1] || !m[2] || !m[3] || !m[4]) continue;
            const r1 = Number(m[2]), r2 = Number(m[4]), c1 = colToIndex(m[1]) + 1, c2 = colToIndex(m[3]) + 1;
            let seq: string | undefined;
            if (name === 'ROW' && r2 > r1) seq = `SEQUENCE(${r2 - r1 + 1},1,${r1})`;
            if (name === 'COLUMN' && c2 > c1) seq = `SEQUENCE(1,${c2 - c1 + 1},${c1})`;
            if (seq) out = `${out.slice(0, callStart(out, open, name))}${seq}${out.slice(close + 1)}`;
        }
    }
    return out;
}

/**
 * Google Sheets: IF(…, A1) with A1 empty returns an empty value, which PRODUCT skips; Excel/HyperFormula return 0.
 * The toilet sheet relies on it (`PRODUCT(IF(E5=" ",1,E5), …, IF(G5=" ",1,G5))` with G5 empty = E5·F5). IF(…)
 * arguments of PRODUCT therefore count as 1 when they are blank. (In real Excel these cells give 0.)
 */
export function productSkipsBlankIf(f: string): string {
    let out = f;
    for (const open of findCalls(out, 'PRODUCT').reverse()) {
        const { args, close } = callArgs(out, open);
        if (!args.some(a => /^\s*IF\s*\(/i.test(a))) continue;
        const next = args.map(a => (/^\s*IF\s*\(/i.test(a) ? `IF(ISBLANK(${a.trim()}),1,${a.trim()})` : a));
        out = `${out.slice(0, open + 1)}${next.join(',')}${out.slice(close)}`;
    }
    return out;
}

const REF_RE = /(?<![A-Za-z0-9_.!$:])(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3})(?![A-Za-z0-9_(!])/g;

/** Prefixes unqualified cell references with the sheet (for formulas evaluated on a scratch sheet). */
export function qualifyRefs(f: string, sheet: string): string {
    return mapCode(f, code => code.replace(REF_RE, m => `${quoteSheet(sheet)}!${m}`));
}

/** Excel → HyperFormula rewrites shared by every formula. */
export function toHyperFormula(excelFormula: string): string {
    let f = excelFormula.trim().replace(/^=/, '');
    f = f.replace(/_xlfn\.|_xlws\./g, '');
    f = expandLet(f);
    f = rewriteIndex(f);
    f = rewriteRowColumnArrays(f);
    f = guardBlankCriteria(f);
    f = productSkipsBlankIf(f);
    f = excelRounding(f);
    f = mapCode(f, code => code
        .replace(/[\r\n]+/g, ' ')
        // HyperFormula's lexer has no scientific notation: 1E-12 → (1*10^(-12))
        .replace(/(?<![A-Za-z0-9_.$])(\d+\.?\d*|\.\d+)[eE]([-+]?\d+)(?![A-Za-z0-9_(])/g, (_, m: string, e: string) => `(${m}*10^(${e}))`));
    return `=${f}`;
}

/** Decodes "a"&"b" (string literals joined by &) — undefined if `expr` is anything else. */
function decodeStringConcat(expr: string): string | undefined {
    const segs = segments(expr.trim());
    let out = '';
    for (const s of segs) {
        if (s.code) {
            if (!/^[\s&]*$/.test(s.text)) return undefined;
        } else {
            if (!s.text.startsWith('"')) return undefined;
            out += s.text.slice(1, -1).replace(/""/g, '"');
        }
    }
    return out;
}

/** A constant written as a formula argument ("text", 12.5, TRUE) → its value. */
function decodeConstant(expr: string): OracleInput | undefined {
    const t = expr.trim();
    const s = decodeStringConcat(t);
    if (s !== undefined) return s;
    if (/^[-+]?(\d+\.?\d*|\.\d+)(E[-+]?\d+)?$/i.test(t)) return Number(t);
    if (/^TRUE$/i.test(t)) return true;
    if (/^FALSE$/i.test(t)) return false;
    return undefined;
}

interface GSheetsFormula { inner: string; fallback: OracleInput | undefined; fallbackExpr: string }

/** `IFERROR(__xludf.DUMMYFUNCTION("…"), fallback)` → the Google Sheets formula and the frozen fallback. */
export function parseGSheets(excelFormula: string): GSheetsFormula | undefined {
    const f = excelFormula.trim().replace(/^=/, '');
    if (!f.includes('__xludf.DUMMYFUNCTION')) return undefined;
    const [ifOpen] = findCalls(f, 'IFERROR');
    if (ifOpen === undefined || f.slice(0, ifOpen).trim().toUpperCase() !== 'IFERROR') return undefined;
    const { args } = callArgs(f, ifOpen);
    const [dummy = '', fallbackExpr = ''] = args;
    const [dOpen] = findCalls(dummy, '__xludf.DUMMYFUNCTION');
    if (dOpen === undefined) return undefined;
    const inner = decodeStringConcat(callArgs(dummy, dOpen).args[0] ?? '');
    if (inner === undefined) return undefined;
    return { inner, fallback: decodeConstant(fallbackExpr), fallbackExpr };
}

// ─── Google Sheets functions HyperFormula lacks ──────────────────────────────

interface PluginAst { args: unknown[] }

/**
 * REGEXEXTRACT(text, regex): first capture group, else the whole match; #N/A when nothing matches.
 * PRECISE15(x): x rounded to 15 significant digits (see excelRounding).
 */
class GoogleSheetsPlugin extends FunctionPlugin {
    static override implementedFunctions = {
        REGEXEXTRACT: {
            method: 'regexextract',
            parameters: [{ argumentType: FunctionArgumentType.STRING }, { argumentType: FunctionArgumentType.STRING }],
        },
        PRECISE15: {
            method: 'precise15',
            parameters: [{ argumentType: FunctionArgumentType.NUMBER }],
        },
    };

    precise15(ast: PluginAst, state: unknown) {
        return this.runFunction(ast.args as never, state as never, this.metadata('PRECISE15'),
            (x: number) => (x === 0 || !Number.isFinite(x) ? x : Number(x.toPrecision(15))));
    }

    regexextract(ast: PluginAst, state: unknown) {
        return this.runFunction(ast.args as never, state as never, this.metadata('REGEXEXTRACT'),
            (text: string, pattern: string) => {
                const m = new RegExp(pattern).exec(text);
                if (!m) return new CellError(ErrorType.NA, 'REGEXEXTRACT: no match');
                return m[1] ?? m[0];
            });
    }
}

function registerPlugins(): void {
    if (HyperFormula.getRegisteredFunctionNames('enGB').includes('REGEXEXTRACT')) return;
    HyperFormula.registerFunctionPlugin(GoogleSheetsPlugin, {
        enGB: { REGEXEXTRACT: 'REGEXEXTRACT', PRECISE15: 'PRECISE15' },
        enUS: { REGEXEXTRACT: 'REGEXEXTRACT', PRECISE15: 'PRECISE15' },
    });
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
type StringifyDateTime = NonNullable<ConfigParams['stringifyDateTime']>;

/**
 * TEXT(date, "mmm-yy") in the workbook's (Thai) locale, as cached by Google Sheets ("ม.ค.-26"). Formats without
 * month names fall back to HyperFormula's own formatting.
 */
const thaiDateFormat: StringifyDateTime = (dt, format) => {
    if (!/mmm/i.test(format)) return undefined;
    return format.replace(/yyyy|yy|mmmm|mmm|dd|d/gi, token => {
        const t = token.toLowerCase();
        if (t === 'yyyy') return String(dt.year);
        if (t === 'yy') return String(dt.year % 100).padStart(2, '0');
        if (t === 'mmmm' || t === 'mmm') return THAI_MONTHS[dt.month - 1] ?? '';
        if (t === 'dd') return String(dt.day).padStart(2, '0');
        return String(dt.day);
    });
};

export const HF_CONFIG: Partial<ConfigParams> = {
    licenseKey: 'gpl-v3',          // HyperFormula is GPLv3 / commercial; tests only, never shipped.
    useArrayArithmetic: true,       // Excel 365 / Google Sheets: SUMPRODUCT(IFERROR(range*1,0)) etc.
    // =A1 with A1 empty stays empty, as in Google Sheets (where the cached values come from); arithmetic still reads 0
    evaluateNullToZero: false,
    stringifyDateTime: thaiDateFormat,
    useColumnIndex: true,
    smartRounding: false,
};

// ─── Value conversion ────────────────────────────────────────────────────────

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const dateToSerial = (d: Date) => (d.getTime() - EXCEL_EPOCH) / 86_400_000;

function fromExcelValue(v: unknown): OracleValue {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : dateToSerial(v);
    if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (typeof o.error === 'string') return { error: o.error };
        if (Array.isArray(o.richText)) {
            return (o.richText as { text?: unknown }[]).map(r => (typeof r.text === 'string' ? r.text : '')).join('');
        }
        if (typeof o.text === 'string') return o.text;
    }
    return null;
}

/** Text as the oracle stores it: trimmed unless it is only whitespace (see the header). */
const normText = (s: string) => (s.trim() === '' ? s : s.trim());

function toRaw(v: OracleValue): RawCellContent {
    if (v === null) return null;
    if (typeof v === 'string') return `'${normText(v)}`;   // never let HyperFormula reparse text as a number or formula
    if (typeof v === 'object') return v.error;   // error literal, e.g. '#REF!'
    return v;
}

function fromHf(v: CellValue): OracleValue {
    if (v instanceof DetailedCellError) return { error: v.value, message: v.message };
    return v;
}

/** Equal within `tol` (numbers), exactly (text, booleans), by error code; empty ≡ "" ≡ 0 for formulas without a cached value. */
export function sameValue(a: OracleValue, b: OracleValue, tol = ORACLE_TOLERANCE): boolean {
    if (typeof a === 'number' && typeof b === 'number') return closeTo(a, b, tol);
    if (isOracleError(a) || isOracleError(b)) return isOracleError(a) && isOracleError(b) && a.error === b.error;
    const blank = (x: OracleValue) => x === null || x === '';
    if (blank(a) && blank(b)) return true;
    if (typeof a === 'string' && typeof b === 'string') return normText(a) === normText(b);
    return a === b;
}

// ─── The oracle ──────────────────────────────────────────────────────────────

export interface SelfTestMismatch { ref: string; formula?: string; excel: OracleValue; oracle: OracleValue }

export interface SelfTestReport {
    /** Formula cells compared (frozen fallbacks excluded). */
    compared: number;
    matched: number;
    mismatched: SelfTestMismatch[];
    /** Formula cells not evaluated live (see `fallbacks`). */
    frozen: number;
    /** Formula cells whose cached value exceljs cannot read (text results in date-formatted cells) — not compared. */
    uncached: string[];
    bySheet: Record<string, { compared: number; matched: number; frozen: number }>;
}

export class ExcelOracle {
    readonly hf: HyperFormula;
    readonly fallbacks: OracleFallback[] = [];
    readonly spillOverflows: SpillOverflow[] = [];
    private readonly records = new Map<string, CellRecord>();
    private readonly bySheetId = new Map<number, CellRecord[]>();
    private readonly anchors: SpillAnchor[] = [];
    private readonly touched = new Set<string>();

    private constructor(hf: HyperFormula) {
        this.hf = hf;
    }

    /**
     * Loads a workbook and builds the engine (seconds — load once per test file, see loadV5Oracle).
     * `excludeSheets`: sheets left out entirely (only ever sheets nothing else reads, e.g. the planning sheets).
     */
    static async load(file: string = V5_FIXTURE, opts: { excludeSheets?: readonly string[] } = {}): Promise<ExcelOracle> {
        registerPlugins();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(file);
        const excluded = new Set(opts.excludeSheets ?? []);

        const sheets: Record<string, RawCellContent[][]> = {};
        const pending: Omit<CellRecord, 'sheetId'>[] = [];
        const anchorsPending: { rec: Omit<CellRecord, 'sheetId'>; inner: string }[] = [];

        wb.eachSheet(ws => {
            if (excluded.has(ws.name)) return;
            const grid: RawCellContent[][] = [];
            sheets[ws.name] = grid;
            ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                    if (cell.isMerged && cell.master.address !== cell.address) return;
                    const r = rowNumber - 1;
                    const c = colNumber - 1;
                    const ref = refKey(ws.name, r, c);
                    let rec: Omit<CellRecord, 'sheetId'>;
                    if (cell.type === ExcelJS.ValueType.Formula) {
                        const fv = cell.value as { formula?: string; sharedFormula?: string };
                        let excelFormula = fv.formula ?? '';
                        if (fv.sharedFormula !== undefined) {
                            const master = ws.getCell(fv.sharedFormula);
                            const mf = (master.value as { formula?: string } | null)?.formula ?? '';
                            excelFormula = shiftFormula(mf, rowNumber - master.fullAddress.row, colNumber - master.fullAddress.col);
                        }
                        // model.result: no <v> → undefined (a blank result); an Invalid Date → exceljs could not read
                        // it (a text result in a date-formatted cell, e.g. TEXT(…,"mmm-yy")) — not compared.
                        const result = (cell.model as { result?: unknown }).result;
                        const unreadable = result instanceof Date && Number.isNaN(result.getTime());
                        const cached = unreadable ? null : fromExcelValue(result);
                        const base = { ref, sheet: ws.name, row: r, col: c, excelFormula, cached, hasCached: !unreadable };
                        const gs = parseGSheets(excelFormula);
                        if (gs) {
                            const frozen = toRaw(gs.fallback ?? cached);
                            if (/^\s*"?COMPUTED_VALUE"?\s*$/.test(gs.inner)) {
                                rec = { ...base, kind: 'gsheets-spill', baseline: frozen };
                            } else if (/\b(FILTER|TRANSPOSE|ARRAYFORMULA|SEQUENCE)\s*\(/i.test(gs.inner)) {
                                rec = { ...base, kind: 'gsheets-array', baseline: frozen, hfFormula: toHyperFormula(gs.inner) };
                                anchorsPending.push({ rec, inner: gs.inner });
                            } else {
                                const hfFormula = toHyperFormula(gs.inner);
                                rec = { ...base, kind: 'gsheets', hfFormula, baseline: hfFormula };
                            }
                        } else {
                            const hfFormula = toHyperFormula(excelFormula);
                            rec = { ...base, kind: 'formula', hfFormula, baseline: hfFormula };
                        }
                    } else {
                        const v = fromExcelValue(cell.value);
                        rec = { ref, sheet: ws.name, row: r, col: c, kind: 'value', cached: v, hasCached: true, baseline: toRaw(v) };
                    }
                    pending.push(rec);
                    (grid[r] ??= [])[c] = rec.baseline;
                });
            });
        });

        // Array anchors: evaluated on their own scratch sheet, with references qualified to the home sheet.
        anchorsPending.forEach((a, i) => {
            const qualified = qualifyRefs(toHyperFormula(a.inner).slice(1), a.rec.sheet);
            sheets[`__spill_${i}`] = [[`=${qualified}`]];
        });

        // Fill holes so every row is an array (HyperFormula accepts sparse rows, but keep it explicit).
        for (const grid of Object.values(sheets)) {
            for (let r = 0; r < grid.length; r++) grid[r] ??= [];
        }

        const hf = HyperFormula.buildFromSheets(sheets, HF_CONFIG);
        const oracle = new ExcelOracle(hf);
        for (const p of pending) {
            const sheetId = hf.getSheetId(p.sheet);
            if (sheetId === undefined) throw new Error(`excel-oracle: sheet ${p.sheet} missing`);
            const rec: CellRecord = { ...p, sheetId };
            oracle.records.set(rec.ref, rec);
            const list = oracle.bySheetId.get(sheetId) ?? [];
            list.push(rec);
            oracle.bySheetId.set(sheetId, list);
        }
        anchorsPending.forEach((a, i) => oracle.addAnchor(a.rec.ref, `__spill_${i}`));
        oracle.freezeUnsupported();
        oracle.syncSpills();
        return oracle;
    }

    private addAnchor(ref: string, scratchSheet: string): void {
        const rec = this.records.get(ref);
        if (!rec) return;
        const at = (row: number, col: number) => this.records.get(refKey(rec.sheet, row, col));
        const spillAt = (row: number, col: number) => {
            const r = at(row, col);
            return r?.kind === 'gsheets-spill' ? r : undefined;
        };
        const down: CellRecord[] = [];
        for (let r = rec.row + 1; ; r++) { const s = spillAt(r, rec.col); if (!s) break; down.push(s); }
        const right: CellRecord[] = [];
        for (let c = rec.col + 1; ; c++) { const s = spillAt(rec.row, c); if (!s) break; right.push(s); }
        const direction = right.length > down.length ? 'right' : 'down';
        this.anchors.push({ rec, scratchSheet, area: [rec, ...(direction === 'down' ? down : right)], direction, live: true });
    }

    private addr(rec: CellRecord): SimpleCellAddress {
        return { sheet: rec.sheetId, row: rec.row, col: rec.col };
    }

    /** Why HyperFormula cannot evaluate a formula: a parse error or a function it does not know (else undefined). */
    private unsupportedReason(hfFormula: string): string | undefined {
        if (!this.hf.validateFormula(hfFormula)) return 'HyperFormula cannot parse the formula';
        const known = new Set(HyperFormula.getRegisteredFunctionNames('enGB'));
        const missing = new Set<string>();
        for (const s of segments(hfFormula)) {
            if (!s.code) continue;
            for (const m of s.text.matchAll(/(?<![A-Za-z0-9_.])([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g)) {
                const name = (m[1] ?? '').toUpperCase();
                if (!known.has(name)) missing.add(name);
            }
        }
        return missing.size ? `function not supported: ${[...missing].join(', ')}` : undefined;
    }

    /** Freezes formula cells HyperFormula cannot parse / does not know, and spill cells with no live anchor. */
    private freezeUnsupported(): void {
        const changes: [CellRecord, RawCellContent][] = [];
        for (const a of this.anchors) {
            const id = this.hf.getSheetId(a.scratchSheet);
            const scratch = id === undefined ? undefined : this.hf.getCellFormula({ sheet: id, row: 0, col: 0 });
            const reason = scratch === undefined ? 'array formula not parsed' : this.unsupportedReason(scratch);
            if (reason) {
                a.live = false;
                for (const r of a.area) {
                    r.frozen = true;
                    this.fallbacks.push({ ref: r.ref, kind: 'gsheets-frozen', reason: `array anchor ${a.rec.ref}: ${reason}`, formula: a.rec.excelFormula });
                }
            }
        }
        const inLiveArea = new Set(this.anchors.filter(a => a.live).flatMap(a => a.area.map(r => r.ref)));
        for (const rec of this.records.values()) {
            if (rec.kind === 'value' || rec.frozen) continue;
            if (rec.kind === 'gsheets-spill' || rec.kind === 'gsheets-array') {
                if (!inLiveArea.has(rec.ref)) {
                    rec.frozen = true;
                    this.fallbacks.push({ ref: rec.ref, kind: 'spill-frozen', reason: 'COMPUTED_VALUE cell with no evaluable array anchor above/left', formula: rec.excelFormula });
                }
                continue;
            }
            const reason = rec.hfFormula === undefined ? 'no formula' : this.unsupportedReason(rec.hfFormula);
            if (!reason) continue;
            rec.frozen = true;
            rec.baseline = toRaw(rec.cached);
            changes.push([rec, rec.baseline]);
            this.fallbacks.push({ ref: rec.ref, kind: rec.kind === 'gsheets' ? 'gsheets-frozen' : 'unsupported', reason, formula: rec.excelFormula });
        }
        if (changes.length) this.hf.batch(() => { for (const [rec, raw] of changes) this.hf.setCellContents(this.addr(rec), raw); });
    }

    /** Last content syncSpills wrote into each anchor-area cell. */
    private readonly spillWritten = new Map<string, RawCellContent>();

    /** Copies each live array result from its scratch sheet into the anchor + COMPUTED_VALUE cells. */
    private syncSpills(): void {
        for (let pass = 0; pass < 10; pass++) {
            const changes: [CellRecord, RawCellContent][] = [];
            this.spillOverflows.length = 0;
            for (const a of this.anchors) {
                if (!a.live) continue;
                const id = this.hf.getSheetId(a.scratchSheet);
                if (id === undefined) continue;
                let grid = this.hf.getSheetValues(id);
                // An error result (e.g. FILTER with no match) fills HyperFormula's whole predicted area: one error.
                const first = grid[0]?.[0];
                if (first instanceof DetailedCellError && grid.every(row => row.every(v => v instanceof DetailedCellError && v.value === first.value))) {
                    grid = [[first]];
                }
                const values: CellValue[] = a.direction === 'down' ? grid.map(row => row[0] ?? null) : [...(grid[0] ?? [])];
                while (values.length > 1 && (values[values.length - 1] ?? null) === null) values.pop();
                const across = a.direction === 'down' ? Math.max(0, ...grid.map(r => r.length)) : grid.length;
                const fits = values.length <= a.area.length && across <= 1;
                if (!fits) this.spillOverflows.push({ ref: a.rec.ref, room: a.area.length, needed: values.length });
                a.area.forEach((r, i) => {
                    const raw: RawCellContent = fits ? toRaw(fromHf(values[i] ?? null)) : i === 0 ? '#SPILL!' : null;
                    if (this.spillWritten.has(r.ref) && this.spillWritten.get(r.ref) === raw) return;
                    this.spillWritten.set(r.ref, raw);
                    changes.push([r, raw]);
                });
            }
            if (changes.length === 0) return;
            this.hf.batch(() => { for (const [rec, raw] of changes) this.hf.setCellContents(this.addr(rec), raw); });
        }
        throw new Error('excel-oracle: array spills did not settle');
    }

    private record(ref: string): CellRecord | undefined {
        const { sheet, row, col } = parseRef(ref);
        return this.records.get(refKey(sheet, row, col));
    }

    private address(ref: string): SimpleCellAddress {
        const { sheet, row, col } = parseRef(ref);
        const id = this.hf.getSheetId(sheet);
        if (id === undefined) throw new Error(`excel-oracle: no sheet "${sheet}" (ref ${ref})`);
        return { sheet: id, row, col };
    }

    /**
     * Types values into input cells, like a user in Excel. Keys are `Sheet!A1`. Refuses cells holding a formula
     * that reads other cells (a mapping mistake); a constant formula such as `=9.5+7` may be overwritten.
     * An `OracleFormula` value (`{ formula: '=E6' }`, `{ formula: null }`) is typed / cleared on purpose and may
     * replace any formula (a yellow cell's default link).
     */
    setInputs(values: Record<string, OracleCellInput>): void {
        this.applyInputs(values, false);
    }

    /** reset() + setInputs(values) in one recalculation (faster when running many input sets). */
    replaceInputs(values: Record<string, OracleCellInput>): void {
        this.applyInputs(values, true);
    }

    private applyInputs(values: Record<string, OracleCellInput>, resetFirst: boolean): void {
        const changes = new Map<string, [SimpleCellAddress, RawCellContent]>();
        if (resetFirst) {
            for (const ref of this.touched) changes.set(ref, [this.address(ref), this.records.get(ref)?.baseline ?? null]);
            this.touched.clear();
        }
        for (const [ref, v] of Object.entries(values)) {
            const rec = this.record(ref);
            const typed = isOracleFormula(v);
            if (!typed && rec?.excelFormula !== undefined && /[A-Z]{1,3}\$?\d|!|:/.test(rec.excelFormula.replace(/"[^"]*"/g, ''))) {
                throw new Error(`excel-oracle: ${ref} holds the formula =${rec.excelFormula}; it is not an input cell`);
            }
            let raw: RawCellContent;
            if (!typed) raw = toRaw(v);
            else if (v.formula === null) raw = null;
            else {
                raw = toHyperFormula(v.formula);
                if (!this.hf.validateFormula(raw)) throw new Error(`excel-oracle: cannot parse the formula typed into ${ref}: ${v.formula}`);
            }
            const { sheet, row, col } = parseRef(ref);
            const key = refKey(sheet, row, col);
            changes.set(key, [this.address(ref), raw]);
            this.touched.add(key);
        }
        if (changes.size === 0) return;
        this.hf.batch(() => { for (const [a, raw] of changes.values()) this.hf.setCellContents(a, raw); });
        this.syncSpills();
    }

    /** Restores every cell changed by setInputs to the workbook content. */
    reset(): void {
        this.applyInputs({}, true);
    }

    /** Current value of a cell. */
    get(ref: string): OracleValue {
        return fromHf(this.hf.getCellValue(this.address(ref)));
    }

    /** Current value as a number (empty → 0). Throws on text / errors so a broken mapping cannot pass silently. */
    num(ref: string): number {
        const v = this.get(ref);
        if (v === null) return 0;
        if (typeof v === 'number') return v;
        throw new Error(`excel-oracle: ${ref} is not a number: ${JSON.stringify(v)}`);
    }

    /**
     * Evaluates an ad-hoc Excel formula against the current state (references without a sheet resolve on `sheet`),
     * e.g. `evaluate("=SUM('ประตู-หน้าต่าง_Door&Window'!K6:K25)")`. Same rewrites as the workbook's formulas.
     */
    evaluate(formula: string, sheet?: string): OracleValue {
        const id = this.hf.getSheetId(sheet ?? this.hf.getSheetNames()[0] ?? '');
        if (id === undefined) throw new Error(`excel-oracle: no sheet "${sheet ?? ''}"`);
        const v = this.hf.calculateFormula(toHyperFormula(formula), id);
        if (Array.isArray(v)) throw new Error(`excel-oracle: ${formula} returns an array`);
        return fromHf(v);
    }

    /** Value cached in the workbook. */
    cached(ref: string): OracleValue {
        return this.record(ref)?.cached ?? null;
    }

    /** Formula as written in the workbook (shared formulas expanded), without '='. */
    formula(ref: string): string | undefined {
        return this.record(ref)?.excelFormula;
    }

    isFrozen(ref: string): boolean {
        return this.record(ref)?.frozen === true;
    }

    /**
     * Frozen fallback cells `ref` depends on (directly or through other formulas). Empty = the value is fully
     * live. Assert this in oracle tests for every cell you compare.
     */
    frozenPrecedents(ref: string): string[] {
        const out = new Set<string>();
        const seen = new Set<string>();
        const queue: SimpleCellAddress[] = [];
        const visit = (a: SimpleCellAddress) => {
            const key = refKey(this.hf.getSheetName(a.sheet) ?? '', a.row, a.col);
            if (seen.has(key)) return;
            seen.add(key);
            const rec = this.records.get(key);
            if (rec?.frozen) out.add(key);
            else if (rec && rec.kind !== 'value') queue.push(a);
        };
        visit(this.address(ref));
        while (queue.length) {
            const a = queue.pop();
            if (!a) break;
            const key = refKey(this.hf.getSheetName(a.sheet) ?? '', a.row, a.col);
            // a live spill cell holds a copied constant: its real precedents are those of the scratch formula
            const anchor = this.anchors.find(x => x.live && x.area.some(r => r.ref === key));
            const scratchId = anchor ? this.hf.getSheetId(anchor.scratchSheet) : undefined;
            const precedents = scratchId !== undefined
                ? this.hf.getCellPrecedents({ sheet: scratchId, row: 0, col: 0 })
                : this.hf.getCellPrecedents(a);
            for (const p of precedents) {
                if ('start' in p) {
                    const list = this.bySheetId.get(p.start.sheet) ?? [];
                    for (const r of list) {
                        if (r.row >= p.start.row && r.row <= p.end.row && r.col >= p.start.col && r.col <= p.end.col) visit(this.addr(r));
                    }
                } else visit(p);
            }
        }
        return [...out].sort();
    }

    /** Every formula cell of the workbook (optionally of some sheets). */
    formulaRefs(sheets?: string[]): string[] {
        return [...this.records.values()]
            .filter(r => r.kind !== 'value' && (!sheets || sheets.includes(r.sheet)))
            .map(r => r.ref);
    }

    /** With no inputs changed, compares every formula cell with the value cached in the workbook. */
    selfTest(tol = ORACLE_TOLERANCE): SelfTestReport {
        const report: SelfTestReport = { compared: 0, matched: 0, mismatched: [], frozen: 0, uncached: [], bySheet: {} };
        for (const rec of this.records.values()) {
            if (rec.kind === 'value') continue;
            const s = (report.bySheet[rec.sheet] ??= { compared: 0, matched: 0, frozen: 0 });
            if (rec.frozen) { report.frozen++; s.frozen++; continue; }
            if (!rec.hasCached) { report.uncached.push(rec.ref); continue; }
            report.compared++;
            s.compared++;
            const v = fromHf(this.hf.getCellValue(this.addr(rec)));
            if (sameValue(v, rec.cached, tol)) { report.matched++; s.matched++; }
            else report.mismatched.push({ ref: rec.ref, formula: rec.excelFormula, excel: rec.cached, oracle: v });
        }
        return report;
    }
}

/**
 * Sheets computed from the BOQ that no calculator or BOQ cell reads. Leaving them out makes one recalculation
 * ~100× faster (S-Curve alone holds 3,456 of the 9,461 formulas, all depending on the BOQ total).
 */
export const V5_PLANNING_SHEETS = ['Man-Day_Basic', 'S-Curve_Plan_Basic', 'CashFLOW_Basic'] as const;

/** 'calculators': BOQ (Home) + every calculator sheet (default); 'all': the whole workbook. */
export type OracleScope = 'calculators' | 'all';

const v5 = new Map<OracleScope, Promise<ExcelOracle>>();

/**
 * The v5 workbook oracle, loaded once per test file and scope (vitest isolates modules per file).
 * Use replaceInputs() per case, or reset() between cases.
 */
export function loadV5Oracle(scope: OracleScope = 'calculators'): Promise<ExcelOracle> {
    let p = v5.get(scope);
    if (!p) {
        p = ExcelOracle.load(V5_FIXTURE, { excludeSheets: scope === 'all' ? [] : V5_PLANNING_SHEETS });
        v5.set(scope, p);
    }
    return p;
}
