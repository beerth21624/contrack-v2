// Whole-workbook oracle self-test (all 37 sheets incl. Man-Day / S-Curve / CashFlow; ~10 s to load).
// Kept apart from excel-oracle.test.ts so that file stays fast; it still runs in `npx vitest run`.
import { describe, expect, it } from 'vitest';
import { ExcelOracle, V5_FIXTURE } from './excel-oracle';
import { expectCleanSelfTest } from './oracle-helpers';

/** Cells whose cached value exceljs cannot read (TEXT(…,"mmm-yy") results in date-formatted, merged cells). */
const UNREADABLE = ['J', 'N', 'R', 'V', 'Z', 'AD', 'AH', 'AL', 'AP', 'AT', 'AX', 'BB'].map(c => `S-Curve_Plan_Basic!${c}11`);

describe('Excel v5 oracle self-test, whole workbook', () => {
    it('with no input changed, 9,449 of 9,449 comparable formula cells reproduce the cached value', async () => {
        const oracle = await ExcelOracle.load(V5_FIXTURE);
        const report = oracle.selfTest();
        expectCleanSelfTest(report, oracle);
        expect(report.compared).toBe(9449);
        expect(report.uncached).toEqual(UNREADABLE);
        // the unreadable cells are still checked indirectly: CashFLOW_Basic D4 = INDEX(S-Curve J11:ZZ11, 1, 1)
        expect(oracle.get('CashFLOW_Basic!D4')).toBe('ม.ค.-26');
        expect(oracle.get('S-Curve_Plan_Basic!J11')).toBe('ม.ค.-26');
        expect(oracle.num('BOQ (Home)!M310')).toBeCloseTo(1850317.34, 2);
    }, 120_000);
});
