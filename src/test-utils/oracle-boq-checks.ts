// BOQ (Home) checks shared by the structural oracle tests (footing → column, structure summary) — TEST ONLY.
// See docs/rebuild/ORACLE_TESTS.md. Every check is the exact comparison unless a documented decision (D1/D5/D12)
// applies; then the app row is checked against Excel's own waste and unit prices applied to the app quantity, and
// the difference is returned so the section subtotal can be checked against the sum of the documented deltas.
import { expect } from 'vitest';
import type { BoqItemRow, BoqResult } from '../domain/boq/types';
import { REBAR_SIZES, REBAR_WASTE, TIE_WIRE_RATIO, type RebarSize } from '../domain/boq/slots';
import { closeTo, isOracleError, type ExcelOracle } from './excel-oracle';
import { boqItem, expectBoqRow, expectClose } from './oracle-helpers';

export const BOQ_SHEET = 'BOQ (Home)';

/** x rounded to 15 significant digits, as Excel does before ROUNDUP / CEILING. */
export const excelPrecise = (x: number): number => (x === 0 || !Number.isFinite(x) ? x : Number(x.toPrecision(15)));

/** Excel ROUNDUP(x, 0): away from zero, on the 15-digit value ((0.75+0.6)/0.15 = 9.000000000000002 → 9). */
export const excelRoundUp = (x: number): number => Math.sign(x) * Math.ceil(Math.abs(excelPrecise(x))) + 0;

/** Excel CEILING(x, step) for x ≥ 0. */
export const excelCeiling = (x: number, step: number): number => Math.ceil(excelPrecise(x / step)) * step;

/** app − Excel of a row or a block: J (material), L (labour), M (total). */
export interface BoqDelta { mat: number; lab: number; total: number }

export const NO_DELTA: BoqDelta = { mat: 0, lab: 0, total: 0 };

export const sumDeltas = (...ds: BoqDelta[]): BoqDelta =>
    ds.reduce((s, d) => ({ mat: s.mat + d.mat, lab: s.lab + d.lab, total: s.total + d.total }), NO_DELTA);

const cell = (oracle: ExcelOracle, col: string, row: number) => oracle.num(`${BOQ_SHEET}!${col}${row}`);

function appRow(boq: BoqResult, key: string, label: string): BoqItemRow {
    const row = boqItem(boq, key);
    if (!row) throw new Error(`${label} BOQ row ${key} missing in the app`);
    return row;
}

/**
 * One BOQ (Home) row (E, H, J, L, M). With no documented delta this is `expectBoqRow` (exact). Documented deltas:
 * - `qtyDelta`: app E − Excel E, computed by the caller from first principles for a named decision (D1);
 * - `gross: 'concrete'` with no quantity: Excel `MAX(1, CEILING(0, 0.25))` still orders 1 m³, the app 0
 *   (engine.ts: "no quantity stays 0 (D1)").
 * Then E is checked as Excel E + qtyDelta and H, J, L, M as Excel's G, I, K applied to that quantity.
 * Returns app − Excel of J, L, M.
 */
export function expectBoqRowD1(
    oracle: ExcelOracle, boq: BoqResult, key: string, excelRow: number,
    opts: { qtyDelta?: number; gross?: 'std' | 'concrete'; label?: string } = {},
): BoqDelta {
    const { qtyDelta = 0, gross = 'std', label = '' } = opts;
    const row = appRow(boq, key, label);
    const e = cell(oracle, 'E', excelRow);
    const appE = e + qtyDelta;
    const concreteZero = gross === 'concrete' && appE <= 1e-12;
    if (qtyDelta === 0 && !concreteZero) {
        expectBoqRow(oracle, boq, key, excelRow, label);
    } else {
        const g = cell(oracle, 'G', excelRow), i = cell(oracle, 'I', excelRow), k = cell(oracle, 'K', excelRow);
        const tag = `${label} ${key} (D1)`;
        expectClose(row.qty, appE, `${tag} E${excelRow} = Excel E + ${qtyDelta}`);
        let appH = appE * (1 + g);
        if (gross === 'concrete') {
            // Excel side: H = MAX(1, CEILING(E·(1+G), 0.25)); the app orders nothing when there is no concrete.
            expectClose(cell(oracle, 'H', excelRow), Math.max(1, excelCeiling(Math.max(0, e) * (1 + g), 0.25)), `${tag} Excel H${excelRow}`);
            appH = concreteZero ? 0 : Math.max(1, excelCeiling(appE * (1 + g), 0.25));
        } else {
            expectClose(cell(oracle, 'H', excelRow), e * (1 + g), `${tag} Excel H${excelRow}`);
        }
        expectClose(row.grossQty ?? 0, appH, `${tag} H${excelRow}`);
        expectClose(row.matTotal, i * appH, `${tag} J${excelRow} = I×H`);
        expectClose(row.labTotal, k * appE, `${tag} L${excelRow} = K×E`);
        expectClose(row.total, i * appH + k * appE, `${tag} M${excelRow}`);
    }
    return {
        mat: row.matTotal - cell(oracle, 'J', excelRow),
        lab: row.labTotal - cell(oracle, 'L', excelRow),
        total: row.total - cell(oracle, 'M', excelRow),
    };
}

/** A rebar block of BOQ (Home): Excel's fixed size rows and its tie-wire row (none for the PS shear key, row 75). */
export interface RebarBlock {
    /** App slot key prefix, e.g. 'pedestal:rebar' (rows 'pedestal:rebar:RB6', …, 'pedestal:rebar:tie-wire'). */
    slot: string;
    /** Excel rows the FILTER spill fills with `- เหล็ก <size>` (the anchor first). */
    rows: readonly number[];
    tieWire?: number;
}

/** Net kg per bar size from a calculator's `rebar.<size>` outputs (its sheet-24 row). */
export const rebarKgOf = (out: Readonly<Record<string, number>>, prefix = 'rebar'): Record<RebarSize, number> =>
    Object.fromEntries(REBAR_SIZES.map(s => [s, out[`${prefix}.${s}`] ?? 0])) as Record<RebarSize, number>;

/**
 * Which BOQ layout a block falls into (for coverage tests): the number of sizes, and whether Excel's per-row waste
 * (G of the fixed rows, typed for the sample's bars) equals the app's per-size waste; or a spill.
 */
export function rebarLayout(oracle: ExcelOracle, block: RebarBlock, appKg: Partial<Record<RebarSize, number>>): string {
    const sizes = REBAR_SIZES.filter(s => (appKg[s] ?? 0) > 0);
    if (sizes.length > block.rows.length) return `${block.rows.length + 1}+ sizes (Excel #SPILL!)`;
    const same = sizes.every((s, k) => closeTo(cell(oracle, 'G', block.rows[k] ?? 0), REBAR_WASTE[s]));
    return `${sizes.length} size(s), ${same ? 'Excel waste' : 'per-size waste differs'}`;
}

export interface RebarBlockResult extends BoqDelta {
    /** For coverage: number of sizes and whether Excel's per-row waste equals the app's per-size waste. */
    layout: string;
    sizes: RebarSize[];
}

/**
 * Compares a rebar block. `appKg`: the calculator's net kg per size (sheet 24 row). `kgDelta`: documented app − Excel
 * kg per size (D1), 0 by default.
 * - ≤ Excel rows: each size in Excel's row k; E = Excel E + kgDelta; exact when the delta is 0 and Excel's waste of
 *   that row equals the app's per-size waste. Otherwise (D5/D12: Excel keeps the waste typed for the sample's bar in
 *   that position, the app uses RB6 6 %, RB9 9 %, DB12–DB20 12 %) the app row must be Excel's I and K applied to the
 *   app quantity with the per-size waste. Tie wire = 3 % of the block's gross rebar on both sides.
 * - more sizes than Excel rows: Excel's FILTER spill fails (#SPILL!; Google Sheets shows #REF!) and the element's
 *   rebar drops out of the Excel BOQ (D5: the app adds one row per size).
 */
export function expectRebarBlock(
    oracle: ExcelOracle, boq: BoqResult, block: RebarBlock, appKg: Partial<Record<RebarSize, number>>,
    opts: { kgDelta?: Partial<Record<RebarSize, number>>; label?: string } = {},
): RebarBlockResult {
    const { kgDelta = {}, label = '' } = opts;
    const tag = `${label} ${block.slot}`;
    const sizes = REBAR_SIZES.filter(s => (appKg[s] ?? 0) > 0);
    const slot = (k: string) => boqItem(boq, `${block.slot}:${k}`);
    for (const s of REBAR_SIZES) expect(slot(s) !== undefined, `${tag}: app row for ${s}`).toBe(sizes.includes(s));
    expect(slot('tie-wire') !== undefined, `${tag}: app tie-wire row`).toBe(block.tieWire !== undefined && sizes.length > 0);
    for (const s of sizes) expectClose(slot(s)?.qty, appKg[s] ?? 0, `${tag}:${s} qty = calculator kg`);

    const appRows = [...sizes, 'tie-wire'].map(slot).filter((r): r is BoqItemRow => r !== undefined);
    const excelRows = [...block.rows, ...(block.tieWire !== undefined ? [block.tieWire] : [])];
    const app = {
        mat: appRows.reduce((s, r) => s + r.matTotal, 0),
        lab: appRows.reduce((s, r) => s + r.labTotal, 0),
        total: appRows.reduce((s, r) => s + r.total, 0),
    };
    const excel = {
        mat: excelRows.reduce((s, r) => s + cell(oracle, 'J', r), 0),
        lab: excelRows.reduce((s, r) => s + cell(oracle, 'L', r), 0),
        total: excelRows.reduce((s, r) => s + cell(oracle, 'M', r), 0),
    };
    const delta = { mat: app.mat - excel.mat, lab: app.lab - excel.lab, total: app.total - excel.total };

    const layout = rebarLayout(oracle, block, appKg);
    if (sizes.length > block.rows.length) {
        const anchor = oracle.get(`${BOQ_SHEET}!D${block.rows[0] ?? 0}`);
        expect(isOracleError(anchor) && anchor.error, `${tag}: Excel D${block.rows[0] ?? 0} spill`).toBe('#SPILL!');
        expect(excel.total, `${tag}: Excel block total`).toBe(0);
        expect(app.total, `${tag}: app block total`).toBeGreaterThan(0);
        return { ...delta, layout, sizes };
    }

    let exact = true;
    for (const [k, size] of sizes.entries()) {
        const er = block.rows[k] ?? 0;
        const row = slot(size);
        if (!row) continue;
        expect(oracle.get(`${BOQ_SHEET}!D${er}`), `${tag}: Excel D${er}`).toBe(`- เหล็ก ${size}`);
        const e = cell(oracle, 'E', er), g = cell(oracle, 'G', er);
        const dKg = kgDelta[size] ?? 0;
        expectClose(row.qty - e, dKg, `${tag}:${size} E − Excel E${er} (documented kg delta)`);
        if (dKg === 0 && closeTo(g, REBAR_WASTE[size])) {
            expectBoqRow(oracle, boq, `${block.slot}:${size}`, er, label);
            continue;
        }
        exact = false;
        const i = cell(oracle, 'I', er), kLab = cell(oracle, 'K', er), w = REBAR_WASTE[size];
        expectClose(cell(oracle, 'H', er), e * (1 + g), `${tag}: Excel H${er} = E(1+G)`);
        expectClose(row.grossQty ?? NaN, row.qty * (1 + w), `${tag}:${size} H (per-size waste ${w})`);
        expectClose(row.matTotal, i * row.qty * (1 + w), `${tag}:${size} J = Excel I${er} × H`);
        expectClose(row.labTotal, kLab * row.qty, `${tag}:${size} L = Excel K${er} × E`);
    }
    for (let k = sizes.length; k < block.rows.length; k++) {
        expect(cell(oracle, 'E', block.rows[k] ?? 0), `${tag}: unused Excel row ${block.rows[k] ?? 0}`).toBe(0);
    }
    if (block.tieWire !== undefined) {
        const t = block.tieWire;
        expectClose(cell(oracle, 'H', t), block.rows.reduce((s, r) => s + cell(oracle, 'H', r), 0) * TIE_WIRE_RATIO, `${tag}: Excel H${t} = ΣH × 3 %`);
        const wire = slot('tie-wire');
        if (!wire) {
            expect(cell(oracle, 'M', t), `${tag}: Excel M${t} without rebar`).toBe(0);
        } else if (exact) {
            expectBoqRow(oracle, boq, `${block.slot}:tie-wire`, t, label);
        } else {
            const gross = sizes.reduce((s, k) => s + (slot(k)?.grossQty ?? 0), 0) * TIE_WIRE_RATIO;
            expectClose(wire.grossQty ?? NaN, gross, `${tag}: app tie wire = 3 % of the app gross rebar`);
            expectClose(wire.matTotal, cell(oracle, 'I', t) * gross, `${tag}: tie wire J = Excel I${t} × H`);
            expectClose(wire.labTotal, cell(oracle, 'K', t) * gross, `${tag}: tie wire L = Excel K${t} × H`);
        }
    }
    if (exact) expectClose(app.total, excel.total, `${tag}: block total`);
    return { ...delta, layout, sizes };
}

/** Section subtotal (`รวม >>` row J, L, M): app − Excel must equal the sum of the documented row/block deltas. */
export function expectSectionTotal(
    oracle: ExcelOracle, boq: BoqResult, no: number, excelRow: number, delta: BoqDelta, label = '',
): void {
    const s = boq.sections.find(x => x.no === no);
    expect(s, `${label} section ${no}`).toBeDefined();
    expectClose((s?.matTotal ?? NaN) - cell(oracle, 'J', excelRow), delta.mat, `${label} section ${no}: J${excelRow} − Σ deltas`);
    expectClose((s?.labTotal ?? NaN) - cell(oracle, 'L', excelRow), delta.lab, `${label} section ${no}: L${excelRow} − Σ deltas`);
    expectClose((s?.total ?? NaN) - cell(oracle, 'M', excelRow), delta.total, `${label} section ${no}: M${excelRow} − Σ deltas`);
}

/**
 * A computed cell that Excel shows as text when it has no value ("_" / "-" from IFERROR): app `null` ↔ that text,
 * a number ↔ the Excel number.
 */
export function expectNumberOrText(oracle: ExcelOracle, app: number | null, ref: string, text: string, label: string): void {
    if (app === null) expect(oracle.get(ref), `${label} ${ref}`).toBe(text);
    else expectClose(app, oracle.num(ref), `${label} ${ref}`);
}
