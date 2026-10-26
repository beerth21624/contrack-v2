// Sheet "ท่อน้ำดี_Water Pipe" (Excel v5 sheet 06) → BOQ (Home) section 21, sub-item 3) งานระบบประปา ท่อน้ำดี,
// rows 213–214. Spec: docs/excel-spec/05-mep-sanitary-misc.md §2. Deck p92: the water pipe belongs to STEP 21.
// The BOQ template applies the 15 % waste, labour on gross (L = K × H, §0.1 / D11) and the 50 % consumables row R215;
// this sheet only supplies E213:E214 (and D213:D214 = B5:B6). Same table and rules as the waste-pipe sheet.
import { defineCalculator } from '../types';
import { computePipeRuns, pipeRunsBoqText, type PipeBoqLine, type PipeRunsInput } from '../waste-pipe/pipe-runs';

export {
    runLength, pipeRunTargets, normalizeSize, unlinkedRuns, sizeMismatches, sizeFromLabel,
    type PipeRun, type PipeRunsInput, type PipeBoqLine,
} from '../waste-pipe/pipe-runs';

export type WaterPipeInput = PipeRunsInput;

/** Sheet subtitle B3 (verbatim). */
export const WATER_PIPE_SUBTITLE = ': ตารางคำนวณปริมาณความยาวท่อน้ำดี';

/** Dropdown B5:B18 (Excel list order). */
export const WATER_PIPE_ITEMS = [
    'ท่อเมนภายนอก PVC 3/4"',
    'ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2"',
] as const;

/** Dropdown C5:C18. */
export const WATER_PIPE_SIZES = ['PVC 1/2"', 'PVC 3/4"'] as const;

/** BOQ rows fed by sheet rows 5, 6 (E213 = F5, E214 = F6) and the size their typed price is for. */
export const WATER_PIPE_BOQ_LINES: readonly PipeBoqLine[] = [
    { line: 'R213', size: 'PVC 3/4"' },   // I 20 / K 40
    { line: 'R214', size: 'PVC 1/2"' },   // I 15 / K 40
];

export const waterPipe = defineCalculator<WaterPipeInput>({
    id: 'water-pipe',
    sheetName: 'ท่อน้ำดี_Water Pipe',
    title: 'โปรแกรมถอดแบบ – งานท่อน้ำดี Water Pipe',
    titleEn: 'Water Pipe',
    sections: [21],
    deps: [],
    defaults: () => ({
        runs: [
            { label: 'ท่อเมนภายนอก PVC 3/4"', size: 'PVC 3/4"', horizontal: 58.5, vertical: 0 },        // row 5
            { label: 'ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2"', size: 'PVC 1/2"', horizontal: 7.8, vertical: 5.3 }, // row 6
        ],
    }),
    compute: (input) => computePipeRuns(input, WATER_PIPE_BOQ_LINES),
    boqLinks: WATER_PIPE_BOQ_LINES.map(({ line }) => ({ line, field: 'qty' as const, output: line })),
    boqText: (input) => pipeRunsBoqText(input, WATER_PIPE_BOQ_LINES),
});
