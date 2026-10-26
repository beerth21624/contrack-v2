// Sheet "พื้นหล่อในที่_S" (Excel v5 sheet 28) → BOQ (Home) section 9 (rows 88–94).
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.4 (and §1.2 row 9 of the summary sheet 24).
import { defineCalculator } from '../types';
import { rebarSlotRows, REBAR_KG_PER_M, REBAR_SIZES } from '../../boq/slots';

/** One slab panel = one row of the sheet (rows 8–24; D5: unlimited). */
export interface SlabRow {
    name: string;           // B ชื่อพื้น (dropdown S1,S2)
    width: number;          // C กว้าง (ม.)
    length: number;         // D ยาว (ม.)
    thickness: number;      // E หนา (ม.)
    fillDepth: number;      // G ถมลึก (ม.) — ดินถมกลับ depth (= ground-beam depth under the slab)
    sandThickness: number;  // I หนา (ม.) — ทรายหยาบ
    barSize: string;        // M ขนาด (dropdown RB6,RB9,DB12,DB16)
    layers: number;         // N วางเหล็ก (ชั้น) (dropdown 1,2)
    spacing: number;        // O ระยะห่าง (ม.)
}

export interface SlabOnGradeInput {
    slabs: SlabRow[];
}

/** Excel dropdown lists of the sheet. */
export const SLAB_NAMES = ['S1', 'S2'] as const;
/** Excel M8:M24 list — DB20 is not offered on this sheet (the SWITCH still knows it). */
export const SLAB_BAR_SIZES = ['RB6', 'RB9', 'DB12', 'DB16'] as const;
export const SLAB_LAYERS = [1, 2] as const;

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/** Excel SWITCH(size, "RB6",0.222, …, 0): kg per metre, 0 for anything else. */
const KG_PER_M: Partial<Record<string, number>> = REBAR_KG_PER_M;
const kgPerM = (size: string): number => KG_PER_M[size] ?? 0;

export interface SlabRowCalc {
    backfill: number;   // H ปริมาณ (ลบ.ม.)
    sand: number;       // J ปริมาณ (ลบ.ม.)
    plastic: number;    // K ปริมาณ (ตร.ม.)
    barLength: number;  // P รวม (ม.)
    weight: number;     // Q น้ำหนัก (กก.)
    concrete: number;   // S (ลบ.ม.)
}

/** Formulas of one slab row (Excel row 8, shared down the table). */
export function slabRowCalc(r: SlabRow): SlabRowCalc {
    const area = num(r.width) * num(r.length);
    // P = (IFERROR(((C*D)/O)*2, "0"))*N — area / spacing × 2 directions × layers; a zero spacing gives 0.
    const perLayer = num(r.spacing) !== 0 ? (area / num(r.spacing)) * 2 : 0;
    const barLength = perLayer * num(r.layers);
    return {
        backfill: area * num(r.fillDepth),                 // H = (C*D)*G
        sand: area * num(r.sandThickness) * (1 + 0.25),    // J = (C*D)*I*(100%+25%)
        plastic: area,                                     // K = C*D
        barLength,
        weight: barLength * kgPerM(r.barSize),             // Q = IFERROR(P*SWITCH(M,…),0)
        concrete: area * num(r.thickness),                 // S = C*D*E
    };
}

/** Totals row 6 of the sheet. Every row is summed (Excel's ranges already cover the whole table). */
export function computeSlabOnGrade(input: SlabOnGradeInput): Record<string, number> {
    const rows = input.slabs.map(slabRowCalc);
    const sum = (f: (c: SlabRowCalc) => number) => rows.reduce((s, c) => s + f(c), 0);
    const out: Record<string, number> = {
        backfill: sum(c => c.backfill),   // G6 = SUM(H8:H24)
        sand: sum(c => c.sand),           // I6 = SUM(J8:J24)
        plastic: sum(c => c.plastic),     // K6 = SUM(K8:K24)
        concrete: sum(c => c.concrete),   // S6 = SUM(S8:S24)
    };
    // M6..Q6 = SUMIF($M$8:$M$100, size, $Q$8:$Q$100)
    for (const size of REBAR_SIZES) {
        out[`rebar.${size}`] = input.slabs.reduce((s, r, i) => s + (r.barSize === size ? rows[i]?.weight ?? 0 : 0), 0);
    }
    return out;
}

const sample = (width: number, length: number): SlabRow => ({
    name: 'S1', width, length, thickness: 0.1, fillDepth: 0.4, sandThickness: 0.05, barSize: 'RB9', layers: 2, spacing: 0.2,
});

export const slabOnGrade = defineCalculator<SlabOnGradeInput>({
    id: 'slab-on-grade',
    sheetName: 'พื้นหล่อในที่_S',
    title: 'โปรแกรมถอดแบบ – พื้นหล่อในที่ (S)',
    titleEn: 'Slab on Grade (S)',
    sections: [9],
    deps: [],
    // Rows 8–17 of the sheet (rows 18–24 are empty).
    defaults: () => ({
        slabs: [
            sample(1.8, 2.0), sample(0.9, 7.0), sample(2.3, 3.0), sample(1.0, 1.0), sample(2.0, 4.0),
            sample(1.5, 4.0), sample(1.5, 4.0), sample(1.5, 4.0), sample(0.9, 3.5), sample(0.9, 3.5),
        ],
    }),
    compute: (input) => computeSlabOnGrade(input),
    // BOQ 9.2–9.4, 9.6 read sheet 24 row 9 (Q9 = G6, D9 = I6, F9 = K6, P9 = S6).
    boqLinks: [
        { line: 'R88', field: 'qty', output: 'backfill' },
        { line: 'R89', field: 'qty', output: 'sand' },
        { line: 'R90', field: 'qty', output: 'plastic' },
        { line: 'R94', field: 'qty', output: 'concrete' },
    ],
    // BOQ 9.5 เหล็กเสริม: one row per bar size used + tie wire (Excel: RB9 R92 + R93).
    boqSlots: (input) => {
        const out = computeSlabOnGrade(input);
        return { rebar: rebarSlotRows(Object.fromEntries(REBAR_SIZES.map(s => [s, out[`rebar.${s}`] ?? 0]))) };
    },
});
