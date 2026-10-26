// Sheet " พื้นสำเร็จรูป_PS" (Excel v5 sheet 29; the sheet name has a leading space) → BOQ (Home):
//   section 10: R97 พื้นสำเร็จรูป (= PS!E6 directly; R98 ไม้ค้ำยัน = 0.1 × E97 is a BOQ formula),
//               R99 เหล็กไวร์เมช (sheet 24 H10), R101 ไม้แบบ (sheet 24 O10), R104 คอนกรีต (sheet 24 P10);
//   section 8:  slot `precast-slab.shear-key` (row 75 เหล็กล๊อคหัวแผ่นพื้นสำเร็จรูป, sheet 24 I10:M10) — no tie wire.
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.5 and §3 (rows 74–75, 96–104).
import { defineCalculator } from '../types';
import { roundUp } from '../../boq/engine';
import { REBAR_SIZES, rebarSlotRows, type RebarSize, kgPerMetre, isRebarSize } from '../../boq/slots';

export interface PrecastPanelRow {
    width: number;        // B กว้าง (ม.)
    length: number;       // C ยาว (ม.)
    keySize: string;      // H ขนาด — เหล็ก Shear Key
    keySpacing: number;   // I ระยะห่าง (ม.)
    keyBarLength: number; // J ความยาว /เส้น (ม.)
    topping: number;      // R หนา (ม.) — คอนกรีตทับหน้า
}

export interface PrecastSlabInput {
    /** Excel rows 8–24 (17 rows, 9 used in the sample); decision D5: unlimited rows. */
    panels: PrecastPanelRow[];
}

/** Excel dropdown H8:H24. */
export const PS_BAR_SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;

const num = (v: number) => (Number.isFinite(v) ? v : 0);



export interface PrecastPanelResult {
    area: number;                  // E = B*C แผ่นพื้น (ตร.ม)
    wiremesh: number;              // G = E ไวร์เมช (ตร.ม.)
    /** K = IFERROR(ROUNDUP(2*B/I,0),"_") — null where Excel shows "_" (no spacing). */
    keyCount: number | null;
    keyTotalLength: number | null; // L = IFERROR(K*J,"_")
    keyWeight: number;             // M = IFERROR(L*SWITCH(H),0)
    perimeter: number;             // O = 2*(B+C)
    formwork: number;              // P = O*R (edge form = perimeter × topping)
    concrete: number;              // S = E*R (topping)
}

export function precastPanel(r: PrecastPanelRow): PrecastPanelResult {
    const B = num(r.width), C = num(r.length), I = num(r.keySpacing), J = num(r.keyBarLength), R = num(r.topping);
    const area = B * C;
    const keyCount = I !== 0 ? roundUp((2 * B) / I) : null;
    const keyTotalLength = keyCount === null ? null : keyCount * J;
    const perimeter = 2 * (B + C);
    return {
        area,
        wiremesh: area,
        keyCount,
        keyTotalLength,
        keyWeight: (keyTotalLength ?? 0) * kgPerMetre(r.keySize),
        perimeter,
        formwork: perimeter * R,
        concrete: area * R,
    };
}

export interface PrecastSlabTotals {
    area: number;                        // E6 = SUM(E8:E24)
    wiremesh: number;                    // G6 = SUM(G8:G24)
    shearKey: Record<RebarSize, number>; // H6:L6 = SUMIF(H, size, M)
    formwork: number;                    // O6 = SUM(P8:P24)
    concrete: number;                    // R6 = SUM(S8:S24)
}

export function precastSlabTotals(input: PrecastSlabInput): PrecastSlabTotals {
    const shearKey = Object.fromEntries(REBAR_SIZES.map(s => [s, 0])) as Record<RebarSize, number>;
    const t: PrecastSlabTotals = { area: 0, wiremesh: 0, shearKey, formwork: 0, concrete: 0 };
    // Excel's totals already cover the whole table (rows 8–24) — no short range to fix here.
    for (const r of input.panels) {
        const x = precastPanel(r);
        t.area += x.area;
        t.wiremesh += x.wiremesh;
        t.formwork += x.formwork;
        t.concrete += x.concrete;
        if (isRebarSize(r.keySize)) t.shearKey[r.keySize] += x.keyWeight;
    }
    return t;
}

const panel = (width: number, length: number): PrecastPanelRow => ({
    width, length, keySize: 'RB6', keySpacing: 0.35, keyBarLength: 0.8, topping: 0.05,
});

/**
 * A new span for the guided journey: no size yet; the shear-key bar and the topping copy the previous span,
 * or the Excel sample (RB6 @0.35, 0.80 m a bar, topping 0.05 m).
 */
export function newPrecastPanel(prev?: PrecastPanelRow): PrecastPanelRow {
    return prev ? { ...prev, width: 0, length: 0 } : panel(0, 0);
}

export const precastSlab = defineCalculator<PrecastSlabInput>({
    id: 'precast-slab',
    sheetName: ' พื้นสำเร็จรูป_PS',
    title: 'โปรแกรมถอดแบบ – งานพื้นสำเร็จรูป (PS)',
    titleEn: 'Precast Slab (PS)',
    sections: [10],
    deps: [],
    defaults: () => ({
        panels: [
            panel(2, 1.2), panel(3, 3), panel(3, 3), panel(3, 4), panel(3, 3),
            panel(3, 3.5), panel(3, 1.2), panel(2, 3.5), panel(3.5, 3.5),
        ],
    }),
    // A real project starts with no spans; each added span gets the Excel shear key / topping (newPrecastPanel).
    blank: () => ({ panels: [] }),
    compute: (input) => {
        const t = precastSlabTotals(input);
        const out: Record<string, number> = {
            area: t.area,
            wiremesh: t.wiremesh,
            formwork: t.formwork,
            concrete: t.concrete,
        };
        // Sheet 24 row 10 I..M (shear-key bars by size); same `rebar.<size>` naming as the other structural sheets.
        for (const s of REBAR_SIZES) out[`rebar.${s}`] = t.shearKey[s];
        return out;
    },
    boqLinks: [
        { line: 'R97', field: 'qty', output: 'area' },       // E97 = PS!E6
        { line: 'R99', field: 'qty', output: 'wiremesh' },   // E99 = sheet24 H10 = PS!G6
        { line: 'R101', field: 'qty', output: 'formwork' },  // E101 = sheet24 O10 = PS!O6
        { line: 'R104', field: 'qty', output: 'concrete' },  // E104 = sheet24 P10 = PS!R6
    ],
    // Row 75 (section 8, 8.4 เหล็กล๊อคหัวแผ่นพื้นสำเร็จรูป): shear-key bars per size, no tie-wire line (as Excel).
    boqSlots: (input) => ({ 'shear-key': rebarSlotRows(precastSlabTotals(input).shearKey, { tieWire: false }) }),
});
