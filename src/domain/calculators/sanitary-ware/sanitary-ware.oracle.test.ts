// Differential test: sanitary-ware compute() + BOQ section 29 (Excel rows 282–291, subtotal 292) vs the real Excel v5
// formulas (evaluated by the oracle) on ~50 seeded random lists + named edge cases. The list drives sheet 21 B5:D19
// (15 rows); BOQ rows 282–291 read B5:C14 by position. Shared pick-list comparison and the D5 deltas:
// src/test-utils/pick-list-oracle.ts. Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    checkPickListCase, excelCatalogue, expectCatalogueMatchesExcel, namedPickListCases, pickListBranches,
    pickListComparedRefs, randomPickListCases, requiredPickListBranches, type PickListSheet,
} from '../../../test-utils/pick-list-oracle';
import type { PickListInput } from '../shared/pick-list';
import { SANITARY_WARE_CATALOGUE, SANITARY_WARE_ITEMS, SANITARY_WARE_UNITS, addBathroomSet, sanitaryWare } from '.';

const SHEET: PickListSheet = {
    calc: 'sanitary-ware',
    sheet: 'สุขภัณฑ์_Sanitary',
    firstRow: 5, capacity: 15,
    boqFirstRow: 282, boqRows: 10,
    section: 29, subtotalRow: 292,
    options: SANITARY_WARE_ITEMS, units: SANITARY_WARE_UNITS, catalogue: SANITARY_WARE_CATALOGUE,
    sample: sanitaryWare.defaults(),
    freeText: ['อ่างอาบน้ำ', 'ก๊อกน้ำซิงค์ล้างจาน', 'โถปัสสาวะชาย'],
};

const CASES: [string, PickListInput][] = [
    ...namedPickListCases(SHEET),
    ['three bathrooms (addBathroomSet × 3, journey helper)', { items: addBathroomSet(addBathroomSet(addBathroomSet([]))) }],
    ...randomPickListCases(SHEET, 29_282),
];

describe('สุขภัณฑ์_Sanitary vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        for (const ref of pickListComparedRefs(SHEET)) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the app catalogue = the unit / prices typed in Excel BOQ rows 282–291, for every dropdown option', () => {
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
