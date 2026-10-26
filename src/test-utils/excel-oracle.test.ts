import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
    expandLet, excelRounding, guardBlankCriteria, loadV5Oracle, parseGSheets, productSkipsBlankIf, qualifyRefs,
    rewriteIndex, rewriteRowColumnArrays, sameValue, shiftFormula, toHyperFormula, type ExcelOracle,
} from './excel-oracle';
import { expectCleanSelfTest } from './oracle-helpers';

describe('formula rewrites', () => {
    it('shared formulas shift references, never text inside strings', () => {
        expect(shiftFormula(' R8 * SWITCH(O8,  "RB6", 0.222,  "DB12", 0.888, 0) ', 1, 0))
            .toBe(' R9 * SWITCH(O9,  "RB6", 0.222,  "DB12", 0.888, 0) ');
        expect(shiftFormula("SUMIF($O$8:$O$100,\"RB6\",S8:S100)+'Sheet 1'!A1+B$2+$C3", 2, 1))
            .toBe("SUMIF($O$8:$O$100,\"RB6\",T10:T102)+'Sheet 1'!B3+C$2+$C5");
        expect(shiftFormula("SUM(K:K)+'X'!$I:$M", 5, 1)).toBe("SUM(L:L)+'X'!$I:$M");
        expect(shiftFormula('A1', -1, 0)).toBe('#REF!');
    });

    it('LET is substituted (innermost first; later names may use earlier ones)', () => {
        expect(expandLet('LET(a, 2, b, a*3, a+b)')).toBe('( ( 2)+( ( 2)*3))');
        expect(expandLet('LET(x, "x", x & "!x")')).toBe('( ( "x") & "!x")');
        expect(toHyperFormula('LET(done,$BF$14:$BF$84, SUMPRODUCT(IFERROR(done*1,0)))')).toBe('=( SUMPRODUCT(IFERROR(($BF$14:$BF$84)*1,0)))');
    });

    it('INDEX(range, r, 0) lists the columns; INDEX(oneRow, n) reads column n', () => {
        expect(rewriteIndex("INDEX('S'!$I:$M, MATCH(1,B:B,0),0)")).toBe("INDEX('S'!$I:$M, MATCH(1,B:B,0),{1,2,3,4,5})");
        expect(rewriteIndex('INDEX($I$6:$M$6, 2)')).toBe('INDEX($I$6:$M$6,1, 2)');
        expect(rewriteIndex('INDEX($F$14:$F$84, 3)')).toBe('INDEX($F$14:$F$84, 3)');
    });

    it('a criterion pointing at a cell counts an empty cell as 0', () => {
        expect(guardBlankCriteria("SUMIFS(K:K, D:D,$B11, E:E,\"x\")")).toBe("SUMIFS(K:K, D:D,IF(ISBLANK($B11),0,$B11), E:E,\"x\")");
        expect(guardBlankCriteria('SUMIF(A:A,"PLAN",G:G)')).toBe('SUMIF(A:A,"PLAN",G:G)');
    });

    it('Excel rounding, array ROW, PRODUCT skipping blank IF results, scientific numbers', () => {
        expect(excelRounding('ROUNDUP((F8+G8)/N8,0)+ROUND(A1,2)')).toBe('ROUNDUP(PRECISE15((F8+G8)/N8),0)+ROUND(PRECISE15(A1),2)');
        expect(rewriteRowColumnArrays('MAX(FILTER(ROW($I$14:$I$84), X))+ROW(A1)')).toBe('MAX(FILTER(SEQUENCE(71,1,14), X))+ROW(A1)');
        expect(productSkipsBlankIf('PRODUCT(IF(E5=" ",1,E5),2)')).toBe('PRODUCT(IF(ISBLANK(IF(E5=" ",1,E5)),1,IF(E5=" ",1,E5)),2)');
        expect(toHyperFormula('MAX(0, s+1E-12)')).toBe('=MAX(0, s+(1*10^(-12)))');
    });

    it('Google Sheets exports: the inner formula and the frozen fallback', () => {
        expect(parseGSheets('IFERROR(__xludf.DUMMYFUNCTION("FILTER(B6:B9, C6:C9=""x"")"),"D1 ")'))
            .toEqual({ inner: 'FILTER(B6:B9, C6:C9="x")', fallback: 'D1 ', fallbackExpr: '"D1 "' });
        expect(parseGSheets('IFERROR(__xludf.DUMMYFUNCTION("""COMPUTED_VALUE"""),12.5)')?.inner).toBe('"COMPUTED_VALUE"');
        expect(parseGSheets('IFERROR(__xludf.DUMMYFUNCTION("A"&"B"),0)')?.inner).toBe('AB');
        expect(parseGSheets('SUM(A1:A3)')).toBeUndefined();
        expect(qualifyRefs("INDEX($I$6:$M$6, MATCH(REGEXEXTRACT($D43,\"RB6\"),'S'!$I$5:$M$5,0))", 'BOQ (Home)'))
            .toBe("INDEX('BOQ (Home)'!$I$6:$M$6, MATCH(REGEXEXTRACT('BOQ (Home)'!$D43,\"RB6\"),'S'!$I$5:$M$5,0))");
    });

    it('values compare within max(1e-6, 1e-9·|x|); text trimmed; blank ≡ ""', () => {
        expect(sameValue(104693.069444, 104693.0694)).toBe(true);
        expect(sameValue(1.0000011, 1)).toBe(false);
        expect(sameValue('บานอลูมิเนียม ', 'บานอลูมิเนียม')).toBe(true);
        expect(sameValue(null, '')).toBe(true);
        expect(sameValue(0, null)).toBe(false);
    });
});

// The whole-workbook self-test (all 37 sheets, ~10 s to load) is in excel-oracle.slow.test.ts.
describe('Excel v5 oracle self-test: with no input changed, every formula reproduces the cached value', () => {
    describe('calculator scope (planning sheets left out, as the calculator oracle tests use it)', () => {
        let oracle: ExcelOracle;
        beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

        it('matches the cached values too', () => {
            const report = oracle.selfTest();
            expectCleanSelfTest(report, oracle);
            expect(report.compared).toBe(3062);
        });

        it('setInputs recalculates across sheets; reset restores the workbook', () => {
            oracle.setInputs({ 'ฐานราก_Footing!C8': 10 });
            expect(oracle.num('ฐานราก_Footing!H6')).toBeCloseTo(10 * 1.4 * 1.4 * 1.3, 9);
            expect(oracle.num('BOQ (Home)!E38')).toBeCloseTo(25.48, 9);
            oracle.reset();
            expect(oracle.num('BOQ (Home)!E38')).toBeCloseTo(53.508, 9);
            expect(oracle.selfTest().mismatched).toEqual([]);
        });

        it('array spills follow the inputs and overflow like Google Sheets', () => {
            oracle.replaceInputs({ 'ฐานราก_Footing!Y8': 'DB12' });   // ring bars DB12 too → one size left
            expect(oracle.get('BOQ (Home)!D43')).toBe('- เหล็ก DB12');
            expect(oracle.get('BOQ (Home)!D44')).toBeNull();
            expect(oracle.num('BOQ (Home)!E43')).toBeCloseTo(335.664 + 100.8 * 0.888, 9);
            oracle.replaceInputs({ 'ฐานราก_Footing!Y8': 'RB6', 'ฐานราก_Footing!T8': 'DB16' });   // three sizes, two rows
            expect(oracle.get('BOQ (Home)!D43')).toMatchObject({ error: '#SPILL!' });
            expect(oracle.spillOverflows).toEqual([{ ref: 'BOQ (Home)!D43', room: 2, needed: 3 }]);
            oracle.reset();
            expect(oracle.spillOverflows).toEqual([]);
        });

        it('refuses to overwrite a formula that reads other cells (a mapping mistake)', () => {
            expect(() => { oracle.setInputs({ 'ฐานราก_Footing!I8': 1 }); }).toThrow(/not an input cell/);
            expect(() => { oracle.setInputs({ 'ก่ออิฐ_Brick!E5': 40 }); }).not.toThrow();   // =9.5+7+… is a typed value
            oracle.reset();
        });

        it('a typed formula may replace a yellow cell\'s default link; formula null empties it', () => {
            expect(() => { oracle.setInputs({ 'มุงหลังคา_Roofing!E5': 10 }); }).toThrow(/not an input cell/);   // E5 = K7
            oracle.replaceInputs({ 'มุงหลังคา_Roofing!E5': { formula: '=K7*2' }, 'มุงหลังคา_Roofing!E6': { formula: '=1+2' } });
            expect(oracle.num('มุงหลังคา_Roofing!E5')).toBeCloseTo((113 / Math.cos((40 * Math.PI) / 180)) * 2, 9);
            expect(oracle.num('BOQ (Home)!E163')).toBe(Math.ceil(3 * 3.3));   // G6 = ROUNDUP(E6*C6)
            oracle.replaceInputs({ 'มุงหลังคา_Roofing!E5': { formula: null } });
            expect(oracle.get('มุงหลังคา_Roofing!E5')).toBeNull();
            expect(oracle.num('BOQ (Home)!E162')).toBe(0);
            expect(() => { oracle.setInputs({ 'มุงหลังคา_Roofing!E5': { formula: '=(1+' } }); }).toThrow(/cannot parse/);
            oracle.reset();
            expect(oracle.num('BOQ (Home)!E162')).toBe(1623);
        });
    });
});

describe('the oracle stays out of the app bundle', () => {
    it('no app module imports hyperformula or src/test-utils', () => {
        const src = fileURLToPath(new URL('..', import.meta.url));
        const offenders: string[] = [];
        for (const entry of fs.readdirSync(src, { recursive: true, encoding: 'utf8' })) {
            const file = path.join(src, entry);
            if (!/\.(ts|tsx)$/.test(file) || /\.test\.tsx?$/.test(file) || file.includes(`${path.sep}test-utils${path.sep}`)) continue;
            const text = fs.readFileSync(file, 'utf8');
            if (/from\s+['"](hyperformula|[^'"]*test-utils[^'"]*)['"]|import\(\s*['"]hyperformula/.test(text)) offenders.push(entry);
        }
        expect(offenders).toEqual([]);
    });
});
