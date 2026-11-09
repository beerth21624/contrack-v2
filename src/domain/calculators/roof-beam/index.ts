// Sheet "คานดาดฟ้า_RoofBeam" (Excel v5 sheet 31) → BOQ (Home) section 12, งานคานดาดฟ้า (rows 114–124).
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.7, §3 (rows 114–124), oddities 1–4.
// Excel goes through sheet 24 (ตารางสรุปวัสดุงานโครงสร้าง row 12); the app links straight to the BOQ rows.
import { roundUp } from '../../boq/engine';
import { REBAR_SIZES, rebarSlotRows, type RebarSize, kgPerMetre, isRebarSize } from '../../boq/slots';
import { NO_TRACE, type Tracer } from '../../trace/tracer';
import { defineCalculator } from '../types';
import { ROOF_BEAM_TRACE_LABELS } from './trace.labels';

/** Bar-size dropdown of G8:G21 / L8:L21. */
export const ROOF_BEAM_BAR_SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;
/** Beam-name dropdown of B8:B21. */
export const ROOF_BEAM_NAMES = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'] as const;

/** One row of the table (rows 8–21 in Excel; unlimited here, D5). */
export interface RoofBeamRow {
    name: string;            // B ชื่อคาน
    width: number;           // C กว้าง (ม.)
    depth: number;           // D ลึก (ม.)
    length: number;          // E ยาว (ม.)
    mainSize: string;        // G ขนาด (เหล็กเสริมหลัก)
    mainCount: number;       // H จำนวน (เส้น)
    stirrupSize: string;     // L ขนาด (เหล็กปลอก)
    stirrupSpacing: number;  // M ระยะห่าง @ (ม.)
}

export interface RoofBeamInput {
    rows: RoofBeamRow[];
}

const num = (v: number) => (Number.isFinite(v) ? v : 0);

export interface RoofBeamRowResult {
    mainLength: number;            // I ความยาว รวม (ม.) = H × E
    mainKg: number;                // J น้ำหนัก (กก.)
    /** N จำนวน (ปลอก) = ROUNDUP(E / M); null where Excel shows "_" (no spacing). */
    stirrupCount: number | null;
    stirrupPerimeter: number;      // O ความยาว /เส้น (ม.) = 2(C + D)
    stirrupLength: number | null;  // P ความยาว รวม (ม.) = N × O
    stirrupKg: number;             // Q น้ำหนัก (กก.)
    props: number;                 // S ไม้ค้ำยัน (ต้น) = ROUNDUP(E / 0.6)
    /** T ไม้แบบ (ตร.ม.) = 2·D·E + C·E (2 sides + soffit). Excel has 2·D·E + C — fixed (D1, oddity 2). */
    formwork: number;
    /** Excel's own T = 2·D·E + C, shown for comparison only. */
    formworkExcel: number;
    concrete: number;              // V คอนกรีต โครงสร้าง (ลบ.ม.) = C × D × E
}

export const roofBeamRowLabel = (r: RoofBeamRow, i: number): string => r.name || `#${i + 1}`;

/** One row (callers pass it to `.map`, so it takes no tracer argument: `roofBeamRowTraced` is the traced form). */
export const roofBeamRow = (r: RoofBeamRow): RoofBeamRowResult => roofBeamRowTraced(r, NO_TRACE);

/** One row. `tr` (dev mode) records every intermediate value; the arithmetic is the same with or without it. */
function roofBeamRowTraced(r: RoofBeamRow, tr: Tracer): RoofBeamRowResult {
    const c = num(r.width), d = num(r.depth), e = num(r.length);
    const mainLength = num(r.mainCount) * e;
    const spacing = num(r.stirrupSpacing);
    const stirrupCount = spacing > 0 ? roundUp(e / spacing) : null;
    const stirrupPerimeter = 2 * (c + d);
    const stirrupLength = stirrupCount === null ? null : stirrupCount * stirrupPerimeter;
    const res: RoofBeamRowResult = {
        mainLength,
        mainKg: mainLength * kgPerMetre(r.mainSize),
        stirrupCount,
        stirrupPerimeter,
        stirrupLength,
        stirrupKg: (stirrupLength ?? 0) * kgPerMetre(r.stirrupSize),
        props: roundUp(e / 0.6),
        formwork: 2 * d * e + c * e,
        formworkExcel: 2 * d * e + c,
        concrete: c * d * e,
    };
    if (tr.enabled) {
        const kM = kgPerMetre(r.mainSize), kS = kgPerMetre(r.stirrupSize);
        tr.constant('propSpacing', 0.6);
        tr.constant('kgPerM', kM, { params: { size: r.mainSize || '-' } });
        tr.constant('kgPerM', kS, { params: { size: r.stirrupSize || '-' } });
        tr.step('mainLength', res.mainLength, { mainCount: num(r.mainCount), length: e });
        tr.step('mainKg', res.mainKg, { mainLength: res.mainLength, kgPerM: kM }, { params: { size: r.mainSize || '-' } });
        if (stirrupCount === null) tr.step('stirrupNone', 0, {});
        else tr.step('stirrupCount', stirrupCount, { length: e, stirrupSpacing: spacing });
        tr.step('stirrupPerimeter', stirrupPerimeter, { width: c, depth: d });
        if (stirrupLength !== null && stirrupCount !== null) {
            tr.step('stirrupLength', stirrupLength, { stirrupCount, stirrupPerimeter });
        }
        tr.step('stirrupKg', res.stirrupKg, { stirrupLength: stirrupLength ?? 0, kgPerM: kS }, { params: { size: r.stirrupSize || '-' } });
        tr.step('props', res.props, { length: e, propSpacing: 0.6 });
        tr.step('formwork', res.formwork, { depth: d, length: e, width: c });
        tr.step('formworkExcel', res.formworkExcel, { depth: d, length: e, width: c });
        tr.step('concrete', res.concrete, { width: c, depth: d, length: e });
    }
    return res;
}

export interface RoofBeamTotals {
    /** G6..K6 SUMIF by main-bar size. */
    main: Record<RebarSize, number>;
    /** L6..P6 SUMIF by stirrup size. */
    stirrup: Record<RebarSize, number>;
    /** main + stirrup per size (sheet 24 row 12, I..M). */
    rebar: Record<RebarSize, number>;
    props: number;          // S6
    formwork: number;       // T6
    formworkExcel: number;  // T6 with Excel's 2·D·E + C
    concrete: number;       // V6
}

const zeroBySize = (): Record<RebarSize, number> => ({ RB6: 0, RB9: 0, DB12: 0, DB16: 0, DB20: 0 });

/** Row-6 totals. Excel S6/T6/V6 sum rows 8–17 of a 14-row table; here every row counts (D1, oddity 3). */
export function roofBeamTotals(input: RoofBeamInput, tr: Tracer = NO_TRACE): RoofBeamTotals {
    const t: RoofBeamTotals = {
        main: zeroBySize(), stirrup: zeroBySize(), rebar: zeroBySize(),
        props: 0, formwork: 0, formworkExcel: 0, concrete: 0,
    };
    const per: RoofBeamRowResult[] = [];
    input.rows.forEach((row, i) => {
        const r = tr.enabled ? tr.row(i, roofBeamRowLabel(row, i), () => roofBeamRowTraced(row, tr)) : roofBeamRow(row);
        per.push(r);
        if (isRebarSize(row.mainSize)) t.main[row.mainSize] += r.mainKg;
        if (isRebarSize(row.stirrupSize)) t.stirrup[row.stirrupSize] += r.stirrupKg;
        t.props += r.props;
        t.formwork += r.formwork;
        t.formworkExcel += r.formworkExcel;
        t.concrete += r.concrete;
    });
    for (const s of REBAR_SIZES) t.rebar[s] = t.main[s] + t.stirrup[s];
    if (tr.enabled) {
        tr.step('totalProps', t.props, { props: per.map(r => r.props) });
        tr.step('totalFormwork', t.formwork, { formwork: per.map(r => r.formwork) });
        tr.step('totalFormworkExcel', t.formworkExcel, { formworkExcel: per.map(r => r.formworkExcel) });
        tr.step('totalConcrete', t.concrete, { concrete: per.map(r => r.concrete) });
        for (const s of REBAR_SIZES) {
            const mk = input.rows.flatMap((row, i) => (isRebarSize(row.mainSize) && row.mainSize === s ? [per[i]?.mainKg ?? 0] : []));
            const sk = input.rows.flatMap((row, i) => (isRebarSize(row.stirrupSize) && row.stirrupSize === s ? [per[i]?.stirrupKg ?? 0] : []));
            if (mk.length + sk.length === 0) continue;
            const params = { size: s };
            if (mk.length > 0) tr.step('totalMainKg', t.main[s], { mainKg: mk }, { params });
            if (sk.length > 0) tr.step('totalStirrupKg', t.stirrup[s], { stirrupKg: sk }, { params });
            tr.step('totalRebar', t.rebar[s], { mainWeight: t.main[s], stirrupWeight: t.stirrup[s] }, { params });
        }
    }
    return t;
}

/**
 * A new beam for the guided journey: name, size, length and bar count read off the plan; the bar sizes and the
 * stirrup spacing copy the previous beam, or the Excel sample (DB12 main bars, RB6 stirrups @0.15).
 */
export function newRoofBeamRow(prev?: RoofBeamRow): RoofBeamRow {
    return {
        name: '',
        width: prev?.width ?? 0,
        depth: prev?.depth ?? 0,
        length: 0,
        mainSize: prev?.mainSize ?? 'DB12',
        mainCount: prev?.mainCount ?? 0,
        stirrupSize: prev?.stirrupSize ?? 'RB6',
        stirrupSpacing: prev?.stirrupSpacing ?? 0.15,
    };
}

export const roofBeam = defineCalculator<RoofBeamInput>({
    id: 'roof-beam',
    sheetName: 'คานดาดฟ้า_RoofBeam',
    title: 'โปรแกรมถอดแบบ BOQ – คานดาดฟ้า RoofBeam',
    titleEn: 'Roof Beam',
    sections: [12],
    deps: [],
    // Excel v5 rows 8–9 (rows 10–21 are blank).
    defaults: () => ({
        rows: [
            { name: 'B5', width: 0.2, depth: 0.3, length: 25, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.15 },
            { name: 'B5', width: 0.2, depth: 0.3, length: 9, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.15 },
        ],
    }),
    // A real project starts with no beams; each added beam gets the Excel bar spec (newRoofBeamRow).
    blank: () => ({ rows: [] }),
    traceLabels: ROOF_BEAM_TRACE_LABELS,
    compute: (input, _ctx, tr = NO_TRACE) => {
        const t = roofBeamTotals(input, tr);
        const out: Record<string, number> = {
            props: t.props,
            formwork: t.formwork,
            formworkExcel: t.formworkExcel,
            concrete: t.concrete,
        };
        for (const s of REBAR_SIZES) {
            out[`main.${s}`] = t.main[s];         // G6..K6
            out[`stirrup.${s}`] = t.stirrup[s];   // L6..P6
            out[`rebar.${s}`] = t.rebar[s];       // sheet 24 row 12
        }
        return out;
    },
    boqLinks: [
        { line: 'R119', field: 'qty', output: 'props' },      // 2) ไม้ค้ำยัน ← sheet24 N12 = S6
        { line: 'R121', field: 'qty', output: 'formwork' },   // 3) - ไม้แบบ ← sheet24 O12 = T6
        { line: 'R124', field: 'qty', output: 'concrete' },   // 4) คอนกรีตโครงสร้าง ← sheet24 P12 = V6
    ],
    // 1) เหล็กเสริม: one row per bar size + tie wire. Waste per size (RB6 6 %, DB12 12 %) fixes Excel's
    // swapped G116/G117 (D1, oddity 1).
    boqSlots: (input) => ({ rebar: rebarSlotRows(roofBeamTotals(input).rebar) }),
});
