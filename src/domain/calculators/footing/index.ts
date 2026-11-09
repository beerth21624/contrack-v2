// Sheet "ฐานราก_Footing" (Excel v5 sheet 25) → BOQ (Home) section 6: R38 ขุดดิน, R40 ทรายหยาบ,
// R41 คอนกรีตหยาบ, slot 6.5 เหล็กเสริม ฟุตติ้ง (R43–R45), R55 ไม้แบบ, R58 คอนกรีตโครงสร้าง.
// R39 ตัดหัวเสาเข็ม follows the pile count (BOQ E35) in the template.
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.1.
//
// Backfill (column AI → BOQ R68 ถมดินกลับ) = excavation − sand − lean − footing concrete − pedestal concrete.
// The pedestal sheet needs this sheet's thickness/width for its bar lengths, so the dependency runs
// footing → pedestal: this calculator outputs the backfill *before* the pedestal volume
// (`backfillGross`, per row and in total) and the pedestal calculator subtracts its concrete and
// outputs the final `backfill` that feeds R68.
import { REBAR_SIZES, rebarSlotRows, type RebarSize, kgPerMetre } from '../../boq/slots';

/** Re-exported for the pedestal sheet. */
export { kgPerMetre } from '../../boq/slots';
import { defineCalculator } from '../types';
import { NO_TRACE, type Tracer } from '../../trace/tracer';
import { FOOTING_TRACE_LABELS } from './trace.labels';

export interface FootingRow {
    name: string;            // B ชื่อ ฐานราก (dropdown F1,F2,F4)
    count: number;           // C จำนวน ฐานราก (ฐาน)
    width: number;           // D กว้าง (ม.)
    length: number;          // E ยาว (ม.)
    depth: number;           // F ลึก (ม.) — footing thickness
    excavationDepth: number; // H ดินขุด · ลึก (ม.)
    sandThickness: number;   // J ทรายหยาบ · หนา (ม.)
    leanThickness: number;   // L คอนกรีตหยาบ · หนา (ม.)
    shortBarSize: string;    // O เหล็กเสริมหลัก (ด้านสั้น) · ขนาด
    shortBarCount: number;   // P จำนวน (เส้น)
    longBarSize: string;     // T เหล็กเสริมหลัก (ด้านยาว) · ขนาด
    longBarCount: number;    // U จำนวน (เส้น)
    ringBarSize: string;     // Y เหล็กรัดรอบ · ขนาด
    ringBarCount: number;    // Z จำนวน (เส้น)
}

export interface FootingInput {
    /** Rows 8–18 of the sheet (only row 8 holds data in v5); decision D5: unlimited rows. */
    rows: FootingRow[];
}

/** Dropdown B8:B18 (Excel has no F3). */
export const FOOTING_NAMES = ['F1', 'F2', 'F4'] as const;
/** Dropdown O/T/Y — Excel's list is "RB6,RB9,DB12,DB16,DB20,DB20"; the duplicate DB20 is dropped. */
export const FOOTING_BAR_SIZES = REBAR_SIZES;

/** Working space each side of the footing for excavation, sand and lean (hard-coded 0.4 m in Excel). */
export const EXCAVATION_MARGIN = 0.4;
/** Sand bed allowance ×(100%+25%) in column K. */
export const SAND_FACTOR = 1.25;

const num = (v: number) => (Number.isFinite(v) ? v : 0);


export type RebarWeights = Record<RebarSize, number>;

export const emptyWeights = (): RebarWeights => ({ RB6: 0, RB9: 0, DB12: 0, DB16: 0, DB20: 0 });

/** SUMIF(sizeCol,"<size>",kgCol) for every bar size. */
export function addWeight(w: RebarWeights, size: string, kg: number): void {
    if ((REBAR_SIZES as readonly string[]).includes(size)) w[size as RebarSize] += kg;
}

export interface FootingRowResult {
    excavation: number;    // I
    sand: number;          // K
    lean: number;          // M
    shortLength: number;   // Q ความยาว /เส้น
    shortTotal: number;    // R ความยาว รวม
    shortKg: number;       // S น้ำหนัก
    longLength: number;    // V
    longTotal: number;     // W
    longKg: number;        // X
    ringLength: number;    // AA ความยาว ต่อเส้น
    ringTotal: number;     // AB
    ringKg: number;        // AC
    formwork: number;      // AE
    concrete: number;      // AG
    /** AI before the pedestal concrete: I − K − M − AG. */
    backfillGross: number;
}

/**
 * One row of the sheet. `tr` (dev mode) records every intermediate value; the arithmetic is the same with or
 * without it. Call inside `tr.row(i, label, …)` so the steps are attributed to the row.
 */
export function footingRow(r: FootingRow, tr: Tracer = NO_TRACE): FootingRowResult {
    const n = num(r.count), w = num(r.width), l = num(r.length), t = num(r.depth);
    const M = EXCAVATION_MARGIN;
    // (D+0.4+0.4)*(E+0.4+0.4)
    const pit = (w + 2 * EXCAVATION_MARGIN) * (l + 2 * EXCAVATION_MARGIN);
    const excavation = n * pit * num(r.excavationDepth);          // I = C*pit*H
    const sand = n * pit * num(r.sandThickness) * SAND_FACTOR;     // K = C*pit*J*(100%+25%)
    const lean = n * pit * num(r.leanThickness);                   // M = C*pit*L
    const shortLength = w + 2 * t;                                 // Q = D+(2*F)
    const shortTotal = n * num(r.shortBarCount) * shortLength;     // R = C*P*Q
    const shortKg = shortTotal * kgPerMetre(r.shortBarSize);       // S
    const longLength = l + 2 * t;                                  // V = E+(2*F)
    const longTotal = n * num(r.longBarCount) * longLength;        // W = C*U*V
    const longKg = longTotal * kgPerMetre(r.longBarSize);          // X
    const ringLength = 2 * w + 2 * l;                              // AA = (2*D)+(2*E)
    const ringTotal = n * num(r.ringBarCount) * ringLength;        // AB = C*Z*AA
    const ringKg = ringTotal * kgPerMetre(r.ringBarSize);          // AC
    const formwork = n * (2 * w + 2 * l) * t;                      // AE = C*((2*D)+(2*E))*F
    const concrete = n * (w * l) * t;                              // AG = C*(D*E)*F
    const backfillGross = excavation - sand - lean - concrete;
    if (tr.enabled) {
        tr.constant('margin', M);
        tr.constant('sandFactor', SAND_FACTOR);
        const kg = (size: string) => { const v = kgPerMetre(size); tr.constant('kgPerM', v, { params: { size: size || '-' } }); return v; };
        const kS = kg(r.shortBarSize), kL = kg(r.longBarSize), kR = kg(r.ringBarSize);
        tr.step('pit', pit, { width: w, length: l, margin: M });
        tr.step('excavation', excavation, { count: n, pit, excavationDepth: num(r.excavationDepth) });
        tr.step('sand', sand, { count: n, pit, sandThickness: num(r.sandThickness), sandFactor: SAND_FACTOR });
        tr.step('lean', lean, { count: n, pit, leanThickness: num(r.leanThickness) });
        tr.step('shortLength', shortLength, { width: w, depth: t });
        tr.step('shortTotal', shortTotal, { count: n, shortBarCount: num(r.shortBarCount), shortLength });
        tr.step('shortKg', shortKg, { shortTotal, kgPerM: kS }, { params: { size: r.shortBarSize || '-' } });
        tr.step('longLength', longLength, { length: l, depth: t });
        tr.step('longTotal', longTotal, { count: n, longBarCount: num(r.longBarCount), longLength });
        tr.step('longKg', longKg, { longTotal, kgPerM: kL }, { params: { size: r.longBarSize || '-' } });
        tr.step('ringLength', ringLength, { width: w, length: l });
        tr.step('ringTotal', ringTotal, { count: n, ringBarCount: num(r.ringBarCount), ringLength });
        tr.step('ringKg', ringKg, { ringTotal, kgPerM: kR }, { params: { size: r.ringBarSize || '-' } });
        tr.step('formwork', formwork, { count: n, width: w, length: l, depth: t });
        tr.step('concrete', concrete, { count: n, width: w, length: l, depth: t });
        tr.step('backfillGross', backfillGross, { excavation, sand, lean, concrete });
    }
    return {
        excavation, sand, lean,
        shortLength, shortTotal, shortKg,
        longLength, longTotal, longKg,
        ringLength, ringTotal, ringKg,
        formwork, concrete,
        backfillGross,
    };
}

/** What a footing row is called in the trace: its name, else its 1-based number. */
export const footingRowLabel = (r: FootingRow, i: number): string => r.name || `#${i + 1}`;

export interface FootingTotals {
    excavation: number;   // H6
    sand: number;         // J6
    lean: number;         // L6
    short: RebarWeights;  // O6:S6
    long: RebarWeights;   // T6:X6
    ring: RebarWeights;   // Y6:AC6
    rebar: RebarWeights;  // sheet 24 I6:M6 = short + long + ring
    formwork: number;     // AE6
    concrete: number;     // AG6
    backfillGross: number;
}

/** Totals of all rows. With a tracer: every row's steps (via footingRow) and the totals' steps. */
export function footingTotals(rows: FootingRow[], tr: Tracer = NO_TRACE): FootingTotals {
    const t: FootingTotals = {
        excavation: 0, sand: 0, lean: 0,
        short: emptyWeights(), long: emptyWeights(), ring: emptyWeights(), rebar: emptyWeights(),
        formwork: 0, concrete: 0, backfillGross: 0,
    };
    const per: FootingRowResult[] = [];
    rows.forEach((r, i) => {
        const c = tr.enabled ? tr.row(i, footingRowLabel(r, i), () => footingRow(r, tr)) : footingRow(r);
        per.push(c);
        t.excavation += c.excavation;
        t.sand += c.sand;
        t.lean += c.lean;
        addWeight(t.short, r.shortBarSize, c.shortKg);
        addWeight(t.long, r.longBarSize, c.longKg);
        addWeight(t.ring, r.ringBarSize, c.ringKg);
        t.formwork += c.formwork;
        t.concrete += c.concrete;
        t.backfillGross += c.backfillGross;
    });
    for (const s of REBAR_SIZES) t.rebar[s] = t.short[s] + t.long[s] + t.ring[s];
    if (tr.enabled) {
        const col = (f: (c: FootingRowResult) => number) => per.map(f);
        tr.step('totalExcavation', t.excavation, { excavation: col(c => c.excavation) });
        tr.step('totalSand', t.sand, { sand: col(c => c.sand) });
        tr.step('totalLean', t.lean, { lean: col(c => c.lean) });
        tr.step('totalFormwork', t.formwork, { formwork: col(c => c.formwork) });
        tr.step('totalConcrete', t.concrete, { concrete: col(c => c.concrete) });
        tr.step('totalBackfillGross', t.backfillGross, { backfillGross: col(c => c.backfillGross) });
        // Weight per bar size: only sizes some row uses (Σ of the rows' weights of that size).
        const bySize = (size: string, pick: (r: FootingRow) => string, kg: (c: FootingRowResult) => number) =>
            rows.flatMap((r, i) => (pick(r) === size ? [kg(per[i] ?? footingRow(r))] : []));
        for (const s of REBAR_SIZES) {
            const sh = bySize(s, r => r.shortBarSize, c => c.shortKg);
            const lo = bySize(s, r => r.longBarSize, c => c.longKg);
            const ri = bySize(s, r => r.ringBarSize, c => c.ringKg);
            if (sh.length + lo.length + ri.length === 0) continue;
            const params = { size: s };
            if (sh.length > 0) tr.step('totalShortKg', t.short[s], { shortKg: sh }, { params });
            if (lo.length > 0) tr.step('totalLongKg', t.long[s], { longKg: lo }, { params });
            if (ri.length > 0) tr.step('totalRingKg', t.ring[s], { ringKg: ri }, { params });
            tr.step('totalRebar', t.rebar[s], { shortWeight: t.short[s], longWeight: t.long[s], ringWeight: t.ring[s] }, { params });
        }
    }
    return t;
}

/** Output keys the pedestal sheet reads for the footing a pedestal sits on (row index i, 0-based). */
export const footingRowKey = (i: number, field: 'width' | 'depth' | 'backfillGross') => `row.${i}.${field}`;

export const emptyFootingRow = (): FootingRow => ({
    name: '', count: 0, width: 0, length: 0, depth: 0, excavationDepth: 0, sandThickness: 0, leanThickness: 0,
    shortBarSize: '', shortBarCount: 0, longBarSize: '', longBarCount: 0, ringBarSize: '', ringBarCount: 0,
});

/** Sum of a weight table (kg of every bar size). */
export const totalKg = (w: Partial<Record<RebarSize, number>>): number =>
    REBAR_SIZES.reduce((sum, s) => sum + (w[s] ?? 0), 0);

/** The first name of `options` no row uses yet ('' when all are taken). */
export function nextUnusedName(options: readonly string[], used: readonly string[]): string {
    return options.find(o => !used.includes(o)) ?? '';
}

/**
 * A footing type added in the guided journey: the plan values (count, size, depth, bar counts) empty, the
 * Excel sample's standard choices kept — sand and lean bed 0.05 m (J8/L8), bars DB12 / DB12 / RB9 (O8/T8/Y8) —
 * and the next free name of the Excel list.
 */
export function newFootingRow(rows: readonly FootingRow[]): FootingRow {
    return {
        ...emptyFootingRow(),
        name: nextUnusedName(FOOTING_NAMES, rows.map(r => r.name)),
        sandThickness: 0.05, leanThickness: 0.05,
        shortBarSize: 'DB12', longBarSize: 'DB12', ringBarSize: 'RB9',
    };
}

export const footing = defineCalculator<FootingInput>({
    id: 'footing',
    sheetName: 'ฐานราก_Footing',
    title: 'โปรแกรมถอดแบบ – งานฐานราก Footing',
    titleEn: 'Footing',
    sections: [6, 8],
    deps: [],
    defaults: () => ({
        rows: [{
            name: 'F1', count: 21, width: 0.6, length: 0.6, depth: 0.6,
            excavationDepth: 1.3, sandThickness: 0.05, leanThickness: 0.05,
            shortBarSize: 'DB12', shortBarCount: 5,
            longBarSize: 'DB12', longBarCount: 5,
            ringBarSize: 'RB9', ringBarCount: 2,
        }],
    }),
    // A real project: no footing types until the user adds them from the foundation plan.
    blank: () => ({ rows: [] }),
    compute: (input, _ctx, tr = NO_TRACE) => {
        const t = footingTotals(input.rows, tr);
        const out: Record<string, number> = {
            excavation: t.excavation,   // H6 → BOQ E38 (direct ref)
            sand: t.sand,               // J6 → sheet 24 D6 → BOQ E40
            lean: t.lean,               // L6 → sheet 24 E6 → BOQ E41
            formwork: t.formwork,       // AE6 → sheet 24 O6 → BOQ E55
            concrete: t.concrete,       // AG6 → sheet 24 P6 → BOQ E58
            backfillGross: t.backfillGross,
            rows: input.rows.length,
        };
        for (const s of REBAR_SIZES) {
            out[`rebar.${s}`] = t.rebar[s];
            out[`short.${s}`] = t.short[s];
            out[`long.${s}`] = t.long[s];
            out[`ring.${s}`] = t.ring[s];
        }
        input.rows.forEach((r, i) => {
            out[footingRowKey(i, 'width')] = num(r.width);
            out[footingRowKey(i, 'depth')] = num(r.depth);
            out[footingRowKey(i, 'backfillGross')] = footingRow(r).backfillGross;
        });
        return out;
    },
    traceLabels: FOOTING_TRACE_LABELS,
    boqLinks: [
        { line: 'R38', field: 'qty', output: 'excavation' },
        { line: 'R40', field: 'qty', output: 'sand' },
        { line: 'R41', field: 'qty', output: 'lean' },
        { line: 'R55', field: 'qty', output: 'formwork' },
        { line: 'R58', field: 'qty', output: 'concrete' },
    ],
    // 6.5 เหล็กเสริม - ***ฟุตติ้ง: one row per bar size with weight > 0 + tie wire (sheet 24 row 6, I:M).
    boqSlots: (input) => ({ rebar: rebarSlotRows(footingTotals(input.rows).rebar) }),
});
