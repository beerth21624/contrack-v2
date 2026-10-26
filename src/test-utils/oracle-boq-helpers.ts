// BOQ (Home) helpers for oracle tests of the calculators that feed it — TEST ONLY. See docs/rebuild/ORACLE_TESTS.md.
// They assert a documented difference (D1/D5) exactly, from Excel's own G/I/K cells: app − Excel == delta.
import { expect } from 'vitest';
import { REBAR_SIZES, REBAR_WASTE, TIE_WIRE_RATIO, type RebarSize } from '../domain/boq/slots';
import type { BoqResult } from '../domain/boq/types';
import { closeTo, isOracleError, type ExcelOracle } from './excel-oracle';
import { boqItem, expectBoqRow, expectClose } from './oracle-helpers';

const BOQ = 'BOQ (Home)';

/** app − Excel of a BOQ row (or a block of rows): material J, labour L, total M. */
export interface BoqDelta { J: number; L: number; M: number }

export const NO_DELTA: BoqDelta = { J: 0, L: 0, M: 0 };

export const addDeltas = (...ds: BoqDelta[]): BoqDelta =>
    ds.reduce((a, d) => ({ J: a.J + d.J, L: a.L + d.L, M: a.M + d.M }), NO_DELTA);

const num = (o: ExcelOracle, col: string, row: number) => o.num(`${BOQ}!${col}${row}`);

/**
 * A BOQ row with H = E·(1+G), J = I·H, L = K·E whose app net qty is Excel's E + dE — a documented decision, e.g.
 * D1: the app sums every table row where Excel's total stops early. dE = 0 → the row must match exactly.
 * Returns the app − Excel difference that follows from Excel's own G, I and K.
 */
export function expectStdRowQtyDelta(oracle: ExcelOracle, boq: BoqResult, key: string, excelRow: number, dE: number, label = ''): BoqDelta {
    if (closeTo(dE, 0)) {
        expectBoqRow(oracle, boq, key, excelRow, label);
        return NO_DELTA;
    }
    expect(oracle.formula(`${BOQ}!H${excelRow}`), `${label} H${excelRow} is E·(1+G)`).toBe(`E${excelRow}*(100%+G${excelRow})`);
    const row = boqItem(boq, key);
    const e = num(oracle, 'E', excelRow) + dE;
    const h = e * (1 + num(oracle, 'G', excelRow));
    const j = num(oracle, 'I', excelRow) * h;
    const l = num(oracle, 'K', excelRow) * e;
    expectClose(row?.qty, e, `${label} E${excelRow} (${key}) = Excel E + ${dE}`);
    expectClose(row?.grossQty ?? NaN, h, `${label} H${excelRow} = E·(1+G)`);
    expectClose(row?.matTotal, j, `${label} J${excelRow} = I·H`);
    expectClose(row?.labTotal, l, `${label} L${excelRow} = K·E`);
    expectClose(row?.total, j + l, `${label} M${excelRow}`);
    const d = { J: j - num(oracle, 'J', excelRow), L: l - num(oracle, 'L', excelRow), M: 0 };
    return { ...d, M: d.J + d.L };
}

/**
 * Structural concrete, H = MAX(1, CEILING(E·(1+G), 0.25)). D1 (engine.ts "no quantity stays 0"): with no concrete
 * Excel still orders 1 m³, the app 0 — so app − Excel = −1 × I (labour is on net qty: 0 on both sides).
 * Otherwise the row matches exactly.
 */
export function expectConcreteRow(oracle: ExcelOracle, boq: BoqResult, key: string, excelRow: number, label = ''): BoqDelta {
    expect(oracle.formula(`${BOQ}!H${excelRow}`), `${label} H${excelRow} concrete rule`).toBe(`MAX(1,CEILING(E${excelRow}*(1+G${excelRow}),0.25))`);
    const e = num(oracle, 'E', excelRow);
    if (e > 0) {
        expectBoqRow(oracle, boq, key, excelRow, label);
        return NO_DELTA;
    }
    const row = boqItem(boq, key);
    expectClose(row?.qty, e, `${label} E${excelRow} (${key})`);
    expect(row?.grossQty, `${label} app H${excelRow}: no concrete stays 0 (D1)`).toBe(0);
    expect(num(oracle, 'H', excelRow), `${label} Excel H${excelRow} = MAX(1, CEILING(0, 0.25))`).toBe(1);
    const dJ = -num(oracle, 'I', excelRow);
    expectClose((row?.matTotal ?? NaN) - num(oracle, 'J', excelRow), dJ, `${label} J${excelRow} delta = −1 m³ × I`);
    expectClose(row?.labTotal, num(oracle, 'L', excelRow), `${label} L${excelRow}`);
    expectClose((row?.total ?? NaN) - num(oracle, 'M', excelRow), dJ, `${label} M${excelRow} delta = −1 m³ × I`);
    return { J: dJ, L: 0, M: dJ };
}

export interface RebarBlockSpec {
    /** Calculator id; its slot rows are `${calc}:rebar:<size>` and `${calc}:rebar:tie-wire`. */
    calc: string;
    /** First Excel row of the block (the FILTER anchor, e.g. 116). */
    firstRow: number;
    /** Excel rows reserved for bar sizes (2 for the roof beam, 1 for the roof slab and the stair). */
    excelSlots: number;
    /** Net kg per size, as the calculator computes it. */
    weights: Partial<Record<RebarSize, number>>;
}

export type RebarLayout = 'no rebar' | 'Excel waste' | 'per-size waste differs' | 'more sizes than Excel rows (#SPILL!)';

/** How the app's rebar rows relate to Excel's fixed slot rows (`slotWaste` = Excel G of each slot row). */
export function rebarLayout(weights: Partial<Record<RebarSize, number>>, slotWaste: readonly number[]): RebarLayout {
    const sizes = REBAR_SIZES.filter(s => (weights[s] ?? 0) > 0);
    if (sizes.length === 0) return 'no rebar';
    if (sizes.length > slotWaste.length) return 'more sizes than Excel rows (#SPILL!)';
    return sizes.every((s, k) => closeTo(REBAR_WASTE[s], slotWaste[k] ?? NaN)) ? 'Excel waste' : 'per-size waste differs';
}

/**
 * A rebar block (one `- เหล็ก <size>` row per size with weight > 0, then `- ลวดผูกเหล็ก` = 3 % of their gross kg).
 * Exact where the decisions do not apply; otherwise asserts the documented difference:
 * - D5/D12: Excel's fixed rows keep the waste typed for the sample's bar in that position (roof beam G116 12 %,
 *   G117 6 % — swapped, D1 oddity 1), the app gives each size its own waste: ΔJ = E × (app waste − Excel waste) × I,
 *   and the tie wire follows (ΔH = 3 % × ΣΔH).
 * - D5: more sizes than Excel rows → the FILTER spill fails (#SPILL!, Google Sheets #REF!) and the block drops out
 *   of the Excel BOQ; the app keeps one row per size.
 * Returns the block's app − Excel difference.
 */
export function expectRebarBlock(oracle: ExcelOracle, boq: BoqResult, spec: RebarBlockSpec, label = ''): BoqDelta {
    const { calc, firstRow, excelSlots, weights } = spec;
    const sizes = REBAR_SIZES.filter(s => (weights[s] ?? 0) > 0);
    const tieRow = firstRow + excelSlots;
    const slot = (k: string) => boqItem(boq, `${calc}:rebar:${k}`);
    const excelRows = Array.from({ length: excelSlots + 1 }, (_, k) => firstRow + k);
    const excelSum = (col: string) => excelRows.reduce((s, r) => s + num(oracle, col, r), 0);
    const appRows = [...sizes, 'tie-wire'].map(slot);
    const appSum = (get: (r: NonNullable<ReturnType<typeof slot>>) => number) => appRows.reduce((s, r) => s + (r ? get(r) : 0), 0);
    const blockDelta = (): BoqDelta => ({
        J: appSum(r => r.matTotal) - excelSum('J'),
        L: appSum(r => r.labTotal) - excelSum('L'),
        M: appSum(r => r.total) - excelSum('M'),
    });

    // Excel's tie wire is always 3 % of the gross kg of its fixed rows.
    expectClose(num(oracle, 'H', tieRow), excelRows.slice(0, -1).reduce((s, r) => s + num(oracle, 'H', r), 0) * TIE_WIRE_RATIO, `${label} Excel H${tieRow} = 3 % ΣH`);

    if (sizes.length === 0) {
        expect(slot('tie-wire'), `${label} app has no tie-wire row without rebar`).toBeUndefined();
        for (const r of excelRows) for (const col of ['E', 'H', 'J', 'L', 'M']) expect(num(oracle, col, r), `${label} Excel ${col}${r} without rebar`).toBe(0);
        return NO_DELTA;
    }
    if (sizes.length > excelSlots) {
        const d = oracle.get(`${BOQ}!D${firstRow}`);
        expect(isOracleError(d) && d.error, `${label} Excel D${firstRow}`).toBe('#SPILL!');
        expect(excelSum('M'), `${label} Excel block M${firstRow}:M${tieRow}`).toBe(0);
        expect(appSum(r => r.total), `${label} app block`).toBeGreaterThan(0);
        return blockDelta();
    }

    let dGross = 0;
    let dJ = 0;
    sizes.forEach((size, k) => {
        const er = firstRow + k;
        const row = slot(size);
        const e = num(oracle, 'E', er);
        expect(oracle.get(`${BOQ}!D${er}`), `${label} D${er}`).toBe(`- เหล็ก ${size}`);
        expectClose(row?.qty, e, `${label} E${er} ${size}`);
        expectClose(weights[size], e, `${label} E${er} ${size} = calculator weight`);
        expectClose(row?.labTotal, num(oracle, 'L', er), `${label} L${er} ${size}`);
        const excelWaste = num(oracle, 'G', er);
        if (closeTo(excelWaste, REBAR_WASTE[size])) {
            expectBoqRow(oracle, boq, `${calc}:rebar:${size}`, er, label);
            return;
        }
        // D5/D12 (and D1 for the roof beam's swapped G116/G117): per-size waste in the app, per-row waste in Excel.
        const appGross = e * (1 + REBAR_WASTE[size]);
        expectClose(row?.grossQty ?? NaN, appGross, `${label} H${er} app (per-size waste)`);
        expectClose(num(oracle, 'H', er), e * (1 + excelWaste), `${label} H${er} Excel (per-row waste)`);
        const rowDJ = e * (REBAR_WASTE[size] - excelWaste) * num(oracle, 'I', er);
        expectClose((row?.matTotal ?? NaN) - num(oracle, 'J', er), rowDJ, `${label} J${er} delta`);
        dGross += appGross - num(oracle, 'H', er);
        dJ += rowDJ;
    });
    // unused Excel slot rows stay empty
    for (let k = sizes.length; k < excelSlots; k++) {
        for (const col of ['E', 'H', 'J', 'L', 'M']) expect(num(oracle, col, firstRow + k), `${label} unused Excel slot ${col}${firstRow + k}`).toBe(0);
    }
    const wire = slot('tie-wire');
    const appGrossSum = sizes.reduce((s, k) => s + (slot(k)?.grossQty ?? 0), 0);
    expectClose(wire?.grossQty ?? NaN, appGrossSum * TIE_WIRE_RATIO, `${label} app tie wire = 3 % Σ gross`);
    const dWire = dGross * TIE_WIRE_RATIO;
    expectClose((wire?.grossQty ?? NaN) - num(oracle, 'H', tieRow), dWire, `${label} H${tieRow} delta = 3 % ΣΔH`);
    expectClose(wire?.matTotal, num(oracle, 'I', tieRow) * (num(oracle, 'H', tieRow) + dWire), `${label} J${tieRow} = I·H`);
    expectClose(wire?.labTotal, num(oracle, 'K', tieRow) * (num(oracle, 'H', tieRow) + dWire), `${label} L${tieRow} = K·H`);
    if (closeTo(dGross, 0)) expectBoqRow(oracle, boq, `${calc}:rebar:tie-wire`, tieRow, label);
    const expected: BoqDelta = { J: dJ + dWire * num(oracle, 'I', tieRow), L: dWire * num(oracle, 'K', tieRow), M: 0 };
    expected.M = expected.J + expected.L;
    const actual = blockDelta();
    expectClose(actual.J, expected.J, `${label} rebar block ΔJ`);
    expectClose(actual.L, expected.L, `${label} rebar block ΔL`);
    expectClose(actual.M, expected.M, `${label} rebar block ΔM`);
    return expected;
}

/** Section subtotal (`รวม >>` row): app − Excel J/L/M equals the sum of the documented row deltas. */
export function expectSectionDelta(oracle: ExcelOracle, boq: BoqResult, no: number, subtotalRow: number, delta: BoqDelta, label = ''): void {
    const s = boq.sections.find(x => x.no === no);
    expectClose((s?.matTotal ?? NaN) - num(oracle, 'J', subtotalRow), delta.J, `${label} section ${no} J${subtotalRow} − row deltas`);
    expectClose((s?.labTotal ?? NaN) - num(oracle, 'L', subtotalRow), delta.L, `${label} section ${no} L${subtotalRow} − row deltas`);
    expectClose((s?.total ?? NaN) - num(oracle, 'M', subtotalRow), delta.M, `${label} section ${no} M${subtotalRow} − row deltas`);
}
