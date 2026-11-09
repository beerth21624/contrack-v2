// Sheet "ท่อน้ำดี_Water Pipe" (Excel v5 sheet 06) → BOQ (Home) section 21, sub-item 3) งานระบบประปา ท่อน้ำดี,
// rows 213–214. Spec: docs/excel-spec/05-mep-sanitary-misc.md §2. Deck p92: the water pipe belongs to STEP 21.
// The BOQ template applies the 15 % waste, labour on gross (L = K × H, §0.1 / D11) and the 50 % consumables row R215;
// this sheet only supplies E213:E214 (and D213:D214 = B5:B6). Same table and rules as the waste-pipe sheet.
import { defineCalculator } from '../types';
import { NO_TRACE } from '../../trace/tracer';
import { WATER_PIPE_TRACE_LABELS } from './trace.labels';
import {
    blankRuns, computePipeRuns, pipeRunTargets, runLength, pipeRunsBoqText, type PipeBoqLine, type PipePlainLabel, type PipeRunsInput,
} from '../waste-pipe/pipe-runs';

export {
    runLength, pipeRunTargets, normalizeSize, unlinkedRuns, sizeMismatches, sizeFromLabel, blankRuns, plainLabel,
    type PipeRun, type PipeRunsInput, type PipeBoqLine, type PipePlainLabel,
} from '../waste-pipe/pipe-runs';

export type WaterPipeInput = PipeRunsInput;

/** Sheet subtitle B3 (verbatim). */
export const WATER_PIPE_SUBTITLE = ': ตารางคำนวณปริมาณความยาวท่อน้ำดี';

/** Dropdown B5:B18 (Excel list order). */
export const WATER_PIPE_ITEMS = [
    'ท่อเมนภายนอก PVC 3/4"',
    'ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2"',
] as const;

/** Guided journey: plain names of the B options (keyed by the Excel text). */
export const WATER_PIPE_PLAIN: Record<string, PipePlainLabel> = {
    'ท่อเมนภายนอก PVC 3/4"': { name: 'ท่อเมนนอกบ้าน', hint: 'จากมิเตอร์น้ำ/ถังเก็บน้ำ ถึงจุดที่ท่อเข้าบ้าน' },
    'ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2"': {
        name: 'ท่อย่อยในบ้าน (ห้องน้ำ / จุดใช้น้ำ)',
        hint: 'แยกจากท่อเมนไปก๊อก ฝักบัว ชักโครก รวมท่อขึ้นผนัง',
    },
};

/** Dropdown C5:C18. */
export const WATER_PIPE_SIZES = ['PVC 1/2"', 'PVC 3/4"'] as const;

/** BOQ rows fed by sheet rows 5, 6 (E213 = F5, E214 = F6) and the size their typed price is for. */
export const WATER_PIPE_BOQ_LINES: readonly PipeBoqLine[] = [
    { line: 'R213', size: 'PVC 3/4"' },   // I 20 / K 40
    { line: 'R214', size: 'PVC 1/2"' },   // I 15 / K 40
];

/** Excel v5 sample rows 5–6. */
const defaults = (): WaterPipeInput => ({
    runs: [
        { label: 'ท่อเมนภายนอก PVC 3/4"', size: 'PVC 3/4"', horizontal: 58.5, vertical: 0 },        // row 5
        { label: 'ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2"', size: 'PVC 1/2"', horizontal: 7.8, vertical: 5.3 }, // row 6
    ],
});

export const waterPipe = defineCalculator<WaterPipeInput>({
    id: 'water-pipe',
    sheetName: 'ท่อน้ำดี_Water Pipe',
    title: 'โปรแกรมถอดแบบ – งานท่อน้ำดี Water Pipe',
    titleEn: 'Water Pipe',
    sections: [21],
    deps: [],
    defaults,
    // The two fixed rows (B/C typed in Excel, not inputs) with no length: every BOQ line 0.
    blank: () => blankRuns(defaults()),
    compute: (input, _ctx, tr = NO_TRACE) => {
        const out = computePipeRuns(input, WATER_PIPE_BOQ_LINES);
        if (tr.enabled) {
            // Observe only: the lengths are re-read with the same helpers computePipeRuns uses.
            const targets = pipeRunTargets(input.runs, WATER_PIPE_BOQ_LINES);
            const lens: number[] = [];
            const perLine = new Map<string, number[]>(WATER_PIPE_BOQ_LINES.map(l => [l.line, []]));
            const unlinked: number[] = [];
            input.runs.forEach((r, i) => {
                const len = tr.row(i, r.label.trim() || `#${i + 1}`, () => {
                    const v = runLength(r);
                    tr.step('length', v, { horizontal: Number.isFinite(r.horizontal) ? r.horizontal : 0, vertical: Number.isFinite(r.vertical) ? r.vertical : 0 });
                    return v;
                });
                lens.push(len);
                const t = targets[i];
                const line = t === null || t === undefined ? undefined : WATER_PIPE_BOQ_LINES[t]?.line;
                if (line === undefined) unlinked.push(len);
                else perLine.get(line)?.push(len);
            });
            for (const l of WATER_PIPE_BOQ_LINES) tr.step(`line_${l.line}`, out[l.line] ?? 0, { length: perLine.get(l.line) ?? [] });
            tr.step('total', out.total ?? 0, { length: lens });
            tr.step('unlinked', out.unlinked ?? 0, { length: unlinked });
        }
        return out;
    },
    traceLabels: WATER_PIPE_TRACE_LABELS,
    boqLinks: WATER_PIPE_BOQ_LINES.map(({ line }) => ({ line, field: 'qty' as const, output: line })),
    boqText: (input) => pipeRunsBoqText(input, WATER_PIPE_BOQ_LINES),
});
