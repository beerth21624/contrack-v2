// Helpers for oracle (differential) tests — TEST ONLY. See docs/rebuild/ORACLE_TESTS.md.
import { expect } from 'vitest';
import type { BoqItemRow, BoqResult } from '../domain/boq/types';
import { closeTo, type ExcelOracle, type SelfTestReport } from './excel-oracle';

/** A clean self-test: every compared formula cell matches, nothing frozen, no spill overflow. */
export function expectCleanSelfTest(report: SelfTestReport, oracle: ExcelOracle): void {
    expect(report.mismatched.slice(0, 10)).toEqual([]);
    expect(report.matched).toBe(report.compared);
    expect(report.frozen).toBe(0);
    expect(oracle.fallbacks).toEqual([]);
    expect(oracle.spillOverflows).toEqual([]);
}

/** Deterministic PRNG (mulberry32): the same seed gives the same input sets on every run. */
export function seededRandom(seed: number) {
    let a = seed >>> 0;
    const next = (): number => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        /** Integer in [min, max]. */
        int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
        /** Number in [min, max] on a grid of `step` (plan dimensions are typed to 1–2 decimals). */
        step: (min: number, max: number, step: number) => {
            const n = Math.floor((max - min) / step + 1e-9);
            return Number((min + Math.floor(next() * (n + 1)) * step).toFixed(6));
        },
        pick: <T>(items: readonly T[]): T => {
            const v = items[Math.floor(next() * items.length)];
            if (v === undefined) throw new Error('pick from an empty list');
            return v;
        },
        /** true with probability p. */
        chance: (p: number) => next() < p,
    };
}

export type Random = ReturnType<typeof seededRandom>;

/** `expect(actual).toBeCloseTo(expected)` with the oracle tolerance and a label that names the cell. */
export function expectClose(actual: number | undefined, expected: number, label: string): void {
    const a = actual ?? NaN;
    if (!closeTo(a, expected)) {
        expect.fail(`${label}: app ${a} ≠ Excel ${expected} (Δ ${a - expected})`);
    }
}

/** The BOQ item row with this key (template rows: 'R38'; slot rows: 'footing:rebar:DB12'). */
export function boqItem(boq: BoqResult, key: string): BoqItemRow | undefined {
    for (const s of boq.sections) {
        const row = s.rows.find(r => r.key === key);
        if (row?.type === 'item') return row;
    }
    return undefined;
}

/** BOQ (Home) columns compared for a row: E qty, H gross qty, J material, L labour, M total. */
export const BOQ_COLUMNS = [
    ['E', (r: BoqItemRow) => r.qty],
    ['H', (r: BoqItemRow) => r.grossQty ?? 0],
    ['J', (r: BoqItemRow) => r.matTotal],
    ['L', (r: BoqItemRow) => r.labTotal],
    ['M', (r: BoqItemRow) => r.total],
] as const;

/** Compares one app BOQ row with an Excel BOQ (Home) row, column by column (E, H, J, L, M). */
export function expectBoqRow(oracle: ExcelOracle, boq: BoqResult, key: string, excelRow: number, label = ''): void {
    const row = boqItem(boq, key);
    if (!row) {
        expect.fail(`${label} BOQ row ${key} missing in the app`);
        return;
    }
    for (const [col, get] of BOQ_COLUMNS) {
        expectClose(get(row), oracle.num(`BOQ (Home)!${col}${excelRow}`), `${label} BOQ ${col}${excelRow} (${key})`);
    }
}
