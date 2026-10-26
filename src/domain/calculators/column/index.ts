// Sheet "เสา_Column" (Excel v5 sheet 30) → BOQ (Home) section 11 (rows 108, 111) and the
// column rebar block 6.7 in section 6 (slot `column.rebar`, Excel rows 51–53).
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.6 (and §1.2 row 11 of the summary sheet 24).
import { defineCalculator } from '../types';
import { roundUp } from '../../boq/engine';
import { rebarSlotRows, REBAR_KG_PER_M, REBAR_SIZES } from '../../boq/slots';

/** One column type = one row of the sheet (rows 8–17; D5: unlimited). */
export interface ColumnRow {
    name: string;            // B ชื่อเสา (dropdown C1,C2,C3)
    count: number;           // C จำนวน เสา (ต้น)
    width: number;           // D กว้าง (ม.)
    depth: number;           // E ยาว (ม.)
    /** F สูง (ม.) — typed by the user (Excel `=0.55+3.5`), not linked to footing/pedestal (D14). */
    height: number;
    mainSize: string;        // H ขนาด (เหล็กเสริมหลัก)
    mainCount: number;       // I จำนวน (เส้น)
    stirrupSize: string;     // M ขนาด (เหล็กปลอก)
    stirrupSpacing: number;  // N ระยะห่าง (ม.)
}

export interface ColumnInput {
    columns: ColumnRow[];
}

/** Excel dropdown lists of the sheet. */
export const COLUMN_NAMES = ['C1', 'C2', 'C3'] as const;
export const COLUMN_BAR_SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/** Excel SWITCH(size, "RB6",0.222, …, 0): kg per metre, 0 for anything else. */
const KG_PER_M: Partial<Record<string, number>> = REBAR_KG_PER_M;
const kgPerM = (size: string): number => KG_PER_M[size] ?? 0;

export interface ColumnRowCalc {
    mainBarLength: number;        // J ความยาว /เส้น (ม.)
    mainTotalLength: number;      // K ความยาว รวม (ม.)
    mainWeight: number;           // L น้ำหนัก (กก.)
    /** O จำนวน (ปลอก); null where Excel shows "_" (spacing 0 / blank). */
    stirrupCount: number | null;
    stirrupLength: number;        // P ความยาว /เส้น (ม.)
    /** Q ความยาว รวม (ม.); null where Excel shows "-". */
    stirrupTotalLength: number | null;
    stirrupWeight: number;        // R น้ำหนัก (กก.)
    formwork: number;             // T ไม้แบบ (ตร.ม.)
    concrete: number;             // V คอนกรีต โครงสร้าง (ลบ.ม.)
}

/** Formulas of one column row (Excel row 8, shared down the table). */
export function columnRowCalc(r: ColumnRow): ColumnRowCalc {
    const n = num(r.count), w = num(r.width), d = num(r.depth), h = num(r.height);
    const mainBarLength = h;                                   // J = F (no lap)
    const mainTotalLength = n * mainBarLength * num(r.mainCount); // K = C*J*I
    const s = num(r.stirrupSpacing);
    // O = IFERROR(ROUNDUP(F/N, 0), "_") — no +1
    const stirrupCount = s !== 0 ? roundUp(h / s) : null;
    const stirrupLength = 2 * (w + d);                         // P = 2*(D+E), no hook
    // Q = IFERROR(C*O*P, "-")
    const stirrupTotalLength = stirrupCount === null ? null : n * stirrupCount * stirrupLength;
    return {
        mainBarLength,
        mainTotalLength,
        mainWeight: mainTotalLength * kgPerM(r.mainSize),      // L = K*SWITCH(H,…)
        stirrupCount,
        stirrupLength,
        stirrupTotalLength,
        stirrupWeight: (stirrupTotalLength ?? 0) * kgPerM(r.stirrupSize), // R = IFERROR(Q*SWITCH(M,…), 0)
        formwork: n * (2 * (w + d)) * h,                       // T = C*(2*(D+E))*F
        concrete: n * (w * d) * h,                             // V = C*(D*E)*F
    };
}

/** Totals row 6 of the sheet. Every row is summed (Excel's ranges already cover the whole table). */
export function computeColumn(input: ColumnInput): Record<string, number> {
    const rows = input.columns.map(columnRowCalc);
    const out: Record<string, number> = {
        formwork: rows.reduce((s, c) => s + c.formwork, 0),   // T6 = SUM(T8:T17)
        concrete: rows.reduce((s, c) => s + c.concrete, 0),   // V6 = SUM(V8:V17)
    };
    for (const size of REBAR_SIZES) {
        // H6..L6 = SUMIF($H$8:$H$99, size, $L$8:$L$99); M6..Q6 = SUMIF($M$8:$M$99, size, $R$8:$R$99)
        const main = input.columns.reduce((s, r, i) => s + (r.mainSize === size ? rows[i]?.mainWeight ?? 0 : 0), 0);
        const stirrup = input.columns.reduce((s, r, i) => s + (r.stirrupSize === size ? rows[i]?.stirrupWeight ?? 0 : 0), 0);
        out[`main.${size}`] = main;
        out[`stirrup.${size}`] = stirrup;
        // Sheet 24 row 11: I11..M11 = main + stirrup of the same size
        out[`rebar.${size}`] = main + stirrup;
    }
    return out;
}

export const column = defineCalculator<ColumnInput>({
    id: 'column',
    sheetName: 'เสา_Column',
    title: 'โปรแกรมถอดแบบ – เสา Column',
    titleEn: 'Column (Floor 1)',
    // Section 11 = formwork + concrete; the rebar sits in section 6 (item 6.7 เหล็กเสริม - ***เสาชั้น 1).
    sections: [11, 6],
    deps: [],
    // Row 8 of the sheet (rows 9–17 are empty).
    defaults: () => ({
        columns: [{
            name: 'C1', count: 21, width: 0.2, depth: 0.2,
            height: 0.55 + 3.5,   // Excel F8 `=0.55+3.5` = 4.05 (typed; D14)
            mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.15,
        }],
    }),
    compute: (input) => computeColumn(input),
    // BOQ 11 reads sheet 24 row 11 (O11 = T6, P11 = V6).
    boqLinks: [
        { line: 'R108', field: 'qty', output: 'formwork' },
        { line: 'R111', field: 'qty', output: 'concrete' },
    ],
    // BOQ 6.7 เหล็กเสริม - ***เสาชั้น 1: one row per bar size used + tie wire (Excel R51 RB6, R52 DB12, R53).
    boqSlots: (input) => {
        const out = computeColumn(input);
        return { rebar: rebarSlotRows(Object.fromEntries(REBAR_SIZES.map(s => [s, out[`rebar.${s}`] ?? 0]))) };
    },
});
