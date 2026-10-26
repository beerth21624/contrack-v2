// Differential test: misc compute() + BOQ section 28 (Excel row 279, subtotal 280) vs the real Excel v5 formulas
// (evaluated by the oracle) on ~50 seeded random lists + named edge cases. The list drives sheet 20 B5:D18 (14 rows);
// BOQ row 279 reads B5:C5 only, so every further row is a D5 row. The dropdown has a single option; free-text items
// with their own price are part of the design (spec 05 D13), so the generator types many. Shared pick-list comparison
// and the D5 deltas: src/test-utils/pick-list-oracle.ts. Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    checkPickListCase, excelCatalogue, expectCatalogueMatchesExcel, namedPickListCases, pickListBranches,
    pickListComparedRefs, randomPickListCases, requiredPickListBranches, type PickListSheet,
} from '../../../test-utils/pick-list-oracle';
import { pickRow, type PickListInput } from '../shared/pick-list';
import { MISC_CATALOGUE, MISC_ITEMS, MISC_UNITS, misc } from '.';

const SHEET: PickListSheet = {
    calc: 'misc',
    sheet: 'เบ็ดเตล็ด_Other',
    firstRow: 5, capacity: 14,
    boqFirstRow: 279, boqRows: 1,
    section: 28, subtotalRow: 280,
    options: MISC_ITEMS, units: MISC_UNITS, catalogue: MISC_CATALOGUE,
    sample: misc.defaults(),
    freeText: ['ราวกันตกสแตนเลส บันได', 'ม่านม้วน ห้องนั่งเล่น', 'ตู้จดหมาย', 'ราวตากผ้า'],
};

const CASES: [string, PickListInput][] = [
    ...namedPickListCases(SHEET),
    ['free text in the wired row 5 (Excel keeps the railing price typed in I279)', {
        items: [pickRow('ตู้จดหมาย', 1, 'ชุด'), pickRow('ราวกันตกกระจก เฉลียง 1 และ 2', 3.6, 'ม.')],
    }],
    ...randomPickListCases(SHEET, 28_279),
];

describe('เบ็ดเตล็ด_Other vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        for (const ref of pickListComparedRefs(SHEET)) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the app catalogue = the unit / price typed in Excel BOQ row 279 for the single dropdown option', () => {
        oracle.reset();
        expectCatalogueMatchesExcel(oracle, SHEET);
    });

    it('the cases cover every branch (duplicates, free text, typed prices, qty 0, full sheet, D5 rows)', () => {
        oracle.reset();
        const catalogue = excelCatalogue(oracle, SHEET);
        const seen = new Set(CASES.flatMap(([, input]) => [...pickListBranches(SHEET, input, catalogue)]));
        expect(requiredPickListBranches(SHEET).filter(b => !seen.has(b))).toEqual([]);
    });

    it.each(CASES)('%s', (_name, input) => {
        checkPickListCase(oracle, SHEET, input);
    });
});
