// Sheet "คานคอดิน_Beam" (Excel v5 sheet 27) → BOQ (Home) section 8:
//   R69 คอนกรีตหยาบ (lean, via sheet 24 E8), slot `ground-beam.rebar` (rows 71–73, via sheet 24 I8:M8),
//   R77 ไม้แบบ (= Beam!V6 directly), R80 คอนกรีตโครงสร้าง (via sheet 24 P8).
// R68 ถมดินกลับ is the footing sheet's backfill (sheet 24 Q6) — not this sheet.
// Spec: docs/excel-spec/02-structure-steps-06-13.md §2.3 and §3 (rows 67–80).
import { defineCalculator } from '../types';
import { roundUp } from '../../boq/engine';
import { REBAR_SIZES, rebarSlotRows, type RebarSize, kgPerMetre, isRebarSize } from '../../boq/slots';

export interface GroundBeamRow {
    name: string;           // B ชื่อคาน (dropdown B1–B6)
    width: number;          // C กว้าง (ม.)
    depth: number;          // D ลึก (ม.)
    length: number;         // E ยาว (ม.)
    leanThickness: number;  // G หนา (ม.) — คอนกรีตหยาบ
    mainSize: string;       // J ขนาด — เหล็กเสริมหลัก
    mainCount: number;      // K จำนวน (เส้น)
    stirrupSize: string;    // O ขนาด — เหล็กปลอก
    stirrupSpacing: number; // P ระยะห่าง (ม.)
}

export interface GroundBeamInput {
    /** Excel rows 8–21 (14 rows, 4 used in the sample); decision D5: unlimited rows. */
    beams: GroundBeamRow[];
}

/** Excel dropdown B8:B21. */
export const BEAM_NAMES = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'] as const;
/** Excel dropdown J8:J21, O8:O21. */
export const BEAM_BAR_SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;

const num = (v: number) => (Number.isFinite(v) ? v : 0);



export interface GroundBeamRowResult {
    lean: number;                       // H = C*E*G
    mainLength: number;                 // L = K*E (no lap/hook, as Excel)
    mainWeight: number;                 // M = IFERROR(L*SWITCH(J),0)
    /** Q = IFERROR(ROUNDUP(E/P,0),"_") — null where Excel shows "_" (no spacing). No +1, as Excel. */
    stirrupCount: number | null;
    stirrupLength: number;              // R = 2*(C+D)
    stirrupTotalLength: number | null;  // S = IFERROR(Q*R,"_")
    stirrupWeight: number;              // T = IFERROR(S*SWITCH(O),0)
    formwork: number;                   // V = 2*D*E (two sides; the soffit sits on the lean concrete)
    concrete: number;                   // X = C*D*E
}

export function groundBeamRow(r: GroundBeamRow): GroundBeamRowResult {
    const C = num(r.width), D = num(r.depth), E = num(r.length), G = num(r.leanThickness);
    const K = num(r.mainCount), P = num(r.stirrupSpacing);
    const mainLength = K * E;
    const stirrupCount = P !== 0 ? roundUp(E / P) : null;
    const stirrupLength = 2 * (C + D);
    const stirrupTotalLength = stirrupCount === null ? null : stirrupCount * stirrupLength;
    return {
        lean: C * E * G,
        mainLength,
        mainWeight: mainLength * kgPerMetre(r.mainSize),
        stirrupCount,
        stirrupLength,
        stirrupTotalLength,
        stirrupWeight: (stirrupTotalLength ?? 0) * kgPerMetre(r.stirrupSize),
        formwork: 2 * D * E,
        concrete: C * D * E,
    };
}

export interface GroundBeamTotals {
    lean: number;                          // G6
    main: Record<RebarSize, number>;       // J6:N6 = SUMIF(J, size, M)
    stirrup: Record<RebarSize, number>;    // O6:S6 = SUMIF(O, size, T)
    formwork: number;                      // V6
    concrete: number;                      // X6
}

export function groundBeamTotals(input: GroundBeamInput): GroundBeamTotals {
    const zero = () => Object.fromEntries(REBAR_SIZES.map(s => [s, 0])) as Record<RebarSize, number>;
    const t: GroundBeamTotals = { lean: 0, main: zero(), stirrup: zero(), formwork: 0, concrete: 0 };
    for (const r of input.beams) {
        const x = groundBeamRow(r);
        // D1: Excel G6 = SUM(H8:H18) and V6/X6 = SUM(V8:V17)/SUM(X8:X17) although the table runs to row 21,
        // so sheet rows 19–21 (lean; ลำดับ 12–14) and 18–21 (formwork, concrete; ลำดับ 11–14) were silently
        // ignored. Here every row counts. The rebar SUMIFs already cover rows 8–100. The sample uses 4 rows,
        // so the Excel totals are unchanged.
        t.lean += x.lean;
        t.formwork += x.formwork;
        t.concrete += x.concrete;
        if (isRebarSize(r.mainSize)) t.main[r.mainSize] += x.mainWeight;
        if (isRebarSize(r.stirrupSize)) t.stirrup[r.stirrupSize] += x.stirrupWeight;
    }
    return t;
}

/** Net kg per bar size, main + stirrup (sheet 24 row 8: I8 = Beam!J6+O6 … M8 = N6+S6). */
export function groundBeamRebar(input: GroundBeamInput): Record<RebarSize, number> {
    const t = groundBeamTotals(input);
    return Object.fromEntries(REBAR_SIZES.map(s => [s, t.main[s] + t.stirrup[s]])) as Record<RebarSize, number>;
}

/**
 * A beam type added in the guided journey. The first one keeps the Excel sample's standard choices (lean 0.05 m,
 * DB12 main bars, RB6 stirrups @ 0.15 m) with the plan values (size, length, bar count) empty; later ones copy the
 * previous beam's section and bars (beams of one house are mostly alike) with the length empty. Next free name.
 */
export function newGroundBeamRow(beams: readonly GroundBeamRow[]): GroundBeamRow {
    const name = BEAM_NAMES.find(n => !beams.some(b => b.name === n)) ?? '';
    const last = beams[beams.length - 1];
    return last
        ? { ...last, name, length: 0 }
        : { name, width: 0, depth: 0, length: 0, leanThickness: 0.05, mainSize: 'DB12', mainCount: 0, stirrupSize: 'RB6', stirrupSpacing: 0.15 };
}

export const groundBeam = defineCalculator<GroundBeamInput>({
    id: 'ground-beam',
    sheetName: 'คานคอดิน_Beam',
    title: 'โปรแกรมถอดแบบ – คานคอดิน Ground Beam',
    titleEn: 'Ground Beam',
    sections: [8],
    deps: [],
    defaults: () => ({
        beams: [
            { name: 'B1', width: 0.2, depth: 0.5, length: 10, leanThickness: 0.05, mainSize: 'DB12', mainCount: 10, stirrupSize: 'RB6', stirrupSpacing: 0.15 },
            { name: 'B2', width: 0.2, depth: 0.4, length: 86, leanThickness: 0.05, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.15 },
            { name: 'B3', width: 0.2, depth: 0.4, length: 3.2, leanThickness: 0.05, mainSize: 'DB12', mainCount: 7, stirrupSize: 'RB6', stirrupSpacing: 0.15 },
            // E11 is typed `=14+2` in Excel.
            { name: 'B4', width: 0.2, depth: 0.4, length: 16, leanThickness: 0.05, mainSize: 'DB12', mainCount: 10, stirrupSize: 'RB6', stirrupSpacing: 0.15 },
        ],
    }),
    // A real project: no beam types until the user adds them from the ground-beam plan.
    blank: () => ({ beams: [] }),
    compute: (input) => {
        const t = groundBeamTotals(input);
        const out: Record<string, number> = {
            lean: t.lean,
            formwork: t.formwork,
            concrete: t.concrete,
        };
        for (const s of REBAR_SIZES) {
            out[`main.${s}`] = t.main[s];
            out[`stirrup.${s}`] = t.stirrup[s];
            out[`rebar.${s}`] = t.main[s] + t.stirrup[s];
        }
        return out;
    },
    boqLinks: [
        { line: 'R69', field: 'qty', output: 'lean' },      // E69 = sheet24 E8 = Beam!G6
        { line: 'R77', field: 'qty', output: 'formwork' },  // E77 = Beam!V6
        { line: 'R80', field: 'qty', output: 'concrete' },  // E80 = sheet24 P8 = Beam!X6
    ],
    // Rows 71–73: one `- เหล็ก <size>` row per size with kg > 0 + tie wire 3 % (sheet 24 I8:M8).
    boqSlots: (input) => ({ rebar: rebarSlotRows(groundBeamRebar(input)) }),
});
