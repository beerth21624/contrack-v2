// Differential test: water-pipe compute() + BOQ section 21 rows 213–215 (and the section subtotal, row 216) vs the
// real Excel v5 formulas (evaluated by the oracle) on ~50 seeded random run tables + named edge cases. The runs drive
// sheet 06 B5:E18 (14 rows); BOQ rows 213–214 read rows 5–6 by position, R215 is 50 % of their J + L. The toilet-tile
// rows of section 21 stay at the sample on both sides. Shared comparison and the D1 / D5 deltas:
// src/test-utils/pipe-runs-oracle.ts. Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    checkPipeRunsCase, lineSizes, namedPipeRunsCases, pipeRunsBranches, pipeRunsComparedRefs, randomPipeRunsCases,
    requiredPipeRunsBranches, type PipeRunsSheet,
} from '../../../test-utils/pipe-runs-oracle';
import { BOQ_TEMPLATE_V5 } from '../../boq/template.v5';
import { WATER_PIPE_BOQ_LINES, WATER_PIPE_ITEMS, WATER_PIPE_SIZES, normalizeSize, waterPipe, type WaterPipeInput } from '.';

const templateDesc = (key: string) => {
    for (const s of BOQ_TEMPLATE_V5) for (const l of s.lines) if (l.type === 'item' && l.key === key) return l.desc;
    throw new Error(`no template row ${key}`);
};

const SHEET: PipeRunsSheet = {
    calc: 'water-pipe',
    sheet: 'ท่อน้ำดี_Water Pipe',
    firstRow: 5, capacity: 14,
    boqFirstRow: 213, boqRows: 2,
    consumablesRow: 215, consumablesPct: 0.5,
    section: 21, subtotalRow: 216,
    shortRangeRows: [213, 214, 215],   // J216 = SUM(J210:J211), L216 = SUM(L210:L211); M216 = SUM(M210:M215)
    templateDesc: WATER_PIPE_BOQ_LINES.map(l => templateDesc(l.line)),
    items: WATER_PIPE_ITEMS,
    sizes: WATER_PIPE_SIZES,   // C5:C18 dropdown (no stray spaces in this sheet)
    sample: waterPipe.defaults(),
    blank: waterPipe.blank?.() ?? { runs: [] },
    freeText: ['ท่อน้ำร้อน PPR 1/2"', 'ท่อเมนภายใน PVC 1"'],
};

const CASES: [string, WaterPipeInput][] = [
    ...namedPipeRunsCases(SHEET),
    ...randomPipeRunsCases(SHEET, 21_213),
];

describe('ท่อน้ำดี_Water Pipe vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        for (const ref of pipeRunsComparedRefs(SHEET)) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the BOQ lines are priced for the pipe size of the sample row they read (C5:C6); labour on gross; J216/L216 short (D1)', () => {
        oracle.reset();
        expect(lineSizes(oracle, SHEET)).toEqual(WATER_PIPE_BOQ_LINES.map(l => normalizeSize(l.size)));
        expect(oracle.formula('BOQ (Home)!L213')).toBe('K213*H213');
        expect(oracle.formula('BOQ (Home)!J216')).toBe('SUM(J210:J211)');
        expect(oracle.formula('BOQ (Home)!M216')).toBe('SUM(M210:M215)');
    });

    it('the cases cover every branch (D5 lines / unlinked runs, blank labels, stray spaces, full sheet)', () => {
        oracle.reset();
        const seen = new Set(CASES.flatMap(([, input]) => [...pipeRunsBranches(oracle, SHEET, input)]));
        expect(requiredPipeRunsBranches(SHEET).filter(b => !seen.has(b))).toEqual([]);
    });

    it.each(CASES)('%s', (_name, input) => {
        checkPipeRunsCase(oracle, SHEET, input);
    });
});
