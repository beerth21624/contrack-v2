// Differential test: electrical-equipment compute() + BOQ section 26 (group อุปกรณ์ไฟฟ้า, Excel rows 265–270) vs the
// real Excel v5 formulas (evaluated by the oracle) on ~50 seeded random lists + named edge cases. The list drives
// sheet 11 'อุปกรณ์ไฟฟ้า_Equipment ' (trailing space) B5:D18 (14 rows); BOQ rows 265–270 read B5:C10 by position. The
// load-center group (rows 256–263) of the same section stays at the sample on both sides. Shared pick-list comparison
// and the D5 deltas: src/test-utils/pick-list-oracle.ts. Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    checkPickListCase, excelCatalogue, expectCatalogueMatchesExcel, namedPickListCases, pickListBranches,
    pickListComparedRefs, randomPickListCases, requiredPickListBranches, type PickListSheet,
} from '../../../test-utils/pick-list-oracle';
import type { PickListInput } from '../shared/pick-list';
import { EQUIPMENT_CATALOGUE, EQUIPMENT_ITEMS, EQUIPMENT_UNITS, electricalEquipment } from '.';

const SHEET: PickListSheet = {
    calc: 'electrical-equipment',
    sheet: 'อุปกรณ์ไฟฟ้า_Equipment ',
    firstRow: 5, capacity: 14,
    boqFirstRow: 265, boqRows: 6,
    section: 26, subtotalRow: 271,
    options: EQUIPMENT_ITEMS, units: EQUIPMENT_UNITS, catalogue: EQUIPMENT_CATALOGUE,
    sample: electricalEquipment.defaults(),
    freeText: ['โคมไฟติดผนังภายนอก', 'พัดลมดูดอากาศ', 'สวิตซ์สองทาง (พร้อมหน้ากาก)'],
};

const CASES: [string, PickListInput][] = [
    ...namedPickListCases(SHEET),
    ...randomPickListCases(SHEET, 26_265),
];

describe('อุปกรณ์ไฟฟ้า_Equipment vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        for (const ref of pickListComparedRefs(SHEET)) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the app catalogue = the unit / prices typed in Excel BOQ rows 265–270, for every dropdown option', () => {
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
