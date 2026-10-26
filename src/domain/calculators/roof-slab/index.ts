// Sheet "พื้นดาดฟ้า_RoofSlab" (Excel v5 sheet 32) → BOQ (Home) section 12, งานพื้นดาดฟ้า (rows 125–134).
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.8, §3 (rows 125–134), oddities 3 and 5.
// Excel goes through sheet 24 (ตารางสรุปวัสดุงานโครงสร้าง row 13); the app links straight to the BOQ rows.
import { roundUp } from '../../boq/engine';
import { REBAR_SIZES, rebarSlotRows, type RebarSize, kgPerMetre, isRebarSize } from '../../boq/slots';
import { defineCalculator } from '../types';

/** Bar-size dropdown of G8:G24 (Excel leaves DB20 out). */
export const ROOF_SLAB_BAR_SIZES = ['RB6', 'RB9', 'DB12', 'DB16'] as const;
/** Slab-name dropdown of B8:B24. */
export const ROOF_SLAB_NAMES = ['S1', 'S2'] as const;
/** วางเหล็ก (ชั้น) dropdown of H8:H24. */
export const ROOF_SLAB_LAYERS = [1, 2] as const;

/** One slab panel (rows 8–24 in Excel; unlimited here, D5). */
export interface RoofSlabRow {
    name: string;        // B ชื่อพื้น
    width: number;       // C กว้าง (ม.)
    length: number;      // D ยาว (ม.)
    thickness: number;   // E หนา (ม.)
    size: string;        // G ขนาด
    layers: number;      // H วางเหล็ก (ชั้น)
    spacing: number;     // I ระยะห่าง (ม.)
}

export interface RoofSlabInput {
    rows: RoofSlabRow[];
}

const num = (v: number) => (Number.isFinite(v) ? v : 0);

export interface RoofSlabRowResult {
    /** J ยาวรวม (ม.) = (C·D / I) × 2 × H — IFERROR(…, "0") gives 0 with no spacing. */
    barLength: number;
    kg: number;          // K น้ำหนัก (กก.)
    /** M ไม้ค้ำยัน (ต้น) = ROUNDUP(N / 0.6) — area ÷ 0.6, the tradesman's rule (kept, D1 / oddity 5). */
    props: number;
    formwork: number;    // N ไม้แบบ (ตร.ม.) = C × D (soffit)
    concrete: number;    // P คอนกรีต โครงสร้าง (ลบ.ม.) = C × D × E
}

export function roofSlabRow(r: RoofSlabRow): RoofSlabRowResult {
    const area = num(r.width) * num(r.length);
    const spacing = num(r.spacing);
    const barLength = spacing > 0 ? (area / spacing) * 2 * num(r.layers) : 0;
    return {
        barLength,
        kg: barLength * kgPerMetre(r.size),
        props: roundUp(area / 0.6),
        formwork: area,
        concrete: area * num(r.thickness),
    };
}

export interface RoofSlabTotals {
    /** G6..K6 SUMIF by size (sheet 24 row 13, I..M). */
    rebar: Record<RebarSize, number>;
    props: number;     // M6
    formwork: number;  // N6
    concrete: number;  // P6
}

/** Row-6 totals. Excel M6/N6 sum rows 8–17 of a 17-row table; here every row counts (D1, oddity 3). */
export function roofSlabTotals(input: RoofSlabInput): RoofSlabTotals {
    const t: RoofSlabTotals = { rebar: { RB6: 0, RB9: 0, DB12: 0, DB16: 0, DB20: 0 }, props: 0, formwork: 0, concrete: 0 };
    for (const row of input.rows) {
        const r = roofSlabRow(row);
        if (isRebarSize(row.size)) t.rebar[row.size] += r.kg;
        t.props += r.props;
        t.formwork += r.formwork;
        t.concrete += r.concrete;
    }
    return t;
}

const panel = (width: number, length: number): RoofSlabRow =>
    ({ name: 'S1', width, length, thickness: 0.1, size: 'RB9', layers: 2, spacing: 0.2 });

export const roofSlab = defineCalculator<RoofSlabInput>({
    id: 'roof-slab',
    sheetName: 'พื้นดาดฟ้า_RoofSlab',
    title: 'โปรแกรมถอดแบบ – พื้นดาดฟ้า RoofSlab',
    titleEn: 'Roof Slab',
    sections: [12],
    deps: [],
    // Excel v5 rows 8–11 (rows 12–24 are blank).
    defaults: () => ({ rows: [panel(1, 4.5), panel(3, 3.5), panel(1.5, 3), panel(1.5, 3)] }),
    compute: (input) => {
        const t = roofSlabTotals(input);
        const out: Record<string, number> = { props: t.props, formwork: t.formwork, concrete: t.concrete };
        for (const s of REBAR_SIZES) out[`rebar.${s}`] = t.rebar[s];
        return out;
    },
    boqLinks: [
        { line: 'R129', field: 'qty', output: 'props' },      // 2) ไม้ค้ำยัน ← sheet24 N13 = M6
        { line: 'R131', field: 'qty', output: 'formwork' },   // 3) - ไม้แบบ ← sheet24 O13 = N6
        { line: 'R134', field: 'qty', output: 'concrete' },   // 4) คอนกรีตโครงสร้าง ← sheet24 P13 = P6
    ],
    // 1) เหล็กเสริม: one row per bar size + tie wire (Excel R127–R128).
    boqSlots: (input) => ({ rebar: rebarSlotRows(roofSlabTotals(input).rebar) }),
});
