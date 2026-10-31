// ─── Package lines: a frozen copy of BOQ rows taken when a package is sent, and the money math on them ───
// The package never reads the live BOQ again: quantities and the estimate are copied here so a sent package, a bid
// and a contract stay exactly what both sides saw, even when the BOQ is edited or the module is switched off.
// Labour is priced on the same quantity the BOQ uses for it (L = K×E, or K×H for pipe / cable / frame rows);
// material (when the subcontractor supplies it) on the BOQ material quantity (J = I×H, or I×E).
import type { MaterialBy, SupplyMode } from '../../shared/contract/subcontracting/common';
import type { BoqItemRow, BoqResult } from '../boq/types';
import { round2 } from '../money/money';
import { tradeOfRow } from './trades';

export interface SnapshotLine {
    /** Position inside the package version (0-based, stable). */
    idx: number;
    /** BOQ line key; null for a typed (custom) line. */
    lineKey: string | null;
    section: number | null;
    sectionTitle: string;
    desc: string;
    unit: string;
    qtyNet: number;
    qtyGross: number | null;
    /** Quantity labour (or the all-in unit price) multiplies. */
    qtyPriced: number;
    /** Quantity a material unit price multiplies. */
    qtyMaterial: number;
    labourBasis: 'net' | 'gross';
    materialBy: MaterialBy;
    /** BOQ K (labour per unit). */
    estLabUnit: number;
    /** BOQ I (material per unit). */
    estMatUnit: number;
    /** Estimate of what the subcontractor's price covers. */
    estTotal: number;
}

export interface CustomLine {
    desc: string;
    unit: string;
    qty: number;
    estUnit: number;
}

export interface SnapshotInput {
    lineKeys: readonly string[];
    customLines: readonly CustomLine[];
    supplyMode: SupplyMode;
    /** supplyMode 'per_line': who supplies material per BOQ line (missing = buyer). */
    materialByLine: Readonly<Record<string, MaterialBy>>;
}

export interface Snapshot {
    lines: SnapshotLine[];
    estimateTotal: number;
}

export const CUSTOM_SECTION_TITLE = 'งานเพิ่มเติม (นอก BOQ)';

// round2 lives in the shared money library now; re-exported here under its old name for existing importers.
export { round2 };

export interface IndexedBoqRow {
    row: BoqItemRow;
    section: number;
    sectionTitle: string;
    /** BOQ order (for sorting a selection back into BOQ order). */
    order: number;
}

/** Every item row of the BOQ by key. */
export function indexBoq(boq: BoqResult): Map<string, IndexedBoqRow> {
    const map = new Map<string, IndexedBoqRow>();
    let order = 0;
    for (const s of boq.sections) {
        for (const r of s.rows) {
            if (r.type !== 'item') continue;
            map.set(r.key, { row: r, section: s.no, sectionTitle: s.title, order: order++ });
        }
    }
    return map;
}

/** Item rows a subcontractor can be hired for (not section 0), grouped by trade. */
export function subcontractableRows(boq: BoqResult): (IndexedBoqRow & { trade: NonNullable<ReturnType<typeof tradeOfRow>> })[] {
    const out: (IndexedBoqRow & { trade: NonNullable<ReturnType<typeof tradeOfRow>> })[] = [];
    for (const r of indexBoq(boq).values()) {
        const trade = tradeOfRow(r.section, r.row.excelRow);
        if (trade !== undefined) out.push({ ...r, trade });
    }
    return out;
}

function materialByOf(input: SnapshotInput, key: string | null): MaterialBy {
    if (input.supplyMode === 'labour_only') return 'buyer';
    if (input.supplyMode === 'with_materials') return 'vendor';
    return key === null ? 'buyer' : input.materialByLine[key] ?? 'buyer';
}

/** Estimate of one line: labour on qtyPriced, plus material on qtyMaterial when the vendor supplies it. */
export function estimateOf(line: Pick<SnapshotLine, 'estLabUnit' | 'estMatUnit' | 'qtyPriced' | 'qtyMaterial' | 'materialBy'>): number {
    const mat = line.materialBy === 'vendor' ? line.estMatUnit * line.qtyMaterial : 0;
    return round2(line.estLabUnit * line.qtyPriced + mat);
}

/**
 * Freezes the chosen BOQ rows (in BOQ order) and the custom lines (after them).
 * Unknown keys (a row that disappeared from the BOQ, a heading) are reported, never silently dropped.
 */
export function buildSnapshot(boq: BoqResult, input: SnapshotInput): { ok: true; snapshot: Snapshot } | { ok: false; unknownKeys: string[] } {
    const index = indexBoq(boq);
    const unknownKeys = [...new Set(input.lineKeys)].filter(k => !index.has(k));
    if (unknownKeys.length > 0) return { ok: false, unknownKeys };
    const chosen = [...new Set(input.lineKeys)].map(k => index.get(k)).filter((r): r is IndexedBoqRow => r !== undefined)
        .sort((a, b) => a.order - b.order);

    const lines: SnapshotLine[] = [];
    for (const { row, section, sectionTitle } of chosen) {
        const qtyGross = row.grossQty;
        const qtyPriced = row.labourBasis === 'gross' ? (qtyGross ?? row.qty) : row.qty;
        const qtyMaterial = row.materialBasis === 'net' ? row.qty : (qtyGross ?? row.qty);
        const base = {
            idx: lines.length, lineKey: row.key, section, sectionTitle, desc: row.desc, unit: row.unit,
            qtyNet: row.qty, qtyGross, qtyPriced, qtyMaterial, labourBasis: row.labourBasis,
            materialBy: materialByOf(input, row.key), estLabUnit: row.labUnit, estMatUnit: row.matUnit,
        };
        lines.push({ ...base, estTotal: estimateOf(base) });
    }
    for (const c of input.customLines) {
        const base = {
            idx: lines.length, lineKey: null, section: null, sectionTitle: CUSTOM_SECTION_TITLE, desc: c.desc, unit: c.unit,
            qtyNet: c.qty, qtyGross: null, qtyPriced: c.qty, qtyMaterial: c.qty, labourBasis: 'net' as const,
            materialBy: materialByOf(input, null), estLabUnit: c.estUnit, estMatUnit: 0,
        };
        lines.push({ ...base, estTotal: estimateOf(base) });
    }
    return { ok: true, snapshot: { lines, estimateTotal: round2(lines.reduce((s, l) => s + l.estTotal, 0)) } };
}

export interface LineDrift {
    idx: number;
    desc: string;
    was: number;
    now: number;
}

/**
 * BOQ lines of a snapshot whose PRICED quantity changed in the live BOQ (labour quantity, or the material quantity when
 * the vendor supplies material; a removed row counts as 0). was/now are the labour-priced quantity.
 */
export function snapshotDrift(lines: readonly SnapshotLine[], boq: BoqResult): LineDrift[] {
    const index = indexBoq(boq);
    const out: LineDrift[] = [];
    for (const l of lines) {
        if (l.lineKey === null) continue;
        const row = index.get(l.lineKey)?.row;
        const priced = row === undefined ? 0 : row.labourBasis === 'gross' ? (row.grossQty ?? row.qty) : row.qty;
        const material = row === undefined ? 0 : row.materialBasis === 'net' ? row.qty : (row.grossQty ?? row.qty);
        const changed = Math.abs(priced - l.qtyPriced) > 1e-9
            || (l.materialBy === 'vendor' && Math.abs(material - l.qtyMaterial) > 1e-9);
        if (changed) out.push({ idx: l.idx, desc: l.desc, was: l.qtyPriced, now: priced });
    }
    return out;
}

/** Indexes of lines that differ between two versions (by line key, else by position): for "what changed" in an addendum. */
export function changedLines(previous: readonly SnapshotLine[], next: readonly SnapshotLine[]): number[] {
    const prevByKey = new Map(previous.filter(l => l.lineKey !== null).map(l => [l.lineKey, l]));
    return next.filter(l => {
        const before = l.lineKey !== null ? prevByKey.get(l.lineKey)
            : previous.find(p => p.lineKey === null && p.desc === l.desc && p.unit === l.unit);
        return before?.qtyPriced !== l.qtyPriced || before.qtyMaterial !== l.qtyMaterial
            || before.materialBy !== l.materialBy;
    }).map(l => l.idx);
}

/** Total of one priced line: unitPrice × qtyPriced (+ matUnitPrice × qtyMaterial when the vendor supplies material). */
export function priceLine(line: Pick<SnapshotLine, 'qtyPriced' | 'qtyMaterial' | 'materialBy'>, unitPrice: number | null, matUnitPrice: number | null): number {
    const lab = (unitPrice ?? 0) * line.qtyPriced;
    const mat = line.materialBy === 'vendor' ? (matUnitPrice ?? 0) * line.qtyMaterial : 0;
    return round2(lab + mat);
}
