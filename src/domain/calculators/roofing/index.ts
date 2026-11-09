// Sheet "มุงหลังคา_Roofing" (Excel v5 sheet 23) → BOQ (Home) section 16, rows 162–176.
// Spec: docs/excel-spec/03-roof-brick-plaster-doors.md §3. CPAC concrete tile only (deck p70 "อันนี้แค่หลังคา CPAC").
import { roundUp } from '../../boq/engine';
import { NO_TRACE, type Tracer } from '../../trace/tracer';
import { defineCalculator } from '../types';
import { ROOFING_TRACE_LABELS } from './trace.labels';

/** D หน่วย (of the factor) — Excel dropdown D5:D21. */
export const ROOFING_FACTOR_UNITS = ['ตร.ม./ม้วน', 'แผ่น/ตร.ม.', 'แผ่น/ม.', 'ม./แผ่น', 'แผ่น'] as const;
/** F หน่วย (of the take-off) — Excel dropdown F5:F21. */
export const ROOFING_TAKEOFF_UNITS = ['ตร.ม.', 'ม.', 'จุด'] as const;
/** H หน่วย (purchase unit) — Excel dropdown H5:H21. */
export const ROOFING_BOQ_UNITS = ['แผ่น', 'ม้วน'] as const;
/**
 * B รายการวัสดุมุงและครอบ — Excel dropdown B5:B21, in Excel's order. Excel's values carry trailing spaces
 * (oddity 5); they are stored trimmed here.
 */
export const ROOFING_ITEMS = [
    'กระเบื้องหลังคาซีแพคโมเนีย',
    'ครอบข้างจั่ว',
    'ครอบข้างผนัง',
    'ครอบโค้ง 2 ทาง',
    'ครอบโค้ง 3 ทาง',
    'ครอบโค้ง 4 ทาง',
    'ครอบโค้งหางมน',
    'ครอบปิดจั่ว',
    'ครอบปิดชาย',
    'ครอบสันโค้ง',
    'ชุดครอบข้างผนัง',
    'ชุดครอบระบบแห้ง DRYTECH',
    'แผ่นปิดกันนก',
    'แผ่นสะท้อนความร้อน (1.25 x 60 ม./ม้วน)',
    'ไม้เชิงชาย',
    'รางน้ำตะเข้',
] as const;

/** E ปริมาณถอดแบบ — what the take-off cell holds. Excel rows hold a value, a sum of lengths or a link. */
export type RoofingTakeoff =
    /** `=K7` พื้นที่ตามแนวลาดเอียง (rows 5, 17). */
    | { kind: 'slope' }
    /** Typed lengths / counts, summed (`=2.4+9.2+6.6+0.9`, `7.2`, `=5.09*2` → [5.09, 5.09]). */
    | { kind: 'lengths'; lengths: number[] }
    /** Plan lengths ÷ COS(RADIANS(deg)) — the gable rake (row 7; Excel hard-codes 40°, oddity 14). */
    | { kind: 'rake'; lengths: number[]; deg: number }
    /** `=E6` — the take-off of another row (rows 12, 13), by that row's key. */
    | { kind: 'row'; ref: string };

export interface RoofingRow {
    /** Stable id (used by `{ kind: 'row' }` references). */
    key: string;
    item: string;          // B รายการวัสดุมุงและครอบ
    factor: number;        // C ปริมาณ ต่อหน่วย
    factorUnit: string;    // D หน่วย
    takeoff: RoofingTakeoff; // E ปริมาณ ถอดแบบ
    takeoffUnit: string;   // F หน่วย
    unit: string;          // H หน่วย (purchase)
}

export interface RoofingInput {
    planArea: number;      // K5 พื้นที่ตามแนวราบ (ตร.ม)
    slopeDeg: number;      // K6 ความลาดเอียงหลังคา Slope (องศา)
    /** Rows 5–21. The first 13 feed BOQ R162–R174 by position (like Excel); added rows do not reach the BOQ. */
    rows: RoofingRow[];
}

/** Number of rows linked to BOQ (Excel rows 5–17 → BOQ 162–174). */
export const ROOFING_BOQ_ROWS = 13;
/** Row (0-based) whose take-off is the fascia length → BOQ R176 (Excel E16). */
export const FASCIA_ROW = 11;

const num = (v: number) => (Number.isFinite(v) ? v : 0);
const sum = (xs: number[]) => xs.reduce((s, x) => s + num(x), 0);
/**
 * 1/COS(RADIANS(deg)). A pitch of 90° or more is not a roof: COS is 0 or negative there (Excel gives about 1e16
 * times the plan area, or a negative one), so it counts as no slope length at all; the page warns about the pitch.
 */
const perCos = (deg: number) => {
    const c = Math.cos((num(deg) * Math.PI) / 180);
    return c > 1e-6 ? 1 / c : 0;
};

/** K7 = K5/COS(RADIANS(K6)). */
export function slopeArea(input: Pick<RoofingInput, 'planArea' | 'slopeDeg'>): number {
    return num(input.planArea) * perCos(input.slopeDeg);
}

/**
 * G formula of a row. Excel fixes it per row (G5:G11 and G18:G21 multiply, G12:G17 divide, oddity 16);
 * here it follows the factor unit D, which gives the same choice on every Excel row:
 * "ม./แผ่น" and "ตร.ม./ม้วน" (coverage per piece) divide, everything else (and blank) multiplies.
 */
export function roofingOp(factorUnit: string): 'mul' | 'div' {
    const u = factorUnit.trim();
    return u === 'ม./แผ่น' || u === 'ตร.ม./ม้วน' ? 'div' : 'mul';
}

/** E of every row (same order as `input.rows`). */
export function roofingTakeoffs(input: RoofingInput): number[] {
    const k7 = slopeArea(input);
    const byKey = new Map(input.rows.map((r, i) => [r.key, i]));
    const memo = new Map<number, number>();
    const resolve = (i: number, seen: Set<number>): number => {
        const cached = memo.get(i);
        if (cached !== undefined) return cached;
        const row = input.rows[i];
        if (row === undefined) return 0;
        const t = row.takeoff;
        let v: number;
        switch (t.kind) {
            case 'slope': v = k7; break;
            case 'lengths': v = sum(t.lengths); break;
            case 'rake': v = sum(t.lengths) * perCos(t.deg); break;
            case 'row': {
                const j = byKey.get(t.ref);
                // A missing or circular reference counts as 0 (Excel would show #REF! / a circular warning).
                v = j === undefined || seen.has(j) ? 0 : resolve(j, new Set([...seen, j]));
                break;
            }
        }
        memo.set(i, v);
        return v;
    };
    return input.rows.map((_, i) => resolve(i, new Set([i])));
}

/** G ปริมาณ BOQ = ROUNDUP(E*C,0) or ROUNDUP(E/C,0). A divide by an empty factor gives 0 (Excel: #DIV/0!). */
export function roofingQty(row: RoofingRow, takeoff: number): number {
    const c = num(row.factor);
    if (roofingOp(row.factorUnit) === 'div') return c === 0 ? 0 : roundUp(takeoff / c);
    return roundUp(takeoff * c);
}

/**
 * The roof pitch K6 set to `slopeDeg` (journey page). Rake rows whose own pitch equalled the old roof pitch follow
 * the new one; a rake pitch typed differently stays. Calculation unchanged: E7 still uses the row's own pitch.
 */
export function withRoofSlope(input: RoofingInput, slopeDeg: number): RoofingInput {
    return {
        ...input,
        slopeDeg,
        rows: input.rows.map(r => (r.takeoff.kind === 'rake' && r.takeoff.deg === input.slopeDeg
            ? { ...r, takeoff: { ...r.takeoff, deg: slopeDeg } } : r)),
    };
}

const BOQ_LINES = Array.from({ length: ROOFING_BOQ_ROWS }, (_, i) => `R${162 + i}`);

export const roofing = defineCalculator<RoofingInput>({
    id: 'roofing',
    sheetName: 'มุงหลังคา_Roofing',
    title: 'โปรแกรมถอดแบบ – งานวัสดุมุงหลังคา Roofing (หลังคาซีแพค)',
    titleEn: 'Roofing (CPAC tile)',
    sections: [16],
    deps: [],
    defaults: () => sampleInput(),
    // A real project: roof size, pitch and every typed length / count empty (read off the roof plan). The 13 material
    // rows keep their items, factors and units (CPAC spec); slope-area and same-as-row links stay. The rake row's own
    // pitch starts at the roof pitch (0), so the journey page can keep it following the roof pitch.
    blank: () => blankInput(),
    compute: (input, _ctx, tr = NO_TRACE) => computeRoofing(input, tr),
    traceLabels: ROOFING_TRACE_LABELS,
    boqLinks: [
        ...BOQ_LINES.map(line => ({ line, field: 'qty' as const, output: line })),
        { line: 'R175', field: 'qty', output: 'R175' },
        { line: 'R176', field: 'qty', output: 'R176' },
    ],
    // D162…D174 = B5…B17 (the BOQ description follows the item chosen on the sheet).
    boqText: (input) => {
        // BOQ D162…D174 = sheet B5…B17 and F = H5…H17: a row left out (or with no item) shows blank, as in Excel.
        const text: Record<string, { desc: string; unit?: string }> = {};
        BOQ_LINES.forEach((line, i) => {
            const row = input.rows[i];
            const unit = row?.unit.trim() ?? '';
            text[line] = { desc: row?.item.trim() ?? '', ...(unit === '' ? {} : { unit }) };
        });
        return text;
    },
});

/** Excel v5 sample input (sheet 23 yellow cells). */
function sampleInput(): RoofingInput {
    return {
        planArea: 113,
        slopeDeg: 40,
        rows: [
            { key: 'tile', item: 'กระเบื้องหลังคาซีแพคโมเนีย', factor: 11, factorUnit: 'แผ่น/ตร.ม.', takeoff: { kind: 'slope' }, takeoffUnit: 'ตร.ม.', unit: 'แผ่น' },
            { key: 'ridge', item: 'ครอบสันโค้ง', factor: 3.3, factorUnit: 'แผ่น/ม.', takeoff: { kind: 'lengths', lengths: [2.4, 9.2, 6.6, 0.9] }, takeoffUnit: 'ม.', unit: 'แผ่น' },
            { key: 'rake', item: 'ครอบข้างจั่ว', factor: 3, factorUnit: 'แผ่น/ม.', takeoff: { kind: 'rake', lengths: [4.7, 6.45, 7.2, 5.6, 5.2, 2.35, 2.6], deg: 40 }, takeoffUnit: 'ม.', unit: 'แผ่น' },
            { key: 'wall', item: 'ครอบข้างผนัง', factor: 3, factorUnit: 'แผ่น/ม.', takeoff: { kind: 'lengths', lengths: [7.2] }, takeoffUnit: 'ม.', unit: 'แผ่น' },
            { key: 'eave-end', item: 'ครอบปิดชาย', factor: 1, factorUnit: 'แผ่น', takeoff: { kind: 'lengths', lengths: [8] }, takeoffUnit: 'จุด', unit: 'แผ่น' },
            { key: 'gable-end', item: 'ครอบปิดจั่ว', factor: 1, factorUnit: 'แผ่น', takeoff: { kind: 'lengths', lengths: [5] }, takeoffUnit: 'จุด', unit: 'แผ่น' },
            { key: 'two-way', item: 'ครอบโค้ง 2 ทาง', factor: 1, factorUnit: 'แผ่น', takeoff: { kind: 'lengths', lengths: [1] }, takeoffUnit: 'จุด', unit: 'แผ่น' },
            { key: 'drytech', item: 'ชุดครอบระบบแห้ง DRYTECH', factor: 3, factorUnit: 'ม./แผ่น', takeoff: { kind: 'row', ref: 'ridge' }, takeoffUnit: 'ม.', unit: 'แผ่น' },
            { key: 'wall-set', item: 'ชุดครอบข้างผนัง', factor: 4.8, factorUnit: 'ม./แผ่น', takeoff: { kind: 'row', ref: 'wall' }, takeoffUnit: 'ม.', unit: 'แผ่น' },
            { key: 'valley', item: 'รางน้ำตะเข้', factor: 2, factorUnit: 'ม./แผ่น', takeoff: { kind: 'lengths', lengths: [5.09, 5.09] }, takeoffUnit: 'ม.', unit: 'แผ่น' },
            { key: 'bird-stop', item: 'แผ่นปิดกันนก', factor: 0.5, factorUnit: 'ม./แผ่น', takeoff: { kind: 'lengths', lengths: [12.5, 3, 2.6, 3, 1.5] }, takeoffUnit: 'ม.', unit: 'แผ่น' },
            { key: 'fascia', item: 'ไม้เชิงชาย', factor: 4, factorUnit: 'ม./แผ่น', takeoff: { kind: 'lengths', lengths: [62.3] }, takeoffUnit: 'ม.', unit: 'แผ่น' },
            { key: 'foil', item: 'แผ่นสะท้อนความร้อน (1.25 x 60 ม./ม้วน)', factor: 75, factorUnit: 'ตร.ม./ม้วน', takeoff: { kind: 'slope' }, takeoffUnit: 'ตร.ม.', unit: 'ม้วน' },
        ],
    };
}

/** Blank project input (see `roofing.blank`). */
function blankInput(): RoofingInput {
    return {
        planArea: 0,
        slopeDeg: 0,
        rows: sampleInput().rows.map((r): RoofingRow => {
            const t = r.takeoff;
            if (t.kind === 'lengths') return { ...r, takeoff: { kind: 'lengths', lengths: [] } };
            if (t.kind === 'rake') return { ...r, takeoff: { kind: 'rake', lengths: [], deg: 0 } };
            return r;
        }),
    };
}

function computeRoofing(input: RoofingInput, tr: Tracer = NO_TRACE): Record<string, number> {
    const k7 = slopeArea(input);
    const takeoffs = roofingTakeoffs(input);
    const out: Record<string, number> = { slopeArea: k7 };
    const qtys = input.rows.map((r, i) => roofingQty(r, takeoffs[i] ?? 0));
    input.rows.forEach((_, i) => {
        out[`takeoff.${i}`] = takeoffs[i] ?? 0;
        out[`qty.${i}`] = qtys[i] ?? 0;
    });
    // BOQ E162…E174 = G5…G17 (by position).
    BOQ_LINES.forEach((line, i) => { out[line] = qtys[i] ?? 0; });
    // E175 ค่าแรงมุงหลังคา = K7; E176 ค่าแรงติดตั้งไม้เชิงชาย = E16 (fascia take-off).
    out.R175 = k7;
    // Found by the row's key, not its position: deleting or adding a row above it must not turn another take-off
    // (e.g. the foil slope area) into the fascia length. Excel's fixed row 16 is the fallback for keyless data.
    const fasciaIdx = input.rows.findIndex(r => r.key === 'fascia');
    out.R176 = takeoffs[fasciaIdx >= 0 ? fasciaIdx : FASCIA_ROW] ?? 0;
    // Named outputs for other sheets (the Paint sheet reads the fascia length).
    out.fasciaLength = out.R176;
    if (tr.enabled) traceRoofing(input, tr, k7, takeoffs, qtys, fasciaIdx >= 0 ? fasciaIdx : FASCIA_ROW, out.R176);
    return out;
}

/** Dev mode: records the steps of computeRoofing (observes the values already computed above; changes nothing). */
function traceRoofing(
    input: RoofingInput, tr: Tracer, k7: number, takeoffs: number[], qtys: number[], fasciaIdx: number, fascia: number,
): void {
    tr.step('slopeArea', k7, { planArea: num(input.planArea), slopeDeg: num(input.slopeDeg) });
    const byKey = new Map(input.rows.map((r, i) => [r.key, i]));
    input.rows.forEach((r, i) => {
        tr.row(i, r.item.trim() || `#${i + 1}`, () => {
            const t = r.takeoff;
            const e = takeoffs[i] ?? 0;
            switch (t.kind) {
                case 'slope':
                    tr.step('takeoffSlope', e, { slopeArea: k7 });
                    break;
                case 'lengths':
                    tr.step('takeoffLengths', e, { lengths: t.lengths.map(num) });
                    break;
                case 'rake': {
                    const f = perCos(t.deg);
                    tr.step('rakeFactor', f, { deg: num(t.deg) });
                    tr.step('takeoffRake', e, { lengths: t.lengths.map(num), rakeFactor: f });
                    break;
                }
                case 'row': {
                    const j = byKey.get(t.ref);
                    if (j === undefined) tr.step('takeoffRowMissing', e, {});
                    else tr.step('takeoffRow', e, { refTakeoff: takeoffs[j] ?? 0 }, { params: { ref: (input.rows[j]?.item.trim() ?? '') || `#${j + 1}` } });
                    break;
                }
            }
            const c = num(r.factor);
            if (roofingOp(r.factorUnit) === 'div') tr.step('qtyDiv', qtys[i] ?? 0, { takeoff: e, factor: c });
            else tr.step('qtyMul', qtys[i] ?? 0, { takeoff: e, factor: c });
        });
    });
    tr.step('laborSlopeArea', k7, { slopeArea: k7 });
    tr.step('fasciaLength', fascia, { fasciaTakeoff: takeoffs[fasciaIdx] ?? 0 });
}
