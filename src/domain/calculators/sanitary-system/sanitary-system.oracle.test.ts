// Differential test: sanitary-system compute() + BOQ section 27 (Excel rows 273–276, subtotal 277) vs the real Excel
// v5 formulas (evaluated by the oracle) on ~50 seeded random lists + named edge cases. The list drives sheet 07
// B5:D19 (15 rows); BOQ rows 273–276 read B5:C8 by position and carry the note N รถแมคโครเล็ก on rows 274–276 (the
// app's note follows the item). Shared pick-list comparison and the D5 deltas: src/test-utils/pick-list-oracle.ts.
// Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    checkPickListCase, excelCatalogue, expectCatalogueMatchesExcel, namedPickListCases, pickListBranches,
    pickListComparedRefs, randomPickListCases, requiredPickListBranches, type PickListSheet,
} from '../../../test-utils/pick-list-oracle';
import type { PickListInput } from '../shared/pick-list';
import { SANITARY_SYSTEM_CATALOGUE, SANITARY_SYSTEM_ITEMS, SANITARY_SYSTEM_UNITS, sanitarySystem } from '.';

const SHEET: PickListSheet = {
    calc: 'sanitary-system',
    sheet: 'ระบบสุขาภิบาล_Sanitary System',
    firstRow: 5, capacity: 15,
    boqFirstRow: 273, boqRows: 4,
    section: 27, subtotalRow: 277,
    options: SANITARY_SYSTEM_ITEMS, units: SANITARY_SYSTEM_UNITS, catalogue: SANITARY_SYSTEM_CATALOGUE,
    sample: sanitarySystem.defaults(),
    freeText: ['ถังบำบัดน้ำเสียสำเร็จรูป ขนาด 1000 ลิตร', 'บ่อพักน้ำทิ้ง ขนาด 60 x 60 ซม.', 'ปั๊มน้ำทิ้ง'],
};

const CASES: [string, PickListInput][] = [
    ...namedPickListCases(SHEET),
    ...randomPickListCases(SHEET, 27_273),
];

describe('ระบบสุขาภิบาล_Sanitary System vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        for (const ref of pickListComparedRefs(SHEET)) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the app catalogue = the unit / prices / note typed in Excel BOQ rows 273–276, for every dropdown option', () => {
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
