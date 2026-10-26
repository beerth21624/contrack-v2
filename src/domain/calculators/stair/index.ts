// Sheet "บันได_Stair" (Excel v5 sheet 33) → BOQ (Home) section 13 (rows 136–145).
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.9, §3 (rows 136–145), oddities 5 and 17.
// Excel goes through sheet 24 (ตารางสรุปวัสดุงานโครงสร้าง row 14); the app links straight to the BOQ rows.
// The formulas are the tradesman's rules of thumb and are ported as they are (D1): 1.2 m anchorage on the
// waist main bars, 2 temperature bars per step (spacing AB unused), step-side formwork 2·I·G, props from area.
import { roundUp } from '../../boq/engine';
import { REBAR_SIZES, rebarSlotRows, type RebarSize, kgPerMetre, isRebarSize } from '../../boq/slots';
import { defineCalculator } from '../types';

/** Bar-size dropdown of L/Q/V/AA 8:17. */
export const STAIR_BAR_SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;
/** Stair-name dropdown of B8:B17 (Excel order). */
export const STAIR_NAMES = ['บันไดข้างบ้าน', 'บันไดหน้าบ้าน', 'บันไดหลังบ้าน'] as const;
/** Hard-coded anchorage added to each waist main bar (O = (G + 1.2) × N). */
export const STAIR_ANCHORAGE = 1.2;

/** One stair (rows 8–17 in Excel; unlimited here, D5). */
export interface StairRow {
    name: string;              // B ชื่อบันได
    width: number;             // C กว้าง (ม.)          ┐
    waist: number;             // D หนา (ม.)            │ ขนาดแม่บันได
    rise: number;              // E สูง (ม.)            │
    run: number;               // F ยาว แนวราบ (ม.)     ┘
    steps: number;             // H จำนวน (ขั้น)        ┐
    riser: number;             // I สูง ลูกตั้ง (ม.)    │ ขนาดลูกบันได
    tread: number;             // J กว้าง ลูกนอน (ม.)  ┘
    waistMainSize: string;     // L ขนาด    ┐ เหล็กเสริมหลัก - แม่บันได
    waistMainSpacing: number;  // M ระยะห่าง ┘
    waistTempSize: string;     // Q ขนาด    ┐ เหล็กกันร้าว - แม่บันได
    waistTempSpacing: number;  // R ระยะห่าง ┘
    stepMainSize: string;      // V ขนาด    ┐ เหล็กเสริมหลัก - ลูกบันได
    stepMainSpacing: number;   // W ระยะห่าง ┘
    stepTempSize: string;      // AA ขนาด    ┐ เหล็กกันร้าว - ลูกบันได
    stepTempSpacing: number;   // AB ระยะห่าง ┘ (not used by any Excel formula)
}

export interface StairInput {
    rows: StairRow[];
}

const num = (v: number) => (Number.isFinite(v) ? v : 0);
/** Excel IFERROR(ROUNDUP(a / s, 0), "_") → null where Excel shows "_". */
const barCount = (a: number, spacing: number) => (spacing > 0 ? roundUp(a / spacing) : null);

/** One bar group: จำนวน (เส้น), ยาว รวม (ม.), น้ำหนัก (กก.). null = Excel "_". */
export interface StairBarGroup {
    count: number | null;
    length: number | null;
    kg: number;
}

export interface StairRowResult {
    inclined: number;          // G ยาว แนวเอียง (ม.) = √(F² + E²)
    waistMain: StairBarGroup;  // N = ROUNDUP(C/M), O = (G + 1.2)·N, P
    waistTemp: StairBarGroup;  // S = ROUNDUP(G/R), T = C·S, U
    stepMain: StairBarGroup;   // X = ROUNDUP(C/W), Y = X·(F + E), Z
    stepTemp: StairBarGroup;   // AC = 2·H, AD = AC·C, AE
    props: number;             // AG ไม้ค้ำยัน (ต้น) = ROUNDUP(AH / 0.6)
    soffit: number;            // AH ท้อง แม่บันได (ตร.ม.) = C·G
    waistSides: number;        // AI ข้าง แม่บันได (ตร.ม.) = 2·D·G
    stepSides: number;         // AJ ข้าง ลูกบันได (ตร.ม.) = 2·I·G
    risers: number;            // AK กั้น ขั้นบันได (ตร.ม.) = H·I·C
    formwork: number;          // AL รวม (ตร.ม.)
    waistConcrete: number;     // AN แม่บันได (ลบ.ม.) = D·G·C
    stepConcrete: number;      // AO ลูกบันได (ลบ.ม.) = H·(½·J·I)·C
    concrete: number;          // AP รวม (ลบ.ม.)
}

const group = (count: number | null, length: number | null, size: string): StairBarGroup =>
    ({ count, length, kg: (length ?? 0) * kgPerMetre(size) });

export function stairRow(r: StairRow): StairRowResult {
    const c = num(r.width), d = num(r.waist), e = num(r.rise), f = num(r.run);
    const h = num(r.steps), i = num(r.riser), j = num(r.tread);
    const g = Math.sqrt(f * f + e * e);

    const n = barCount(c, num(r.waistMainSpacing));
    const s = barCount(g, num(r.waistTempSpacing));
    const x = barCount(c, num(r.stepMainSpacing));
    const ac = 2 * h;

    const soffit = c * g;
    const waistSides = 2 * (d * g);
    const stepSides = 2 * i * g;
    const risers = h * i * c;
    const waistConcrete = d * g * c;
    const stepConcrete = h * (0.5 * j * i) * c;
    return {
        inclined: g,
        waistMain: group(n, n === null ? null : (g + STAIR_ANCHORAGE) * n, r.waistMainSize),
        waistTemp: group(s, s === null ? null : c * s, r.waistTempSize),
        stepMain: group(x, x === null ? null : x * (f + e), r.stepMainSize),
        stepTemp: group(ac, ac * c, r.stepTempSize),
        props: roundUp(soffit / 0.6),
        soffit, waistSides, stepSides, risers,
        formwork: soffit + waistSides + stepSides + risers,
        waistConcrete, stepConcrete,
        concrete: waistConcrete + stepConcrete,
    };
}

export type StairGroupKey = 'waistMain' | 'waistTemp' | 'stepMain' | 'stepTemp';
type StairSizeKey = 'waistMainSize' | 'waistTempSize' | 'stepMainSize' | 'stepTempSize';
type StairSpacingKey = 'waistMainSpacing' | 'waistTempSpacing' | 'stepMainSpacing' | 'stepTempSpacing';

/** The 4 bar groups of the sheet (header row 4), in column order. */
export const STAIR_GROUPS: readonly { key: StairGroupKey; title: string; size: StairSizeKey; spacing: StairSpacingKey }[] = [
    { key: 'waistMain', title: 'ปริมาณเหล็กเสริมหลัก - แม่บันได (กก.)', size: 'waistMainSize', spacing: 'waistMainSpacing' },
    { key: 'waistTemp', title: 'ปริมาณเหล็กกันร้าว - แม่บันได (กก.)', size: 'waistTempSize', spacing: 'waistTempSpacing' },
    { key: 'stepMain', title: 'ปริมาณเหล็กเสริมหลัก - ลูกบันได (กก.)', size: 'stepMainSize', spacing: 'stepMainSpacing' },
    { key: 'stepTemp', title: 'ปริมาณเหล็กกันร้าว - ลูกบันได (กก.)', size: 'stepTempSize', spacing: 'stepTempSpacing' },
];

export interface StairTotals {
    /** Row 6 SUMIF per group and size (L6..P6, Q6..U6, V6..Z6, AA6..AE6). */
    groups: Record<StairGroupKey, Record<RebarSize, number>>;
    /** Σ of the 4 groups per size (sheet 24 row 14, I..M). */
    rebar: Record<RebarSize, number>;
    props: number;     // AG6
    formwork: number;  // AH6 = Σ AL
    concrete: number;  // AN6 = Σ AP
}

const zeroBySize = (): Record<RebarSize, number> => ({ RB6: 0, RB9: 0, DB12: 0, DB16: 0, DB20: 0 });

/** Row-6 totals (Excel AG6/AH6/AN6 cover rows 8–17 = the whole 10-row table; every row counts here). */
export function stairTotals(input: StairInput): StairTotals {
    const t: StairTotals = {
        groups: { waistMain: zeroBySize(), waistTemp: zeroBySize(), stepMain: zeroBySize(), stepTemp: zeroBySize() },
        rebar: zeroBySize(), props: 0, formwork: 0, concrete: 0,
    };
    for (const row of input.rows) {
        const r = stairRow(row);
        for (const grp of STAIR_GROUPS) {
            const size = row[grp.size];
            if (isRebarSize(size)) t.groups[grp.key][size] += r[grp.key].kg;
        }
        t.props += r.props;
        t.formwork += r.formwork;
        t.concrete += r.concrete;
    }
    for (const s of REBAR_SIZES) {
        t.rebar[s] = STAIR_GROUPS.reduce((sum, grp) => sum + t.groups[grp.key][s], 0);
    }
    return t;
}

const sample = (name: string, width: number): StairRow => ({
    name, width, waist: 0.14, rise: 0.45, run: 0.9, steps: 3, riser: 0.15, tread: 0.3,
    waistMainSize: 'RB9', waistMainSpacing: 0.15, waistTempSize: 'RB9', waistTempSpacing: 0.15,
    stepMainSize: 'RB9', stepMainSpacing: 0.15, stepTempSize: 'RB9', stepTempSpacing: 0.15,
});

/**
 * A new stair for the guided journey: every size read off the stair detail starts at 0; the four bar groups
 * copy the previous stair, or the Excel sample (RB9 @0.15 everywhere).
 */
export function newStairRow(prev?: StairRow): StairRow {
    const bars = prev ?? sample('', 0);
    return {
        name: '', width: 0, waist: 0, rise: 0, run: 0, steps: 0, riser: 0, tread: 0,
        waistMainSize: bars.waistMainSize, waistMainSpacing: bars.waistMainSpacing,
        waistTempSize: bars.waistTempSize, waistTempSpacing: bars.waistTempSpacing,
        stepMainSize: bars.stepMainSize, stepMainSpacing: bars.stepMainSpacing,
        stepTempSize: bars.stepTempSize, stepTempSpacing: bars.stepTempSpacing,
    };
}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/**
 * Journey helper: applies a change of steps / riser / tread and keeps the total rise (= steps × riser) and the
 * horizontal run (= steps × tread) in step while they still match the old values (as in the Excel sample:
 * 3 × 0.15 = 0.45, 3 × 0.30 = 0.90). A rise or run typed by hand that differs is left alone.
 */
export function withStepChange(row: StairRow, patch: Partial<Pick<StairRow, 'steps' | 'riser' | 'tread'>>): StairRow {
    const next = { ...row, ...patch };
    const riseLinked = same(num(row.rise), num(row.steps) * num(row.riser));
    const runLinked = same(num(row.run), num(row.steps) * num(row.tread));
    return {
        ...next,
        rise: riseLinked ? num(next.steps) * num(next.riser) : row.rise,
        run: runLinked ? num(next.steps) * num(next.tread) : row.run,
    };
}

export const stair = defineCalculator<StairInput>({
    id: 'stair',
    sheetName: 'บันได_Stair',
    title: 'โปรแกรมถอดแบบ – งานบันได Stair',
    titleEn: 'Stair',
    sections: [13],
    deps: [],
    // Excel v5 rows 8–10 (rows 11–17 are blank).
    defaults: () => ({
        rows: [sample('บันไดหน้าบ้าน', 3.3), sample('บันไดข้างบ้าน', 2), sample('บันไดหลังบ้าน', 2.9)],
    }),
    // A real project starts with no stairs; each added stair gets the Excel bar spec (newStairRow).
    blank: () => ({ rows: [] }),
    compute: (input) => {
        const t = stairTotals(input);
        const out: Record<string, number> = { props: t.props, formwork: t.formwork, concrete: t.concrete };
        for (const s of REBAR_SIZES) out[`rebar.${s}`] = t.rebar[s];
        return out;
    },
    boqLinks: [
        { line: 'R140', field: 'qty', output: 'props' },      // 2) ไม้ค้ำยัน ← sheet24 N14 = AG6
        { line: 'R142', field: 'qty', output: 'formwork' },   // 3) - ไม้แบบ ← sheet24 O14 = AH6
        { line: 'R145', field: 'qty', output: 'concrete' },   // 4) คอนกรีตโครงสร้าง ← sheet24 P14 = AN6
    ],
    // 1) เหล็กเสริม: one row per bar size + tie wire (Excel R138–R139).
    boqSlots: (input) => ({ rebar: rebarSlotRows(stairTotals(input).rebar) }),
});
