// Sheet "เสาตอม่อ_Footing Column" (Excel v5 sheet 26) → BOQ (Home) section 7: R62 ไม้แบบ, R65 คอนกรีตโครงสร้าง;
// slot 6.6 เหล็กเสริม - ***เสาตอม่อ (R47–R49, placed in section 6 by the template);
// and R68 ถมดินกลับ (section 8), which is the footing sheet's column AI.
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.2 (and §2.1 for AI).
//
// Dependency: pedestal → footing. The bar length needs the thickness/width of the footing the pedestal
// sits on, and the footing backfill subtracts the pedestal concrete, so this calculator reads the
// footing's per-row geometry and its backfill before pedestals (`backfillGross`) and outputs the final
// `backfill` (= Footing!AI6). No cycle: footing reads nothing from here.
//
// Row pairing (decision D13): Excel assumes pedestal row n sits on footing row n. Here each pedestal row
// picks its footing row (`footing`, 0-based index); the default is the same row index.
import { REBAR_SIZES, rebarSlotRows } from '../../boq/slots';
import { roundUp } from '../../boq/engine';
import { addWeight, emptyWeights, footingRowKey, kgPerMetre, nextUnusedName, type RebarWeights } from '../footing';
import { defineCalculator, type CalcContext } from '../types';

export interface PedestalRow {
    name: string;            // B ชื่อเสา (dropdown C1,C2,C3)
    /** Footing row (0-based) this pedestal sits on (D13); Excel: the same row number. */
    footing: number;
    count: number;           // C จำนวน เสา (ต้น)
    width: number;           // D กว้าง (ม.)
    length: number;          // E ยาว (ม.)
    height: number;          // F สูง (ม.)
    mainBarSize: string;     // H ปริมาณเหล็กเสริมหลัก · ขนาด
    mainBarCount: number;    // I จำนวน (เส้น)
    stirrupSize: string;     // M ปริมาณเหล็กปลอก · ขนาด
    stirrupSpacing: number;  // N ระยะห่าง (ม.)
}

export interface PedestalInput {
    /** Rows 8–17 of the sheet (only row 8 holds data in v5); decision D5: unlimited rows. */
    rows: PedestalRow[];
}

/** Dropdown B8:B17. */
export const PEDESTAL_NAMES = ['C1', 'C2', 'C3'] as const;
/** Dropdown H8:H17 / M8:M17. */
export const PEDESTAL_BAR_SIZES = REBAR_SIZES;

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/** The footing row a pedestal sits on, as read from the footing calculator's outputs (0 when missing — Excel reads blanks as 0). */
export interface FootingRef {
    width: number;   // Footing!D
    depth: number;   // Footing!F (thickness)
}

export function footingRefFor(footingOutputs: Record<string, number> | undefined, index: number): FootingRef {
    return {
        width: footingOutputs?.[footingRowKey(index, 'width')] ?? 0,
        depth: footingOutputs?.[footingRowKey(index, 'depth')] ?? 0,
    };
}

export interface PedestalRowResult {
    mainLength: number;          // J ความยาว /เส้น
    mainTotal: number;           // K ความยาว รวม
    mainKg: number;              // L น้ำหนัก
    /** O จำนวน (ปลอก); null where Excel shows "-" (no spacing). */
    stirrupCount: number | null;
    stirrupLength: number;       // P ความยาว /เส้น
    stirrupTotal: number | null; // Q ความยาว รวม ("-" → null)
    stirrupKg: number;           // R น้ำหนัก
    formwork: number;            // T ไม้แบบ (ตร.ม.)
    concrete: number;            // V คอนกรีต โครงสร้าง (ลบ.ม.)
}

export function pedestalRow(r: PedestalRow, f: FootingRef): PedestalRowResult {
    const n = num(r.count), w = num(r.width), l = num(r.length), h = num(r.height);
    // J = F + Footing!F + (Footing!D / 3)
    const mainLength = h + f.depth + f.width / 3;
    const mainTotal = n * mainLength * num(r.mainBarCount);       // K = C*J*I
    const mainKg = mainTotal * kgPerMetre(r.mainBarSize);          // L
    // O = IFERROR(ROUNDUP((Footing!$F$8 + F) / N, 0), "-").
    // D1 fix: Excel uses the absolute $F$8 (footing row 1) for every pedestal while the bar length uses the
    // same-row footing; here the pedestal's own footing thickness is used. Same result for the v5 sample (one row).
    const s = num(r.stirrupSpacing);
    const stirrupCount = s > 0 ? roundUp((f.depth + h) / s) : null;
    const stirrupLength = 2 * (w + l);                             // P = 2*(D+E)
    const stirrupTotal = stirrupCount === null ? null : n * stirrupCount * stirrupLength; // Q = IFERROR(C*O*P,"-")
    const stirrupKg = stirrupTotal === null ? 0 : stirrupTotal * kgPerMetre(r.stirrupSize); // R = IFERROR(…,0)
    return {
        mainLength, mainTotal, mainKg,
        stirrupCount, stirrupLength, stirrupTotal, stirrupKg,
        formwork: n * (2 * (w + l)) * h,                           // T = C*(2*(D+E))*F
        concrete: n * (w * l) * h,                                 // V = C*(D*E)*F
    };
}

export interface PedestalTotals {
    main: RebarWeights;     // H6:L6
    stirrup: RebarWeights;  // M6:Q6
    rebar: RebarWeights;    // sheet 24 I7:M7 = main + stirrup
    formwork: number;       // T6
    concrete: number;       // V6
}

export function pedestalTotals(rows: PedestalRow[], footingOutputs: Record<string, number> | undefined): PedestalTotals {
    const t: PedestalTotals = { main: emptyWeights(), stirrup: emptyWeights(), rebar: emptyWeights(), formwork: 0, concrete: 0 };
    for (const r of rows) {
        const c = pedestalRow(r, footingRefFor(footingOutputs, r.footing));
        addWeight(t.main, r.mainBarSize, c.mainKg);
        addWeight(t.stirrup, r.stirrupSize, c.stirrupKg);
        t.formwork += c.formwork;
        t.concrete += c.concrete;
    }
    for (const s of REBAR_SIZES) t.rebar[s] = t.main[s] + t.stirrup[s];
    return t;
}

/**
 * Footing rows were deleted (`after` keeps the surviving row objects of `before`, in order): point every pedestal
 * at the same footing row again. A pedestal whose footing was deleted gets −1 (no footing chosen). Returns
 * undefined when nothing changes. Only meaningful for deletions — an edited row is a new object.
 */
export function remapPedestalFootings<F>(input: PedestalInput, before: readonly F[], after: readonly F[]): PedestalInput | undefined {
    if (after.length >= before.length) return undefined;
    const rows = input.rows.map(r => {
        const inRange = r.footing >= 0 && r.footing < before.length;
        const next = inRange ? after.indexOf(before[r.footing] as F) : r.footing;
        return next === r.footing ? r : { ...r, footing: next };
    });
    return rows.some((r, i) => r !== input.rows[i]) ? { ...input, rows } : undefined;
}

/** Output key: Footing!AI of footing row i (its backfill after the pedestals that sit on it). */
export const footingBackfillKey = (i: number) => `footingBackfill.${i}`;

export const emptyPedestalRow = (footingIndex: number): PedestalRow => ({
    name: '', footing: footingIndex, count: 0, width: 0, length: 0, height: 0,
    mainBarSize: '', mainBarCount: 0, stirrupSize: '', stirrupSpacing: 0,
});

/**
 * A pedestal added in the guided journey. It sits on the first footing type no pedestal uses yet (else the
 * first footing), starts with that footing's count (one pedestal per footing), keeps the Excel sample's
 * standard bars (DB12 main, RB6 stirrups @ 0.15 m) and takes the next free name; sizes and bar count stay empty.
 */
export function newPedestalRow(pedestals: readonly PedestalRow[], footings: readonly { count: number }[]): PedestalRow {
    const free = footings.findIndex((_, i) => !pedestals.some(p => p.footing === i));
    const index = free >= 0 ? free : 0;
    return {
        ...emptyPedestalRow(index),
        name: nextUnusedName(PEDESTAL_NAMES, pedestals.map(p => p.name)),
        count: footings[index]?.count ?? 0,
        mainBarSize: 'DB12', stirrupSize: 'RB6', stirrupSpacing: 0.15,
    };
}

/** One new pedestal on each footing type (the journey's empty-state button). */
export function pedestalsForFootings(footings: readonly { count: number }[]): PedestalRow[] {
    return footings.reduce<PedestalRow[]>(rows => [...rows, newPedestalRow(rows, footings)], []);
}

const footingOf = (ctx: CalcContext) => ctx.outputs('footing');

export const pedestal = defineCalculator<PedestalInput>({
    id: 'pedestal',
    sheetName: 'เสาตอม่อ_Footing Column',
    title: 'โปรแกรมถอดแบบ – งานเสาตอม่อ Footing Column',
    titleEn: 'Footing Column (Pedestal)',
    sections: [7, 6, 8],
    deps: ['footing'],
    defaults: () => ({
        rows: [{
            name: 'C1', footing: 0, count: 21, width: 0.25, length: 0.2, height: 0.6,
            mainBarSize: 'DB12', mainBarCount: 6,
            stirrupSize: 'RB6', stirrupSpacing: 0.15,
        }],
    }),
    // A real project: no pedestals until the user adds them (after the footing types they sit on).
    blank: () => ({ rows: [] }),
    compute: (input, ctx) => {
        const fo = footingOf(ctx);
        const t = pedestalTotals(input.rows, fo);
        const out: Record<string, number> = {
            formwork: t.formwork,   // T6 → sheet 24 O7 → BOQ E62
            concrete: t.concrete,   // V6 → sheet 24 P7 → BOQ E65
        };
        for (const s of REBAR_SIZES) {
            out[`rebar.${s}`] = t.rebar[s];
            out[`main.${s}`] = t.main[s];
            out[`stirrup.${s}`] = t.stirrup[s];
        }
        if (fo) {
            // Footing!AI = I − K − M − AG − pedestal V. Excel pairs rows by number; with D13 each footing row
            // subtracts the pedestals that sit on it. The total subtracts every pedestal (as Excel, where every
            // pedestal row has a footing row), so a pedestal pointing at a missing footing row still counts.
            const footingRows = fo.rows ?? 0;
            const onFooting = new Array<number>(footingRows).fill(0);
            for (const r of input.rows) {
                const v = pedestalRow(r, footingRefFor(fo, r.footing)).concrete;
                if (r.footing >= 0 && r.footing < footingRows) onFooting[r.footing] = (onFooting[r.footing] ?? 0) + v;
            }
            // Excel lets backfill go negative (pedestals with no footing pit); no soil can be negative (D1).
            onFooting.forEach((v, i) => { out[footingBackfillKey(i)] = Math.max(0, (fo[footingRowKey(i, 'backfillGross')] ?? 0) - v); });
            out.backfill = Math.max(0, (fo.backfillGross ?? 0) - t.concrete);   // Footing!AI6 → sheet 24 Q6 → BOQ E68
        }
        return out;
    },
    boqLinks: [
        { line: 'R62', field: 'qty', output: 'formwork' },
        { line: 'R65', field: 'qty', output: 'concrete' },
        { line: 'R68', field: 'qty', output: 'backfill' },
    ],
    // 6.6 เหล็กเสริม - ***เสาตอม่อ: sheet 24 row 7 (main + stirrup) by size + tie wire.
    boqSlots: (input, ctx) => ({ rebar: rebarSlotRows(pedestalTotals(input.rows, footingOf(ctx)).rebar) }),
});
