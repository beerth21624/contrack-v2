// QA edge tests for Cash Flow + EVM: installments, cash-in/out, opex, quotation, PV/EV/AC, SPI/CPI.
import { describe, expect, it } from 'vitest';
import type { BoqItemRow, BoqResult, BoqSectionResult } from '../../boq/types';
import { computePlanning, defaultPlanningInput, PLAN_TASKS, type CashFlowInput, type PlanningInput, type PlanningResult } from '../index';

/** Sections 1..31 with the same total (300,000 in all over the 30 planned sections 2..31). */
function fakeBoq(total = 10000, lab = 4000): BoqResult {
    const itemRow = (excelRow: number, l: number, t: number): BoqItemRow => ({
        type: 'item', key: `R${excelRow}`, excelRow, labTotal: l, matTotal: t - l, total: t,
    } as BoqItemRow);
    const sections: BoqSectionResult[] = Array.from({ length: 32 }, (_, no) => {
        const rows = no === 17 ? [itemRow(180, lab * 0.7, total * 0.7), itemRow(185, lab * 0.3, total * 0.3)]
            : no === 18 ? [itemRow(190, lab * 0.6, total * 0.6), itemRow(195, lab * 0.4, total * 0.4)] : [];
        const t = no === 1 ? 0 : total;
        return { no, title: `s${no}`, calculators: [], inConstructionTotal: no !== 0, rows, matTotal: t - lab, labTotal: lab, total: t };
    });
    return { sections, constructionTotal: sections.filter(s => s.no !== 0).reduce((a, s) => a + s.total, 0), preConstructionTotal: total };
}

function run(edit: (i: PlanningInput) => void = () => undefined, boq = fakeBoq()): PlanningResult {
    const i = defaultPlanningInput();
    edit(i);
    return computePlanning(i, boq);
}
const cf = (e: (c: CashFlowInput) => void = () => undefined, boq = fakeBoq()) => run(i => e(i.cashflow), boq).cashflow;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const allProgress = (c: CashFlowInput, p: number) => { for (const t of PLAN_TASKS) c.progress[t.id] = p; };
function badNumber(v: unknown, path = ''): string | null {
    if (typeof v === 'number') return Number.isFinite(v) ? null : `${path}=${v}`;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const b = badNumber(v[i], `${path}[${i}]`); if (b) return b; } }
    else if (typeof v === 'object' && v !== null) { for (const [k, x] of Object.entries(v)) { const b = badNumber(x, `${path}.${k}`); if (b) return b; } }
    return null;
}

describe('quotation and installments', () => {
    it('quotation = construction cost x 1.3 and follows the factor (D18)', () => {
        const c = cf();
        expect(c.cost).toBe(300000);
        expect(c.quotation).toBeCloseTo(390000, 6);
        expect(cf(x => { x.quotationFactor = 1; }).quotation).toBe(300000);
        expect(cf(x => { x.quotationFactor = 0; }).quotation).toBe(0);
        expect(cf(x => { x.quotationFactor = Number.NaN; }).quotation).toBe(0);
    });

    it('sample installments are 20 % + 8 x 10 % = 100 % and the cash-in equals the quotation', () => {
        const c = cf();
        expect(c.installmentPctTotal).toBeCloseTo(1, 12);
        expect(c.installments).toHaveLength(9);
        expect(c.installments[0]?.no).toBe(0);
        expect(c.installments[0]?.amount).toBeCloseTo(78000, 6);
        expect(c.totalIncome).toBeCloseTo(c.quotation, 6);
        expect(sum(c.installments.map(i => i.amount))).toBeCloseTo(c.quotation, 6);
    });

    it('each installment lands in exactly its bucket', () => {
        const c = cf();
        for (const inst of c.installments) {
            if (inst.bucket === null) continue;
            expect(inst.weekly[inst.bucket]).toBeCloseTo(inst.amount, 6);
            expect(sum(inst.weekly)).toBeCloseTo(inst.amount, 6);
        }
    });

    it('two installments in the same week add up (week with 2 payments)', () => {
        const c = cf(x => { x.installments = [{ label: 'a', pct: 0.5, bucket: 3 }, { label: 'b', pct: 0.5, bucket: 3 }]; });
        expect(c.incomeWeekly[3]).toBeCloseTo(c.quotation, 6);
        expect(c.totalIncome).toBeCloseTo(c.quotation, 6);
    });

    it('percentages not adding to 100 % show in installmentPctTotal and in the income', () => {
        const c = cf(x => { x.installments = [{ label: 'a', pct: 0.3, bucket: 0 }, { label: 'b', pct: 0.3, bucket: 1 }]; });
        expect(c.installmentPctTotal).toBeCloseTo(0.6, 12);
        expect(c.totalIncome).toBeCloseTo(c.quotation * 0.6, 6);
    });

    it('the last installment (row 14) is included in the weekly cash-in (D1)', () => {
        const c = cf();
        const last = c.installments[8];
        expect(last?.amount).toBeGreaterThan(0);
        expect(c.incomeWeekly[last?.bucket ?? 0]).toBeGreaterThanOrEqual(last?.amount ?? Infinity);
    });

    it('a bucket beyond the axis grows the axis so the money is not lost', () => {
        const c = cf(x => { x.installments = [{ label: 'late', pct: 1, bucket: 100 }]; });
        expect(c.buckets.length).toBeGreaterThan(100);
        expect(c.incomeWeekly[100]).toBeCloseTo(c.quotation, 6);
    });

    it('null, negative, fractional or NaN buckets place nothing (but never throw or NaN)', () => {
        for (const bucket of [null, -1, 2.5, Number.NaN]) {
            const c = cf(x => { x.installments = [{ label: 'x', pct: 1, bucket }]; });
            expect(c.totalIncome, String(bucket)).toBe(0);
            expect(badNumber([c.incomeWeekly, c.cumulative, c.evm])).toBeNull();
        }
    });

    it('an empty installment list gives no income', () => {
        const c = cf(x => { x.installments = []; });
        expect(c.totalIncome).toBe(0);
        expect(c.installmentPctTotal).toBe(0);
    });
});

describe('cash-out, opex 15 % and profit', () => {
    it('outflow total = cost x (1 + opex 15 %)', () => {
        const c = cf();
        expect(c.totalOutflow).toBeCloseTo(300000 * 1.15, 6);
        expect(sum(c.costWeekly)).toBeCloseTo(300000, 6);
        expect(sum(c.opexWeekly)).toBeCloseTo(45000, 6);
    });

    it('each week: opex = 15 % of cost, outflow = cost + opex, profit = 15 % of cost', () => {
        const c = cf();
        c.costWeekly.forEach((cost, k) => {
            expect(c.opexWeekly[k]).toBeCloseTo(cost * 0.15, 9);
            expect(c.outflowWeekly[k]).toBeCloseTo(cost * 1.15, 9);
            expect(c.profitWeekly[k]).toBeCloseTo(cost * 0.15, 9);
        });
    });

    it('opex and profit rates are configurable, 0 gives no opex / profit', () => {
        const c = cf(x => { x.operatingCostRate = 0; x.profitRate = 0; });
        expect(c.totalOutflow).toBeCloseTo(300000, 6);
        expect(c.evm.profitPlan).toBe(0);
        expect(c.evm.bac).toBe(300000);
    });

    it('net per week = income - outflow; cumulative ends at income - outflow; min cumulative is the real minimum', () => {
        const c = cf();
        c.netWeekly.forEach((n, k) => expect(n).toBeCloseTo((c.incomeWeekly[k] ?? 0) - (c.outflowWeekly[k] ?? 0), 9));
        expect(c.cumulative[c.cumulative.length - 1]).toBeCloseTo(c.totalIncome - c.totalOutflow, 6);
        expect(c.minCumulative?.value).toBeCloseTo(Math.min(...c.cumulative), 9);
        expect(c.cumulative[c.minCumulative?.bucket ?? -1]).toBeCloseTo(c.minCumulative?.value ?? NaN, 9);
    });

    it('cash-out shares of the tasks add to 100 % and the groups too', () => {
        const c = cf();
        expect(sum(c.tasks.map(t => t.share))).toBeCloseTo(1, 12);
        expect(sum(c.groups.map(g => g.share))).toBeCloseTo(1, 12);
        expect(sum(c.planPctWeekly)).toBeCloseTo(1, 12);
    });

    it('the cash axis covers the plan (it follows the schedule start month) and has at least minMonths x 4 buckets', () => {
        const r = run();
        expect(r.cashflow.buckets[0]?.start).toBe(r.schedule.buckets[0]?.start);
        expect(r.cashflow.buckets.length).toBeGreaterThanOrEqual(20);
        const long = run(i => { const t = i.schedule.tasks['8.6']; if (t) t.duration = 900; });
        expect(long.cashflow.buckets.length).toBeGreaterThan(48);
        expect(long.cashflow.totalOutflow).toBeCloseTo(300000 * 1.15, 6);
    });

    it('a profit when quotation exceeds cost, a funding gap shows as a negative minimum', () => {
        const c = cf();
        expect(c.minCumulative?.value).toBeLessThan(0);
        expect(c.totalIncome - c.totalOutflow).toBeGreaterThan(0);
    });

    it('cost 0: quotation 0, no outflow, no NaN, EVM ratios null', () => {
        const c = cf(x => { x.actualCost = 0; }, fakeBoq(0, 0));
        expect(c.cost).toBe(0);
        expect(c.quotation).toBe(0);
        expect(c.totalOutflow).toBe(0);
        expect(c.evm.spi).toBeNull();
        expect(c.evm.cpi).toBeNull();
        expect(badNumber(c)).toBeNull();
    });

    it('a negative cost flows through as negative money without NaN', () => {
        const c = cf(undefined, fakeBoq(-1000, 0));
        expect(c.cost).toBeLessThan(0);
        expect(badNumber(c)).toBeNull();
    });

    it('no scheduled task: empty axis, no outflow, no NaN, min cumulative null', () => {
        const r = run(i => { for (const t of PLAN_TASKS) i.schedule.tasks[t.id] = { start: '', progress: 0 }; });
        expect(r.cashflow.buckets).toEqual([]);
        expect(r.cashflow.minCumulative).toBeNull();
        expect(r.cashflow.totalOutflow).toBe(0);
        expect(r.cashflow.evm.pv).toBe(0);
        expect(badNumber(r)).toBeNull();
    });
});

describe('EVM: PV / EV / AC, SPI / CPI', () => {
    it('BAC = cost x 1.15; PV = outflow of the first N buckets (sample N = 8)', () => {
        const c = cf();
        expect(c.evm.bac).toBeCloseTo(345000, 6);
        expect(c.evm.pv).toBeCloseTo(sum(c.outflowWeekly.slice(0, 8)), 9);
    });

    it('EV = sum(progress x share) x BAC: all done = BAC, half = BAC / 2, none = 0', () => {
        expect(cf(x => allProgress(x, 1)).evm.ev).toBeCloseTo(345000, 6);
        expect(cf(x => allProgress(x, 0.5)).evm.ev).toBeCloseTo(172500, 6);
        expect(cf(x => allProgress(x, 0)).evm.ev).toBe(0);
    });

    it('SPI = EV / PV, CPI = EV / AC, SV = EV - PV, CV = EV - AC', () => {
        const c = cf(x => { allProgress(x, 1); x.pvBuckets = 1000; x.actualCost = 300000; });
        expect(c.evm.pv).toBeCloseTo(345000, 6);
        expect(c.evm.spi).toBeCloseTo(1, 12);
        expect(c.evm.cpi).toBeCloseTo(345000 / 300000, 12);
        expect(c.evm.sv).toBeCloseTo(0, 6);
        expect(c.evm.cv).toBeCloseTo(45000, 6);
    });

    it('forecasts: EAC time = duration / SPI, EAC cost = BAC / CPI, VAC = BAC - EAC, forecast profit = plan + VAC', () => {
        const c = cf(x => { allProgress(x, 0.5); x.pvBuckets = 1000; x.actualCost = 200000; });
        const spi = 172500 / 345000;
        const cpi = 172500 / 200000;
        expect(c.evm.spi).toBeCloseTo(spi, 12);
        expect(c.evm.cpi).toBeCloseTo(cpi, 12);
        expect(c.evm.eacDays).toBeCloseTo(c.evm.duration / spi, 9);
        expect(c.evm.eacCost).toBeCloseTo(345000 / cpi, 6);
        expect(c.evm.vac).toBeCloseTo(345000 - 345000 / cpi, 6);
        expect(c.evm.profitForecast).toBeCloseTo(c.evm.profitPlan + (c.evm.vac ?? NaN), 6);
    });

    it('zero denominators: PV = 0 -> SPI null; AC = 0 -> CPI, EAC cost, VAC, forecast profit null', () => {
        const c = cf(x => { allProgress(x, 1); x.pvBuckets = 0; x.actualCost = 0; });
        expect(c.evm.pv).toBe(0);
        expect(c.evm.spi).toBeNull();
        expect(c.evm.eacDays).toBeNull();
        expect(c.evm.cpi).toBeNull();
        expect(c.evm.eacCost).toBeNull();
        expect(c.evm.vac).toBeNull();
        expect(c.evm.profitForecast).toBeNull();
        expect(badNumber(c)).toBeNull();
    });

    it('EV = 0 with money spent: SPI 0 (not null), CPI 0, EAC cost and EAC time null (division by 0)', () => {
        const c = cf(x => { allProgress(x, 0); x.actualCost = 50000; });
        expect(c.evm.spi).toBe(0);
        expect(c.evm.cpi).toBe(0);
        expect(c.evm.eacDays).toBeNull();
        expect(c.evm.eacCost).toBeNull();
        expect(c.evm.cv).toBe(-50000);
    });

    it('pvBuckets: fractional rounds, negative or NaN is 0, larger than the axis is the whole outflow', () => {
        expect(cf(x => { x.pvBuckets = 7.5; }).evm.pv).toBeCloseTo(sum(cf().outflowWeekly.slice(0, 8)), 9);
        expect(cf(x => { x.pvBuckets = -3; }).evm.pv).toBe(0);
        expect(cf(x => { x.pvBuckets = Number.NaN; }).evm.pv).toBe(0);
        expect(cf(x => { x.pvBuckets = 9999; }).evm.pv).toBeCloseTo(345000, 6);
    });

    it('progress above 100 % is not clamped (EV may exceed BAC); NaN progress counts as 0', () => {
        expect(cf(x => allProgress(x, 1.5)).evm.ev).toBeCloseTo(345000 * 1.5, 6);
        expect(cf(x => allProgress(x, Number.NaN)).evm.ev).toBe(0);
    });

    it('duration (plan) days come from the schedule (sample 142)', () => {
        expect(cf().evm.duration).toBe(142);
    });

    it('negative actual cost makes CPI negative but stays finite', () => {
        const c = cf(x => { allProgress(x, 1); x.actualCost = -1; });
        expect(Number.isFinite(c.evm.cpi ?? NaN)).toBe(true);
    });
});

describe('blank / sample planning end-to-end', () => {
    it('sample planning with the real BOQ-like cost: totals consistent, no NaN', () => {
        const r = run();
        expect(badNumber(r)).toBeNull();
        expect(r.cashflow.cost).toBe(r.manday.totalBudget);
        expect(r.schedule.budget).toBe(r.manday.totalBudget);
    });

    it('a project with an all-zero BOQ computes a complete plan without NaN', () => {
        const r = run(undefined, fakeBoq(0, 0));
        expect(r.cashflow.cost).toBe(0);
        expect(r.schedule.budget).toBe(0);
        expect(badNumber(r)).toBeNull();
    });
});
