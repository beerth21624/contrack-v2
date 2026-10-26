// Differential test: waste-pipe compute() + BOQ section 9 rows 84–87 (and the section subtotal, row 95) vs the real
// Excel v5 formulas (evaluated by the oracle) on ~50 seeded random run tables + named edge cases. The runs drive
// sheet 05 B5:E18 (14 rows); BOQ rows 84–86 read rows 5–7 by position, R87 is 50 % of their J + L. The slab-on-grade
// rows of section 9 stay at the sample on both sides. Shared comparison and the D1 / D5 deltas:
// src/test-utils/pipe-runs-oracle.ts. Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle } from '../../../test-utils/excel-oracle';
import {
    checkPipeRunsCase, lineSizes, namedPipeRunsCases, pipeRunsBranches, pipeRunsComparedRefs, randomPipeRunsCases,
    requiredPipeRunsBranches, type PipeRunsSheet,
} from '../../../test-utils/pipe-runs-oracle';
import { BOQ_TEMPLATE_V5 } from '../../boq/template.v5';
import { WASTE_PIPE_BOQ_LINES, WASTE_PIPE_ITEMS, normalizeSize, wastePipe, type WastePipeInput } from '.';

const templateDesc = (key: string) => {
    for (const s of BOQ_TEMPLATE_V5) for (const l of s.lines) if (l.type === 'item' && l.key === key) return l.desc;
    throw new Error(`no template row ${key}`);
};

const SHEET: PipeRunsSheet = {
    calc: 'waste-pipe',
    sheet: 'ท่อน้ำทิ้ง_Waste Pipe',
    firstRow: 5, capacity: 14,
    boqFirstRow: 84, boqRows: 3,
    consumablesRow: 87, consumablesPct: 0.5,
    section: 9, subtotalRow: 95,
    shortRangeRows: [84, 85, 86, 87],   // J95 = SUM(J88:J94), L95 = SUM(L88:L94); M95 = SUM(M83:M94)
    templateDesc: WASTE_PIPE_BOQ_LINES.map(l => templateDesc(l.line)),
    items: WASTE_PIPE_ITEMS,
    sizes: ['PVC 1" ', 'PVC 2"', 'PVC 4"'],   // C5:C18 dropdown, verbatim
    sample: wastePipe.defaults(),
    blank: wastePipe.blank?.() ?? { runs: [] },
    freeText: ['ท่อน้ำทิ้งซิงค์ครัว PVC 2"', 'ท่อระบายน้ำฝน PVC 3"'],
};

const CASES: [string, WastePipeInput][] = [
    ...namedPipeRunsCases(SHEET),
    ...randomPipeRunsCases(SHEET, 9_084),
];

describe('ท่อน้ำทิ้ง_Waste Pipe vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        for (const ref of pipeRunsComparedRefs(SHEET)) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the BOQ lines are priced for the pipe size of the sample row they read (C5:C7); labour on gross; J95/L95 short (D1)', () => {
        oracle.reset();
        expect(lineSizes(oracle, SHEET)).toEqual(WASTE_PIPE_BOQ_LINES.map(l => normalizeSize(l.size)));
        expect(oracle.formula('BOQ (Home)!L84')).toBe('K84*H84');
        expect(oracle.formula('BOQ (Home)!J95')).toBe('SUM(J88:J94)');
        expect(oracle.formula('BOQ (Home)!M95')).toBe('SUM(M83:M94)');
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
