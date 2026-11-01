// ─── Pure view model of the overview page: trade rows in a useful order, status meta ───
import type { ProcurementOverviewDto } from '@/shared/contract';
import { scText, type ScT } from './text';

export type TradeRowStatus = ProcurementOverviewDto['trades'][number]['status'];
/**
 * One trade row. The server's `estimate` is the whole-trade BOQ estimate while nothing is contracted, and the estimate
 * of the CONTRACTED SCOPE once the trade has live subcontracts (backend overview.use-case.ts), so `diffPct` compares
 * like with like (a trade with half its rows contracted does not show −55 %). `scopeEstimate` marks the second case.
 */
export type TradeRowView = ProcurementOverviewDto['trades'][number] & { diffPct: number | null; scopeEstimate: boolean };

/** Colour means state: grey not sourced, amber waiting, green contracted, red problem. */
const TRADE_STATUS_COLOR: Record<TradeRowStatus, string> = {
    not_sourced: 'default',
    waiting_bids: 'warning',
    has_bids: 'warning',
    contracted: 'success',
    problem: 'error',
};

/** Label (in the UI language) and tag colour of a trade row status. */
export function tradeStatusMeta(status: TradeRowStatus, t: ScT = scText()): { label: string; color: string } {
    return { label: t(`buyer.labels.tradeStatus.${status}`), color: TRADE_STATUS_COLOR[status] };
}

/** Problems first, then work in progress, then contracted, then not sourced; rows without BOQ value and no activity are dropped. */
const ORDER: Record<TradeRowStatus, number> = { problem: 0, has_bids: 1, waiting_bids: 2, contracted: 3, not_sourced: 4 };

export function tradeRowsView(data: ProcurementOverviewDto): TradeRowView[] {
    return data.trades
        .filter(t => t.estimate > 0 || t.status !== 'not_sourced' || t.packages.length > 0)
        .map((t, i) => ({ t, i }))
        .sort((a, b) => ORDER[a.t.status] - ORDER[b.t.status] || a.i - b.i)
        .map(({ t }) => ({
            ...t,
            diffPct: t.contracted > 0 && t.estimate > 0 ? (t.contracted - t.estimate) / t.estimate : null,
            scopeEstimate: t.contracted > 0,
        }));
}
