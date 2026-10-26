// ─── BOQ estimate per trade (overview §4.1 and report §4.8), from the live BOQ of the project ───
// Labour of every subcontractable row (BOQ L); material (BOQ J) is counted too for rows that a package has the vendor
// supply (material by vendor), since the subcontract price then covers it.
import type { TradeId } from '@contrack/contract';
import type { BoqResult } from '@contrack/domain/boq/types';
import { round2, subcontractableRows } from '@contrack/domain/subcontracting/snapshot';
import type { PackageView } from '../../shared/ports';
import type { Subcontract } from '../domain/entities/subcontract.entity';

export interface TradeEstimate {
    /** Estimate of every row of the trade. */
    byTrade: Map<TradeId, number>;
    total: number;
    /** Estimate of the rows inside live subcontracts. */
    covered: number;
}

/** BOQ line keys that some (not cancelled) package has the vendor supply material for. */
export function vendorMaterialKeys(packages: readonly PackageView[]): Set<string> {
    const keys = new Set<string>();
    for (const p of packages) {
        if (p.status === 'cancelled') continue;
        for (const l of p.lines) if (l.lineKey !== null && l.materialBy === 'vendor') keys.add(l.lineKey);
    }
    return keys;
}

export function tradeEstimates(boq: BoqResult, packages: readonly PackageView[], live: readonly Subcontract[]): TradeEstimate {
    const vendorMaterial = vendorMaterialKeys(packages);
    const coveredKeys = new Set(live.flatMap(s => s.state.lines.map(l => l.lineKey)).filter((k): k is string => k !== null));
    const byTrade = new Map<TradeId, number>();
    let total = 0;
    let covered = 0;
    for (const r of subcontractableRows(boq)) {
        const estimate = r.row.labTotal + (vendorMaterial.has(r.row.key) ? r.row.matTotal : 0);
        byTrade.set(r.trade, (byTrade.get(r.trade) ?? 0) + estimate);
        total += estimate;
        if (coveredKeys.has(r.row.key)) covered += estimate;
    }
    for (const [k, v] of byTrade) byTrade.set(k, round2(v));
    return { byTrade, total: round2(total), covered: round2(covered) };
}
