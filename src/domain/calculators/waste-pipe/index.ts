// Sheet "ท่อน้ำทิ้ง_Waste Pipe" (Excel v5 sheet 05) → BOQ (Home) section 9, sub-item 1) ท่อน้ำทิ้ง, rows 84–86.
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §1. Deck p42–43: "ท่อน้ำทิ้ง จะคำนวณมาจากโปรแกรม ท่อน้ำทิ้ง".
// The BOQ template applies the 15 % waste, labour on gross (L = K × H, §0.1 / D11) and the 50 % consumables row R87;
// this sheet only supplies E84:E86 (and D84:D86 = B5:B7).
import { defineCalculator } from '../types';
import {
    blankRuns, computePipeRuns, pipeRunsBoqText, type PipeBoqLine, type PipePlainLabel, type PipeRunsInput,
} from './pipe-runs';

export {
    runLength, pipeRunTargets, normalizeSize, unlinkedRuns, sizeMismatches, sizeFromLabel, blankRuns, plainLabel,
    type PipeRun, type PipeRunsInput, type PipeBoqLine, type PipePlainLabel,
} from './pipe-runs';

export type WastePipeInput = PipeRunsInput;

/** Sheet subtitle B3. Excel says `…ความยาวท่อน้ำดี` (copy-paste slip from the water-pipe sheet, fixed per D1). */
export const WASTE_PIPE_SUBTITLE = ': ตารางคำนวณปริมาณความยาวท่อน้ำทิ้ง';

/** Dropdown B5:B18 (Excel list order). */
export const WASTE_PIPE_ITEMS = [
    'ท่อน้ำทิ้งชักโครก PVC 4"',
    'ท่อน้ำทิ้ง ØW ØFD PVC 2"',
    'ท่ออากาศถังบำบัด PVC 1"',
] as const;

/** Guided journey: plain names of the B options (keyed by the Excel text). */
export const WASTE_PIPE_PLAIN: Record<string, PipePlainLabel> = {
    'ท่อน้ำทิ้งชักโครก PVC 4"': { name: 'ท่อส้วม (ชักโครก)', hint: 'จากชักโครกทุกตัวถึงถังบำบัด' },
    'ท่อน้ำทิ้ง ØW ØFD PVC 2"': {
        name: 'ท่อน้ำทิ้ง (อ่างล้างหน้า / ท่อระบายพื้น)',
        hint: 'จุด W และ FD ในแบบ ถึงบ่อพัก/ท่อระบายนอกบ้าน',
    },
    'ท่ออากาศถังบำบัด PVC 1"': { name: 'ท่ออากาศถังบำบัด', hint: 'จากถังบำบัดขึ้นไประบายอากาศ ส่วนใหญ่เป็นแนวดิ่ง' },
};

/** Dropdown C5:C18 (Excel's `PVC 1" ` has a trailing space, dropped here). */
export const WASTE_PIPE_SIZES = ['PVC 1"', 'PVC 2"', 'PVC 4"'] as const;

/** BOQ rows fed by sheet rows 5, 6, 7 (E84 = F5, E85 = F6, E86 = F7) and the size their typed price is for. */
export const WASTE_PIPE_BOQ_LINES: readonly PipeBoqLine[] = [
    { line: 'R84', size: 'PVC 4"' },   // I 200 / K 100
    { line: 'R85', size: 'PVC 2"' },   // I 60 / K 50
    { line: 'R86', size: 'PVC 1"' },   // I 20 / K 50
];

/** Excel v5 sample rows 5–7. */
const defaults = (): WastePipeInput => ({
    runs: [
        { label: 'ท่อน้ำทิ้งชักโครก PVC 4"', size: 'PVC 4"', horizontal: 4, vertical: 2 },    // row 5
        { label: 'ท่อน้ำทิ้ง ØW ØFD PVC 2"', size: 'PVC 2"', horizontal: 15.6, vertical: 5.5 }, // row 6 (D6 =14.5+1.1)
        { label: 'ท่ออากาศถังบำบัด PVC 1"', size: 'PVC 1"', horizontal: 4, vertical: 4 },      // row 7
    ],
});

export const wastePipe = defineCalculator<WastePipeInput>({
    id: 'waste-pipe',
    sheetName: 'ท่อน้ำทิ้ง_Waste Pipe',
    title: 'โปรแกรมถอดแบบ – งานท่อน้ำทิ้ง Waste Pipe', // A2 (Excel has a double space after the dash)
    titleEn: 'Waste Pipe',
    sections: [9],
    deps: [],
    defaults,
    // The three fixed rows (B/C typed in Excel, not inputs) with no length: every BOQ line 0.
    blank: () => blankRuns(defaults()),
    compute: (input) => computePipeRuns(input, WASTE_PIPE_BOQ_LINES),
    boqLinks: WASTE_PIPE_BOQ_LINES.map(({ line }) => ({ line, field: 'qty' as const, output: line })),
    boqText: (input) => pipeRunsBoqText(input, WASTE_PIPE_BOQ_LINES),
});
