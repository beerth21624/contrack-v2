// Sheet "ทาสี_Paint " (Excel v5 sheet 19 — the sheet name has a trailing space) → BOQ (Home) sections
// 23 งานทาสีรองพื้น (R223–R231), 25 งานทาสีจริง รอบที่ 1 (R245–R252) and 31 งานทาสีรอบสุดท้าย (R300–R307).
// The same 8 areas are priced three times (prices stay in the BOQ template, per section — oddity O-10);
// the skim-coat line C13 only goes to section 23.
// Spec: docs/excel-spec/04-ceiling-tiles-finishes-paint.md §5 (oddities O-3, O-4, O-5, O-10, O-15).
import { defineCalculator, type CalcContext } from '../types';

/** One moulding (บัว) run: paint girth (face + 2 × thickness, ม.) × length (ม.). */
export interface MouldingRun {
    /** Moulding size as on the Wall Finishing sheet (e.g. '0.3' = บัว 0.3 × 0.1). Picks the source length. */
    size: string;
    girth: number;   // ความกว้างรอบรูป (ม.)
    length: number;  // ความยาว (ม.)
}

export interface PaintInput {
    /**
     * C10 ทาสีผนัง - ไม้ระแนง (ตร.ม.). Excel hard-codes `=3.3+4.8` (= Wall Finishing G7 + G8, oddity O-3).
     * Decision D20 (link it) is not approved yet → editable, default = the Excel number.
     */
    slatWallArea: number;
    /** C11 ทาสีผนัง - บัว = Σ girth × length. Excel `=(0.5*13)+(0.3*11)` (oddity O-4). */
    mouldings: MouldingRun[];
    /** C12 ทาสีผนัง - เชิงชาย = length × height. Excel `=63.2*0.23` (roofing fascia is 62.3 m — oddity O-5). */
    fasciaLength: number;
    fasciaHeight: number;
}

/** Excel's cached values for the lines that come from other sheets (used while that calculator is missing). */
export const PAINT_EXCEL_FALLBACK = {
    wallExterior: 191.8225,       // C5 = SUMIF(Plaster!C, "ฉาบภายนอก", Plaster!E)
    wallInterior: 314.7825,       // C6 = SUMIF(Plaster!C, "ฉาบภายใน", Plaster!E)
    ceilingExterior: 37.38,       // C7 = SUMIF(Ceiling!H, "ทาสีฝ้า - ภายนอก", Ceiling!F)
    ceilingInterior: 92.54055467, // C8 = SUMIF(Ceiling!H, "ทาสีฝ้า - ภายใน", Ceiling!F)
    ceilingSlat: 19.5,            // C9 = SUMIF(Ceiling!H, "ทาสีฝ้า - ไม้ระแนง ", Ceiling!F)
} as const;

export type PaintLineKey =
    | 'wallExterior' | 'wallInterior' | 'ceilingExterior' | 'ceilingInterior' | 'ceilingSlat'
    | 'wallSlat' | 'moulding' | 'fascia' | 'skim';

export interface PaintLine {
    key: PaintLineKey;
    /** Column B label (verbatim, stray spaces trimmed). */
    label: string;
    cell: string;
    /** BOQ rows that take this area as qty: §23, §25, §31. */
    boq: string[];
}

/** The 9 fixed lines C5…C13 (oddity O-15: the BOQ links by position, so the lines are fixed here). */
export const PAINT_LINES: readonly PaintLine[] = [
    { key: 'wallExterior', label: 'ทาสีผนัง - ภายนอก', cell: 'C5', boq: ['R223', 'R245', 'R300'] },
    { key: 'wallInterior', label: 'ทาสีผนัง - ภายใน', cell: 'C6', boq: ['R224', 'R246', 'R301'] },
    { key: 'ceilingExterior', label: 'ทาสีฝ้า - ภายนอก', cell: 'C7', boq: ['R225', 'R247', 'R302'] },
    { key: 'ceilingInterior', label: 'ทาสีฝ้า - ภายใน', cell: 'C8', boq: ['R226', 'R248', 'R303'] },
    { key: 'ceilingSlat', label: 'ทาสีฝ้า - ไม้ระแนง', cell: 'C9', boq: ['R227', 'R249', 'R304'] },
    { key: 'wallSlat', label: 'ทาสีผนัง - ไม้ระแนง', cell: 'C10', boq: ['R228', 'R250', 'R305'] },
    { key: 'moulding', label: 'ทาสีผนัง - บัว', cell: 'C11', boq: ['R229', 'R251', 'R306'] },
    { key: 'fascia', label: 'ทาสีผนัง - เชิงชาย', cell: 'C12', boq: ['R230', 'R252', 'R307'] },
    { key: 'skim', label: 'งานฉาบบาง (สกิมโค๊ท) - รวม', cell: 'C13', boq: ['R231'] },
];

const num = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : 0);

/** A value read from another calculator, or undefined when that calculator / output does not exist. */
const read = (ctx: CalcContext, calc: string, output: string): number | undefined => {
    const v = ctx.outputs(calc)?.[output];
    return v !== undefined && Number.isFinite(v) ? v : undefined;
};

/** Values the source sheets offer for the hand-typed lines C10–C12 (shown next to the inputs, "ใช้ค่าจาก …"). */
export interface PaintSuggestions {
    /** Wall Finishing Σ ระแนง area (Excel G7 + G8). */
    slatWallArea?: number;
    /** Wall Finishing Σ บัว length per size ('0.3', '0.1', …). */
    mouldingLength: (size: string) => number | undefined;
    /** Roofing E16 ไม้เชิงชาย take-off length (62.3 m in v5). */
    fasciaLength?: number;
}

export function paintSuggestions(ctx: CalcContext): PaintSuggestions {
    return {
        slatWallArea: read(ctx, 'wall-finishing', 'slatWallArea'),
        mouldingLength: size => (size.trim() === '' ? undefined : read(ctx, 'wall-finishing', `moulding.${size.trim()}`)),
        fasciaLength: read(ctx, 'roofing', 'fasciaLength'),
    };
}

/** Which lines are currently taken from a calculator (true) or from Excel's cached number (false). */
export function paintLinkedSources(ctx: CalcContext): Record<'plaster' | 'ceilingExterior' | 'ceilingInterior' | 'ceilingSlat', boolean> {
    return {
        plaster: read(ctx, 'plaster', 'exterior') !== undefined || read(ctx, 'plaster', 'interior') !== undefined,
        ceilingExterior: read(ctx, 'ceiling', 'paint.ภายนอก') !== undefined,
        ceilingInterior: read(ctx, 'ceiling', 'paint.ภายใน') !== undefined,
        ceilingSlat: read(ctx, 'ceiling', 'paint.ไม้ระแนง') !== undefined,
    };
}

/** C11 contribution of one moulding run. */
export const mouldingArea = (m: MouldingRun) => num(m.girth) * num(m.length);

export function paintAreas(input: PaintInput, ctx: CalcContext): Record<PaintLineKey, number> {
    const wallExterior = read(ctx, 'plaster', 'exterior') ?? PAINT_EXCEL_FALLBACK.wallExterior;
    const wallInterior = read(ctx, 'plaster', 'interior') ?? PAINT_EXCEL_FALLBACK.wallInterior;
    return {
        wallExterior,
        wallInterior,
        ceilingExterior: read(ctx, 'ceiling', 'paint.ภายนอก') ?? PAINT_EXCEL_FALLBACK.ceilingExterior,
        ceilingInterior: read(ctx, 'ceiling', 'paint.ภายใน') ?? PAINT_EXCEL_FALLBACK.ceilingInterior,
        ceilingSlat: read(ctx, 'ceiling', 'paint.ไม้ระแนง') ?? PAINT_EXCEL_FALLBACK.ceilingSlat,
        wallSlat: num(input.slatWallArea),
        // (0.5*13)+(0.3*11): summed left to right, like Excel.
        moulding: input.mouldings.reduce((s, m) => s + mouldingArea(m), 0),
        fascia: num(input.fasciaLength) * num(input.fasciaHeight),
        // C13 = C6 + C5
        skim: wallInterior + wallExterior,
    };
}

export const paint = defineCalculator<PaintInput>({
    id: 'paint',
    sheetName: 'ทาสี_Paint ',
    title: 'โปรแกรมถอดแบบ – งานทาสี Paint',
    titleEn: 'Painting',
    sections: [23, 25, 31],
    deps: ['plaster', 'ceiling', 'wall-finishing', 'roofing'],
    defaults: () => ({
        slatWallArea: 3.3 + 4.8,
        mouldings: [
            { size: '0.3', girth: 0.5, length: 13 },
            { size: '0.1', girth: 0.3, length: 11 },
        ],
        fasciaLength: 63.2,
        fasciaHeight: 0.23,
    }),
    compute: (input, ctx) => {
        const areas = paintAreas(input, ctx);
        const out: Record<string, number> = { ...areas };
        for (const line of PAINT_LINES) {
            for (const row of line.boq) out[row] = areas[line.key];
        }
        return out;
    },
    boqLinks: PAINT_LINES.flatMap(l => l.boq.map(row => ({ line: row, field: 'qty' as const, output: row }))),
});
