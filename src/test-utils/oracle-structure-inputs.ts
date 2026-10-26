// Excel input mapping and random input sets of the structural sheets 25–30 (footing, pedestal, ground beam,
// slab on grade, precast slab, column) for the oracle tests — TEST ONLY. See docs/rebuild/ORACLE_TESTS.md.
// Shared by each sheet's own oracle test and by the structure-summary (sheet 24) oracle test.
import type { RebarSize } from '../domain/boq/slots';
import type { ColumnInput, ColumnRow } from '../domain/calculators/column';
import type { FootingInput, FootingRow } from '../domain/calculators/footing';
import type { GroundBeamInput, GroundBeamRow } from '../domain/calculators/ground-beam';
import type { PedestalInput, PedestalRow } from '../domain/calculators/pedestal';
import type { PrecastPanelRow, PrecastSlabInput } from '../domain/calculators/precast-slab';
import type { SlabOnGradeInput, SlabRow } from '../domain/calculators/slab-on-grade';
import type { OracleInput } from './excel-oracle';
import { excelRoundUp } from './oracle-boq-checks';
import { seededRandom, type Random } from './oracle-helpers';

export const SHEETS = {
    summary: 'ตารางสรุปวัสดุงานโครงสร้าง',
    footing: 'ฐานราก_Footing',
    pedestal: 'เสาตอม่อ_Footing Column',
    groundBeam: 'คานคอดิน_Beam',
    slab: 'พื้นหล่อในที่_S',
    precast: ' พื้นสำเร็จรูป_PS',   // leading space (verbatim)
    column: 'เสา_Column',
} as const;

/** Excel's SWITCH table (kg/m), typed here so documented deltas are computed independently of the app. */
const EXCEL_KG_PER_M: Readonly<Record<string, number>> = { RB6: 0.222, RB9: 0.499, DB12: 0.888, DB16: 1.58, DB20: 2.47 };
export const excelKgPerM = (size: string): number => EXCEL_KG_PER_M[size] ?? 0;

// ─── Tables: field → yellow input column, Excel rows first … first + rows − 1 ─────
export interface TableSpec<R> {
    sheet: string;
    first: number;
    rows: number;
    columns: readonly (readonly [keyof R & string, string])[];
}

export const FOOTING_TABLE: TableSpec<FootingRow> = {
    sheet: SHEETS.footing, first: 8, rows: 11,
    columns: [
        ['name', 'B'], ['count', 'C'], ['width', 'D'], ['length', 'E'], ['depth', 'F'], ['excavationDepth', 'H'],
        ['sandThickness', 'J'], ['leanThickness', 'L'], ['shortBarSize', 'O'], ['shortBarCount', 'P'],
        ['longBarSize', 'T'], ['longBarCount', 'U'], ['ringBarSize', 'Y'], ['ringBarCount', 'Z'],
    ],
};

export const PEDESTAL_TABLE: TableSpec<PedestalRow> = {
    sheet: SHEETS.pedestal, first: 8, rows: 10,
    columns: [
        ['name', 'B'], ['count', 'C'], ['width', 'D'], ['length', 'E'], ['height', 'F'],
        ['mainBarSize', 'H'], ['mainBarCount', 'I'], ['stirrupSize', 'M'], ['stirrupSpacing', 'N'],
    ],
};

export const GROUND_BEAM_TABLE: TableSpec<GroundBeamRow> = {
    sheet: SHEETS.groundBeam, first: 8, rows: 14,
    columns: [
        ['name', 'B'], ['width', 'C'], ['depth', 'D'], ['length', 'E'], ['leanThickness', 'G'],
        ['mainSize', 'J'], ['mainCount', 'K'], ['stirrupSize', 'O'], ['stirrupSpacing', 'P'],
    ],
};

export const SLAB_TABLE: TableSpec<SlabRow> = {
    sheet: SHEETS.slab, first: 8, rows: 17,
    columns: [
        ['name', 'B'], ['width', 'C'], ['length', 'D'], ['thickness', 'E'], ['fillDepth', 'G'],
        ['sandThickness', 'I'], ['barSize', 'M'], ['layers', 'N'], ['spacing', 'O'],
    ],
};

export const PRECAST_TABLE: TableSpec<PrecastPanelRow> = {
    sheet: SHEETS.precast, first: 8, rows: 17,
    columns: [['width', 'B'], ['length', 'C'], ['keySize', 'H'], ['keySpacing', 'I'], ['keyBarLength', 'J'], ['topping', 'R']],
};
/** PS column M (shear-key kg) has its formula on rows 8–21 only; M22:M24 are empty (see precast-slab.oracle.test.ts). */
export const PRECAST_KEY_WEIGHT_ROWS = 14;

export const COLUMN_TABLE: TableSpec<ColumnRow> = {
    sheet: SHEETS.column, first: 8, rows: 10,
    columns: [
        ['name', 'B'], ['count', 'C'], ['width', 'D'], ['depth', 'E'], ['height', 'F'],
        ['mainSize', 'H'], ['mainCount', 'I'], ['stirrupSize', 'M'], ['stirrupSpacing', 'N'],
    ],
};

/** `Sheet!<col><row>` of table row i (0-based). */
export const tableRef = <R>(spec: TableSpec<R>, col: string, i: number): string => `${spec.sheet}!${col}${spec.first + i}`;

/**
 * The cells a user types in Excel: row i of `rows` goes to table row `at(i)` (default i); every other table row is
 * cleared, so a previous case cannot leak into the next one. Throws when Excel has no room.
 */
export function tableInputs<R>(spec: TableSpec<R>, rows: readonly R[], at: (i: number) => number = i => i): Record<string, OracleInput> {
    const out: Record<string, OracleInput> = {};
    for (let i = 0; i < spec.rows; i++) for (const [, col] of spec.columns) out[tableRef(spec, col, i)] = null;
    rows.forEach((row, i) => {
        const t = at(i);
        if (t < 0 || t >= spec.rows) throw new Error(`${spec.sheet}: Excel has ${spec.rows} table rows (row ${t} asked)`);
        for (const [field, col] of spec.columns) {
            const v: unknown = row[field];
            out[tableRef(spec, col, t)] = (typeof v === 'number' || typeof v === 'string') && v !== '' ? v : null;
        }
    });
    return out;
}

export const footingExcelInputs = (input: FootingInput) => tableInputs(FOOTING_TABLE, input.rows);
export const groundBeamExcelInputs = (input: GroundBeamInput) => tableInputs(GROUND_BEAM_TABLE, input.beams);
export const slabExcelInputs = (input: SlabOnGradeInput) => tableInputs(SLAB_TABLE, input.slabs);
export const precastExcelInputs = (input: PrecastSlabInput) => tableInputs(PRECAST_TABLE, input.panels);
export const columnExcelInputs = (input: ColumnInput) => tableInputs(COLUMN_TABLE, input.columns);

// ─── Pedestal ↔ footing row pairing ─────────────────────────────────────────
/**
 * Excel table row (0-based) of each pedestal. Excel pairs pedestal row n with footing row n (bar length J, backfill
 * AI); the app lets a pedestal pick its footing type (D13). So a pedestal on footing f goes to Excel row f, and a
 * pedestal with no footing (−1) to a free row whose footing row is empty (≥ the footing count). Two pedestals on one
 * footing type have no Excel layout (throws).
 */
export function pedestalLayout(input: PedestalInput, footingRows: number): number[] {
    const used = new Set<number>();
    const fixed = input.rows.map(r => {
        if (r.footing < 0) return undefined;
        if (used.has(r.footing)) throw new Error('two pedestals on one footing type: no Excel layout (Excel pairs row n with footing row n)');
        used.add(r.footing);
        return r.footing;
    });
    return fixed.map(f => {
        if (f !== undefined) return f;
        for (let j = footingRows; j < PEDESTAL_TABLE.rows; j++) {
            if (!used.has(j)) { used.add(j); return j; }
        }
        throw new Error('no free Excel pedestal row with an empty footing row');
    });
}

export function pedestalExcelInputs(input: PedestalInput, footingRows: number): Record<string, OracleInput> {
    const layout = pedestalLayout(input, footingRows);
    return tableInputs(PEDESTAL_TABLE, input.rows, i => layout[i] ?? -1);
}

/**
 * Stirrup count O of a pedestal: Excel `ROUNDUP((Footing!$F$8 + F)/N, 0)` reads footing ROW 1's thickness for every
 * pedestal; the app uses the pedestal's own footing (D1, pedestal/index.ts). null where Excel shows "-".
 */
export function pedestalStirrupCounts(footing: FootingInput, r: PedestalRow): { app: number | null; excel: number | null } {
    if (!(r.stirrupSpacing > 0)) return { app: null, excel: null };
    const f8 = footing.rows[0]?.depth ?? 0;
    const own = r.footing >= 0 ? (footing.rows[r.footing]?.depth ?? 0) : 0;
    return { app: excelRoundUp((own + r.height) / r.stirrupSpacing), excel: excelRoundUp((f8 + r.height) / r.stirrupSpacing) };
}

/** D1 above in kg, per stirrup size: app − Excel = C · (O_app − O_excel) · 2(D+E) · kg/m. */
export function pedestalStirrupKgDelta(footing: FootingInput, pedestal: PedestalInput): Partial<Record<RebarSize, number>> {
    const out: Partial<Record<RebarSize, number>> = {};
    for (const r of pedestal.rows) {
        const c = pedestalStirrupCounts(footing, r);
        if (c.app === null || c.excel === null || c.app === c.excel) continue;
        const d = r.count * (c.app - c.excel) * 2 * (r.width + r.length) * excelKgPerM(r.stirrupSize);
        if (d !== 0) out[r.stirrupSize as RebarSize] = (out[r.stirrupSize as RebarSize] ?? 0) + d;
    }
    return out;
}

/**
 * Ground beam D1 (ground-beam/index.ts): Excel G6 = SUM(H8:H18) and V6/X6 = SUM(V8:V17)/SUM(X8:X17) although the
 * table runs to row 21; the app sums every row. app − Excel = the rows Excel leaves out.
 */
export function groundBeamShortRangeDelta(input: GroundBeamInput): { lean: number; formwork: number; concrete: number } {
    let lean = 0, formwork = 0, concrete = 0;
    input.beams.forEach((b, i) => {
        if (i >= 11) lean += b.width * b.length * b.leanThickness;      // rows 19–21
        if (i >= 10) {                                                   // rows 18–21
            formwork += 2 * b.depth * b.length;
            concrete += b.width * b.depth * b.length;
        }
    });
    return { lean, formwork, concrete };
}

// ─── Random but plausible schedules (plan dimensions on a 0.05 m grid) ──────
const pickBar = (rng: Random, usual: string, p: number, others: readonly string[]) => (rng.chance(p) ? usual : rng.pick(others));

export function randomFootingRow(rng: Random, i: number, opts: { sampleBars?: boolean; depth?: number } = {}): FootingRow {
    const bar = () => (opts.sampleBars ? 'DB12' : pickBar(rng, 'DB12', 0.75, ['DB16', 'DB20', 'RB9']));
    return {
        name: ['F1', 'F2', 'F4'][i] ?? '',
        count: rng.int(1, 30),
        width: rng.step(0.5, 2.5, 0.05),
        length: rng.step(0.5, 2.5, 0.05),
        depth: opts.depth ?? rng.step(0.25, 0.8, 0.05),
        excavationDepth: rng.step(0.8, 2.0, 0.05),
        sandThickness: rng.pick([0.05, 0.05, 0.1, 0]),
        leanThickness: rng.pick([0.05, 0.05, 0.1]),
        shortBarSize: bar(), shortBarCount: rng.int(3, 12),
        longBarSize: bar(), longBarCount: rng.int(3, 12),
        ringBarSize: opts.sampleBars || rng.chance(0.8) ? 'RB9' : rng.pick(['RB6', 'DB12']), ringBarCount: rng.int(1, 4),
    };
}

export function randomPedestalRow(rng: Random, footing: number, count?: number): PedestalRow {
    return {
        name: rng.pick(['C1', 'C2', 'C3']),
        footing,
        count: count ?? rng.int(1, 30),
        width: rng.step(0.15, 0.4, 0.05),
        length: rng.step(0.15, 0.4, 0.05),
        height: rng.step(0.3, 1.5, 0.05),
        mainBarSize: pickBar(rng, 'DB12', 0.7, ['DB16', 'RB9', 'DB20']),
        mainBarCount: rng.int(4, 8),
        stirrupSize: pickBar(rng, 'RB6', 0.75, ['RB9', 'DB12']),
        stirrupSpacing: rng.pick([0.15, 0.15, 0.1, 0.2, 0.25, 0]),
    };
}

/**
 * A footing schedule and the pedestals on it. Each pedestal gets its own Excel row j (identity or shuffled); it sits
 * on footing j (D13: the default is the same row; shuffled = another footing type), on a footing row that does not
 * exist (j ≥ footing count — a stale index), or on none (−1). Footing thicknesses are often all equal, so Excel's
 * $F$8 stirrup count (D1) usually matches.
 */
export function randomFootingPedestal(seed: number): { footing: FootingInput; pedestal: PedestalInput } {
    const rng = seededRandom(seed);
    const nf = rng.chance(0.06) ? FOOTING_TABLE.rows : rng.pick([0, 1, 1, 2, 2, 3, 4]);
    const sameDepth = rng.chance(0.6) ? rng.step(0.3, 0.8, 0.05) : undefined;
    const footing: FootingInput = {
        rows: Array.from({ length: nf }, (_, i) => randomFootingRow(rng, i, { sampleBars: rng.chance(0.6), depth: sameDepth })),
    };
    const np = rng.chance(0.08) ? PEDESTAL_TABLE.rows : rng.pick([0, 1, 1, 2, 2, 3, 4]);
    const slots = Array.from({ length: PEDESTAL_TABLE.rows }, (_, j) => j);
    if (rng.chance(0.3)) {
        for (let j = slots.length - 1; j > 0; j--) {
            const k = rng.int(0, j);
            [slots[j], slots[k]] = [slots[k] ?? 0, slots[j] ?? 0];
        }
    }
    const pedestal: PedestalInput = {
        rows: slots.slice(0, np).map(j => {
            const on = j < nf || rng.chance(0.5) ? j : -1;
            return randomPedestalRow(rng, on, j < nf && rng.chance(0.5) ? footing.rows[j]?.count : undefined);
        }),
    };
    return { footing, pedestal };
}

export function randomGroundBeamRow(rng: Random, i: number): GroundBeamRow {
    return {
        name: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'][i % 6] ?? 'B1',
        width: rng.pick([0.15, 0.2, 0.2, 0.25, 0.3]),
        depth: rng.step(0.3, 0.6, 0.05),
        length: rng.step(1, 40, 0.1),
        leanThickness: rng.pick([0.05, 0.05, 0.1, 0]),
        mainSize: pickBar(rng, 'DB12', 0.65, ['DB16', 'RB9', 'DB20', 'RB6']),
        mainCount: rng.int(4, 10),
        stirrupSize: pickBar(rng, 'RB6', 0.75, ['RB9', 'DB12']),
        stirrupSpacing: rng.pick([0.15, 0.15, 0.2, 0.1, 0.25, 0]),
    };
}

export function randomGroundBeamInput(seed: number): GroundBeamInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.15) ? rng.int(11, GROUND_BEAM_TABLE.rows) : rng.pick([1, 2, 3, 4, 4, 6]);
    return { beams: Array.from({ length: n }, (_, i) => randomGroundBeamRow(rng, i)) };
}

export function randomSlabRow(rng: Random): SlabRow {
    return {
        name: rng.pick(['S1', 'S2']),
        width: rng.step(0.5, 4, 0.05),
        length: rng.step(0.5, 7, 0.05),
        thickness: rng.pick([0.1, 0.1, 0.12, 0.15]),
        fillDepth: rng.step(0, 0.6, 0.05),
        sandThickness: rng.pick([0.05, 0.05, 0.1, 0]),
        barSize: pickBar(rng, 'RB9', 0.75, ['RB6', 'DB12', 'DB16']),
        layers: rng.pick([1, 2, 2]),
        spacing: rng.pick([0.2, 0.2, 0.15, 0.25, 0.3, 0]),
    };
}

export function randomSlabInput(seed: number): SlabOnGradeInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.08) ? SLAB_TABLE.rows : rng.pick([1, 2, 3, 5, 8, 10]);
    return { slabs: Array.from({ length: n }, () => randomSlabRow(rng)) };
}

export function randomPrecastPanel(rng: Random): PrecastPanelRow {
    return {
        width: rng.step(1, 4, 0.05),
        length: rng.step(1, 5, 0.05),
        keySize: pickBar(rng, 'RB6', 0.8, ['RB9', 'DB12']),
        keySpacing: rng.pick([0.35, 0.35, 0.3, 0.4, 0]),
        keyBarLength: rng.pick([0.8, 0.8, 0.6, 1.0]),
        topping: rng.pick([0.05, 0.05, 0.04, 0.06]),
    };
}

/** At most 14 panels: Excel's shear-key weight formula stops at row 21 (see PRECAST_KEY_WEIGHT_ROWS). */
export function randomPrecastInput(seed: number): PrecastSlabInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.08) ? PRECAST_KEY_WEIGHT_ROWS : rng.pick([1, 2, 4, 6, 9]);
    return { panels: Array.from({ length: n }, () => randomPrecastPanel(rng)) };
}

export function randomColumnRow(rng: Random): ColumnRow {
    return {
        name: rng.pick(['C1', 'C2', 'C3']),
        count: rng.int(1, 30),
        width: rng.step(0.15, 0.4, 0.05),
        depth: rng.step(0.15, 0.4, 0.05),
        height: rng.chance(0.2) ? 0.55 + 3.5 : rng.step(2.5, 4.5, 0.05),
        mainSize: pickBar(rng, 'DB12', 0.65, ['DB16', 'RB9', 'DB20']),
        mainCount: rng.int(4, 12),
        stirrupSize: pickBar(rng, 'RB6', 0.75, ['RB9', 'DB12']),
        stirrupSpacing: rng.pick([0.15, 0.15, 0.2, 0.1, 0.25, 0]),
    };
}

export function randomColumnInput(seed: number): ColumnInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.08) ? COLUMN_TABLE.rows : rng.pick([1, 1, 2, 3, 4]);
    return { columns: Array.from({ length: n }, () => randomColumnRow(rng)) };
}
