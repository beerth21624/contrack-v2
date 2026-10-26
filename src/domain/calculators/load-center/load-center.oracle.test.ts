// Differential test: load-center compute() + BOQ section 26 (group งานตู้ควบคุมระบบไฟฟ้า, Excel rows 256–263) vs the
// real Excel v5 formulas (evaluated by the oracle) on ~50 seeded random lists + named edge cases. The list drives
// sheet 10 B5:D19 (15 rows); BOQ rows 256–263 read B5:C12 by position. The equipment group (rows 265–270) of the same
// section stays at the sample on both sides. Shared pick-list comparison and the D5 deltas:
// src/test-utils/pick-list-oracle.ts. Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    checkPickListCase, excelCatalogue, expectCatalogueMatchesExcel, namedPickListCases, pickListBranches,
    pickListComparedRefs, randomPickListCases, requiredPickListBranches, type PickListSheet,
} from '../../../test-utils/pick-list-oracle';
import type { PickListInput } from '../shared/pick-list';
import { LOAD_CENTER_CATALOGUE, LOAD_CENTER_ITEMS, LOAD_CENTER_UNITS, loadCenter } from '.';

const SHEET: PickListSheet = {
    calc: 'load-center',
    sheet: 'ตู้ควบคุม_Load Center',
    firstRow: 5, capacity: 15,
    boqFirstRow: 256, boqRows: 8,
    section: 26, subtotalRow: 271,
    options: LOAD_CENTER_ITEMS, units: LOAD_CENTER_UNITS, catalogue: LOAD_CENTER_CATALOGUE,
    sample: loadCenter.defaults(),
    freeText: ['เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 32 A', 'ตู้ Consumer Unit ขนาด 12 ช่อง', 'กล่องพักสาย'],
};

const CASES: [string, PickListInput][] = [
    ...namedPickListCases(SHEET),
    ...randomPickListCases(SHEET, 26_256),
];

describe('ตู้ควบคุม_Load Center vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        for (const ref of pickListComparedRefs(SHEET)) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the app catalogue = the unit / prices typed in Excel BOQ rows 256–263, for every dropdown option', () => {
        oracle.reset();
        expectCatalogueMatchesExcel(oracle, SHEET);
    });

    it('the cases cover every branch (duplicates, free text, typed prices, qty 0, full sheet, D5 rows, every option)', () => {
        oracle.reset();
        const catalogue = excelCatalogue(oracle, SHEET);
        const seen = new Set(CASES.flatMap(([, input]) => [...pickListBranches(SHEET, input, catalogue)]));
        expect(requiredPickListBranches(SHEET).filter(b => !seen.has(b))).toEqual([]);
    });

    it.each(CASES)('%s', (_name, input) => {
        checkPickListCase(oracle, SHEET, input);
    });
});
