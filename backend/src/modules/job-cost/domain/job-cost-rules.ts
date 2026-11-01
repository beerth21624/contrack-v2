// ─── Job cost rules (docs/erp/02-domain-model.md §9): cost lines of a project, the alerts they raise ───
// Pure: cost codes + ledger totals + forecasts → per-code status (src/domain/job-cost), sections, overhead; the alerts
// wanted for that state (cost_overrun, commitment_over_budget, margin_drop).
import {
    JOB_COST_MARGIN_DROP_TOLERANCE, type JobCostAlertKind, type JobCostAlertLevel, type JobCostForecastMethod,
} from '@contrack/contract';
import { type CostStatus, costLevel, costStatus, sumCostStatus } from '@contrack/domain/job-cost/cost-status';
import { round2, sumMoney } from '@contrack/domain/money';
import type { CostCode, CostLedgerTotals } from '../../../shared/application/ports';

/** Alerts this module raises from cost figures (`negative_cash` belongs to the cash sweep, WP-47). */
export const COST_ALERT_KINDS: readonly JobCostAlertKind[] = ['cost_overrun', 'commitment_over_budget', 'margin_drop'];

export const PROJECT_SCOPE = 'project';

/** Half a satang. */
const EPSILON = 0.005;

export interface ForecastFigures {
    method: JobCostForecastMethod;
    eac: number;
    note: string;
    updatedAt: Date;
}

export interface CostLine {
    costCode: CostCode;
    status: CostStatus;
    forecast: ForecastFigures | undefined;
}

export interface CostSection {
    sectionNo: number;
    status: CostStatus;
    lineCount: number;
}

export interface ProjectCost {
    lines: CostLine[];
    sections: CostSection[];
    /** Σ of the cost code lines. */
    totals: CostStatus;
    /** Ledger rows without a cost code (or of a cost code no longer listed). */
    unassigned: { committedOpen: number; actual: number };
    /** Σ EAC + unassigned (actual + committedOpen): the cost side of the projected profit. */
    forecastCost: number;
    /** committedOpen / actual of the whole project (unassigned included). */
    committedOpen: number;
    actual: number;
}

const ZERO: Pick<CostLedgerTotals, 'committedOpen' | 'actual'> = { committedOpen: 0, actual: 0 };

/**
 * `progressOf` picks reported (site-diary active) or certified progress. Omitted cost codes are listed only when they
 * still have a budget or ledger rows.
 */
export function projectCost(
    costCodes: readonly CostCode[],
    ledger: ReadonlyMap<string | null, Pick<CostLedgerTotals, 'committedOpen' | 'actual'>>,
    forecasts: ReadonlyMap<string, ForecastFigures>,
    useReported: boolean,
): ProjectCost {
    const lines: CostLine[] = [];
    const listed = new Set<string>();
    for (const c of costCodes) {
        const totals = ledger.get(c.id);
        if (c.status === 'omitted' && round2(c.budgetTotal) === 0 && totals === undefined) continue;
        listed.add(c.id);
        const forecast = forecasts.get(c.id);
        const status = costStatus(
            { budget: c.budgetTotal, progress: useReported ? c.reportedProgress : c.certifiedProgress },
            totals ?? ZERO,
            forecast?.method === 'manual' ? { method: 'manual', eac: forecast.eac } : null,
        );
        lines.push({ costCode: c, status, forecast });
    }
    const bySection = new Map<number, CostLine[]>();
    for (const l of lines) bySection.set(l.costCode.sectionNo, [...(bySection.get(l.costCode.sectionNo) ?? []), l]);
    const sections = [...bySection].sort((a, b) => a[0] - b[0])
        .map(([sectionNo, ls]) => ({ sectionNo, status: sumCostStatus(ls.map(l => l.status)), lineCount: ls.length }));
    const unassignedRows = [...ledger].filter(([id]) => id === null || !listed.has(id)).map(([, t]) => t);
    const unassigned = {
        committedOpen: sumMoney(unassignedRows.map(t => t.committedOpen)),
        actual: sumMoney(unassignedRows.map(t => t.actual)),
    };
    const totals = sumCostStatus(lines.map(l => l.status));
    return {
        lines,
        sections,
        totals,
        unassigned,
        forecastCost: round2(totals.eac + unassigned.actual + unassigned.committedOpen),
        committedOpen: round2(totals.committedOpen + unassigned.committedOpen),
        actual: round2(totals.actual + unassigned.actual),
    };
}

export interface WantedAlert {
    scopeKey: string;
    costCodeId: string | null;
    kind: JobCostAlertKind;
    level: JobCostAlertLevel;
    value: number;
    threshold: number;
    /** What the notification shows: baht over budget / profit short of the quoted margin. */
    amount: number;
}

export interface MarginFigures {
    revenue: number;
    marginPct: number;
    quotedMarginPct: number;
}

/** The alerts the project's cost state calls for (one per scope and kind). */
export function wantedAlerts(cost: ProjectCost, margin: MarginFigures | null): WantedAlert[] {
    const out: WantedAlert[] = [];
    for (const { costCode: c, status: s } of cost.lines) {
        if (s.level !== 'ok') {
            out.push({
                scopeKey: c.id, costCodeId: c.id, kind: 'cost_overrun', level: s.level, value: s.eac, threshold: s.budget,
                amount: round2(s.eac - s.budget),
            });
        }
        const spent = round2(s.committedOpen + s.actual);
        if (spent - s.budget > EPSILON) {
            const level = costLevel(s.budget, spent);
            out.push({
                scopeKey: c.id, costCodeId: c.id, kind: 'commitment_over_budget', level: level === 'critical' ? 'critical' : 'warning',
                value: spent, threshold: s.budget, amount: round2(spent - s.budget),
            });
        }
    }
    if (margin !== null && margin.revenue > 0) {
        const threshold = Math.round((margin.quotedMarginPct - JOB_COST_MARGIN_DROP_TOLERANCE) * 1e6) / 1e6;
        if (margin.marginPct < threshold) {
            out.push({
                scopeKey: PROJECT_SCOPE, costCodeId: null, kind: 'margin_drop', level: margin.marginPct < 0 ? 'critical' : 'warning',
                value: margin.marginPct, threshold, amount: round2((margin.quotedMarginPct - margin.marginPct) * margin.revenue),
            });
        }
    }
    return out;
}

export const alertKey = (scopeKey: string, kind: JobCostAlertKind): string => `${scopeKey}|${kind}`;
