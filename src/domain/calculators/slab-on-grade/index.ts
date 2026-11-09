// Sheet "พื้นหล่อในที่_S" (Excel v5 sheet 28) → BOQ (Home) section 9 (rows 88–94).
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.4 (and §1.2 row 9 of the summary sheet 24).
import { NO_TRACE, type Tracer } from '../../trace/tracer';
import { defineCalculator } from '../types';
import { SLAB_ON_GRADE_TRACE_LABELS } from './trace.labels';
import { rebarSlotRows, REBAR_SIZES, kgPerMetre } from '../../boq/slots';

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
export const SLAB_BAR_SIZES = ['RB6', 'RB9', 'DB12', 'DB16'] as const;
export const SLAB_LAYERS = [1, 2] as const;

const num = (v: number) => (Number.isFinite(v) ? v : 0);


export interface SlabRowCalc {
    backfill: number;   // H ปริมาณ (ลบ.ม.)
    sand: number;       // J ปริมาณ (ลบ.ม.)
    plastic: number;    // K ปริมาณ (ตร.ม.)
    barLength: number;  // P รวม (ม.)
    weight: number;     // Q น้ำหนัก (กก.)
    concrete: number;   // S (ลบ.ม.)
}

/** Row name shown in the dev-mode trace. */
export const slabRowLabel = (r: SlabRow, i: number): string => r.name || `#${i + 1}`;

/** Formulas of one slab row (Excel row 8, shared down the table). `tr` (dev mode) records the steps; call inside `tr.row(i, …)`. */
export function slabRowCalc(r: SlabRow, tr: Tracer = NO_TRACE): SlabRowCalc {
    const area = num(r.width) * num(r.length);
    // P = (IFERROR(((C*D)/O)*2, "0"))*N — area / spacing × 2 directions × layers; a zero spacing gives 0.
    const perLayer = num(r.spacing) !== 0 ? (area / num(r.spacing)) * 2 : 0;
    const barLength = perLayer * num(r.layers);
    const res: SlabRowCalc = {
        backfill: area * num(r.fillDepth),                 // H = (C*D)*G
        sand: area * num(r.sandThickness) * (1 + 0.25),    // J = (C*D)*I*(100%+25%)
        plastic: area,                                     // K = C*D
        barLength,
        weight: barLength * kgPerMetre(r.barSize),             // Q = IFERROR(P*SWITCH(M,…),0)
        concrete: area * num(r.thickness),                 // S = C*D*E
    };
    if (tr.enabled) {
        const w = num(r.width), l = num(r.length), sp = num(r.spacing);
        const kg = kgPerMetre(r.barSize);
        tr.constant('sandFactor', 1 + 0.25);
        tr.constant('directions', 2);
        tr.constant('kgPerM', kg, { params: { size: r.barSize || '-' } });
        tr.step('area', area, { width: w, length: l });
        tr.step('backfill', res.backfill, { area, fillDepth: num(r.fillDepth) });
        tr.step('sand', res.sand, { area, sandThickness: num(r.sandThickness), sandFactor: 1 + 0.25 });
        tr.step('plastic', res.plastic, { area });
        if (sp !== 0) {
            tr.step('perLayer', perLayer, { area, spacing: sp, directions: 2 });
            tr.step('barLength', barLength, { perLayer, layers: num(r.layers) });
        } else {
            tr.step('barLengthNone', barLength, { spacing: sp });
        }
        tr.step('weight', res.weight, { barLength, kgPerM: kg }, { params: { size: r.barSize || '-' } });
        tr.step('concrete', res.concrete, { area, thickness: num(r.thickness) });
    }
    return res;
}

/** Totals row 6 of the sheet. Every row is summed (Excel's ranges already cover the whole table). */
export function computeSlabOnGrade(input: SlabOnGradeInput, tr: Tracer = NO_TRACE): Record<string, number> {
    const rows = input.slabs.map((r, i) => (tr.enabled ? tr.row(i, slabRowLabel(r, i), () => slabRowCalc(r, tr)) : slabRowCalc(r)));
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
    if (tr.enabled) {
        tr.step('totalBackfill', out.backfill ?? 0, { backfill: rows.map(c => c.backfill) });
        tr.step('totalSand', out.sand ?? 0, { sand: rows.map(c => c.sand) });
        tr.step('totalPlastic', out.plastic ?? 0, { plastic: rows.map(c => c.plastic) });
        tr.step('totalConcrete', out.concrete ?? 0, { concrete: rows.map(c => c.concrete) });
        // Weight per bar size: only sizes some row uses (Σ of the rows' weights of that size).
        for (const size of REBAR_SIZES) {
            const w = input.slabs.flatMap((r, i) => (r.barSize === size ? [rows[i]?.weight ?? 0] : []));
            if (w.length > 0) tr.step('totalRebar', out[`rebar.${size}`] ?? 0, { weight: w }, { params: { size } });
        }
    }
    return out;
}

const sample = (width: number, length: number): SlabRow => ({
    name: 'S1', width, length, thickness: 0.1, fillDepth: 0.4, sandThickness: 0.05, barSize: 'RB9', layers: 2, spacing: 0.2,
});

/**
 * A new panel for the guided journey: no size yet (width, length, thickness read off the plan); the fill depth,
 * sand bed and bar spec copy the previous panel, or the Excel sample values (fill 0.4, sand 0.05, RB9 × 2 @0.2).
 */
export function newSlabRow(prev?: SlabRow): SlabRow {
    return {
        name: prev?.name ?? 'S1',
        width: 0,
        length: 0,
        thickness: prev?.thickness ?? 0,
        fillDepth: prev?.fillDepth ?? 0.4,
        sandThickness: prev?.sandThickness ?? 0.05,
        barSize: prev?.barSize ?? 'RB9',
        layers: prev?.layers ?? 2,
        spacing: prev?.spacing ?? 0.2,
    };
}

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
    // A real project starts with no panels; each added panel gets the Excel bar spec (newSlabRow).
    blank: () => ({ slabs: [] }),
    compute: (input, _ctx, tr = NO_TRACE) => computeSlabOnGrade(input, tr),
    traceLabels: SLAB_ON_GRADE_TRACE_LABELS,
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
