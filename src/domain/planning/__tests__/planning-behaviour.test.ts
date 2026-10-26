// Behaviour checks of the planning sheets (inputs changed by hand, expectations computed by hand).
import { describe, expect, it } from 'vitest';
import { computeBoq } from '../../boq/engine';
import { BOQ_TEMPLATE_V5 } from '../../boq/template.v5';
import { computeProject, createProject } from '../../project';
import {
    blankPlanningInput, buildWeekBuckets, computePlanning, defaultPlanningInput, isoToSerial, resolvePlanningInput, serialToIso,
    type PlanningInput,
} from '..';

const boq = computeBoq({ sections: BOQ_TEMPLATE_V5 });
const run = (edit: (i: PlanningInput) => void) => {
    const input = defaultPlanningInput();
    edit(input);
    return computePlanning(input, boq);
};
const task = (r: ReturnType<typeof run>, id: string) => {
    const t = r.schedule.tasks.find(x => x.id === id);
    if (!t) throw new Error(`task ${id} missing`);
    return t;
};

describe('calendar', () => {
    it('Excel serials', () => {
        expect(isoToSerial('2026-01-01')).toBe(46023);
        expect(serialToIso(46173)).toBe('2026-05-31');
        expect(isoToSerial('')).toBeNull();
        expect(isoToSerial('31/05/2026')).toBeNull();
    });

    it('4 buckets per month: 1–7, 8–15, 16–22, 23–end (Feb 2026 → W4 has 6 days)', () => {
        const b = buildWeekBuckets(isoToSerial('2026-02-10') ?? 0, 1);
        expect(b.map(x => [x.start, x.end])).toEqual([
            ['2026-02-01', '2026-02-07'], ['2026-02-08', '2026-02-15'], ['2026-02-16', '2026-02-22'], ['2026-02-23', '2026-02-28'],
        ]);
    });

    it('D1: the last bucket of the axis ends on the last day of its month (Excel BE9+6 loses Dec 29–31)', () => {
        const b = buildWeekBuckets(isoToSerial('2026-01-10') ?? 0, 12);
        expect(b[47]?.end).toBe('2026-12-31');
    });
});

describe('Man-Day', () => {
    it('changing the crew changes R and S, not U', () => {
        const r = run(i => { i.manday.blocks['1.5'] = { skilled: 2, labourers: 4, wageSet: 'A', days: 10 }; });
        const b = r.manday.blocks.find(x => x.id === '1.5');
        expect(b?.dailyWage).toBe(2 * 800 + 4 * 500);
        expect(b?.calcDays).toBeCloseTo(37357.026 / 3600, 9);
        expect(b?.budget).toBeCloseTo(104693.0694, 3);
    });

    it('wage sets are configurable (D16)', () => {
        const r = run(i => { i.manday.wageSets.A = { skilled: 900, labourer: 550 }; });
        expect(r.manday.blocks.find(x => x.id === '1.1')?.dailyWage).toBe(1450);
        expect(r.manday.blocks.find(x => x.id === '3.2')?.dailyWage).toBe(5200);   // set B unchanged
    });

    it('piles: no calculated days even with a crew; no crew elsewhere → S null (Excel #DIV/0!)', () => {
        const r = run(i => {
            i.manday.blocks['1.4'] = { skilled: 2, labourers: 2, wageSet: 'A', days: 1 };
            i.manday.blocks['1.1'] = { skilled: 0, labourers: 0, wageSet: 'A', days: 1 };
        });
        expect(r.manday.blocks.find(x => x.id === '1.4')?.calcDays).toBeNull();
        expect(r.manday.blocks.find(x => x.id === '1.1')?.calcDays).toBeNull();
    });

    it('T flows to the S-Curve duration and moves the finish date', () => {
        const r = run(i => { const b = i.manday.blocks['1.5']; if (b) b.days = 12; });
        expect(task(r, '1.5').duration).toBe(12);
        expect(task(r, '1.5').finish).toBe('2026-02-02');   // 2026-01-22 + 12 − 1
        expect(r.manday.totalDays).toBe(166);
    });
});

describe('S-Curve', () => {
    it('task 4.2: duration null links it to Man-Day T184', () => {
        const r = run(i => {
            const t = i.schedule.tasks['4.2'];
            if (t) t.duration = null;
            const b = i.manday.blocks['4.2'];
            if (b) b.days = 6;
        });
        expect(task(r, '4.2').duration).toBe(6);
        expect(task(r, '4.2').durationFromManDay).toBe(true);
    });

    it('weekly share = weight × days in bucket ÷ duration', () => {
        // 1.5 ฐานราก: 10 days 2026-01-22 … 01-31 → Jan W3 (16–22) 1 day, Jan W4 (23–31) 9 days.
        const r = run(() => undefined);
        const t = task(r, '1.5');
        expect(t.plan[2]).toBeCloseTo(t.weight * 1 / 10, 12);
        expect(t.plan[3]).toBeCloseTo(t.weight * 9 / 10, 12);
        expect(t.plan.reduce((s, x) => s + x, 0)).toBeCloseTo(t.weight, 12);
    });

    it('the axis grows past 12 months and the finish is the latest finish (D1)', () => {
        const r = run(i => { const t = i.schedule.tasks['8.2']; if (t) t.start = '2027-02-10'; });
        expect(r.schedule.finish).toBe('2027-02-13');
        expect(r.schedule.buckets).toHaveLength(14 * 4);
        expect(r.schedule.planCumulative.at(-1)).toBeCloseTo(1, 12);
        expect(r.schedule.durationDays).toBe((isoToSerial('2027-02-13') ?? 0) - (isoToSerial('2026-01-10') ?? 0) + 1);
    });

    it('actuals: last update, spent, delay text', () => {
        const r = run(i => {
            const t = i.schedule.tasks['1.2'];
            if (t) t.actual = { start: '2026-01-11', days: 3, cost: 60000 };   // plan finish 01-11, actual 01-13
        });
        expect(r.schedule.status.lastUpdate).toBe('2026-01-13');
        expect(r.schedule.status.delayDays).toBe(-2);
        expect(r.schedule.status.delayText).toBe('ช้ากว่าแผน 2 วัน');
        expect(r.schedule.status.spent).toBeCloseTo(67000, 6);
    });

    it('progress gives the earned value Q5', () => {
        const r = run(i => { const t = i.schedule.tasks['1.5']; if (t) t.progress = 0.5; });
        expect(r.schedule.status.earnedValue).toBeCloseTo(104693.0694 / 2, 3);
    });
});

describe('CashFlow', () => {
    it('quotation / opex / profit rates are configurable (D18), no VAT', () => {
        const r = run(i => { i.cashflow.quotationFactor = 1.4; i.cashflow.operatingCostRate = 0.1; i.cashflow.profitRate = 0.3; });
        const cost = boq.constructionTotal;
        expect(r.cashflow.quotation).toBeCloseTo(cost * 1.4, 6);
        expect(r.cashflow.totalOutflow).toBeCloseTo(cost * 1.1, 6);
        expect(r.cashflow.evm.profitPlan).toBeCloseTo(cost * 0.3, 6);
        expect(r.cashflow.cumulative.at(-1)).toBeCloseTo(cost * (1.4 - 1.1), 6);
    });

    it('moving an installment moves its cash-in', () => {
        const r = run(i => { const x = i.cashflow.installments[1]; if (x) x.bucket = 5; });
        expect(r.cashflow.incomeWeekly[4]).toBe(0);
        expect(r.cashflow.incomeWeekly[5]).toBeCloseTo(r.cashflow.quotation * 0.1, 6);
    });

    it('D1/D18: a plan beyond May extends the cash-flow axis instead of dropping the cost', () => {
        const r = run(i => { const t = i.schedule.tasks['8.6']; if (t) t.start = '2026-07-02'; });
        expect(r.cashflow.buckets).toHaveLength(7 * 4);
        expect(r.cashflow.planPctWeekly.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
        expect(r.cashflow.totalOutflow).toBeCloseTo(boq.constructionTotal * 1.15, 6);
    });

    it('EVM ratios are null when PV / AC are 0', () => {
        const r = run(i => { i.cashflow.actualCost = 0; i.cashflow.pvBuckets = 0; });
        expect(r.cashflow.evm.spi).toBeNull();
        expect(r.cashflow.evm.cpi).toBeNull();
        expect(r.cashflow.evm.eacCost).toBeNull();
        expect(r.cashflow.evm.profitForecast).toBeNull();
    });
});

describe('input resolution and project wire-up', () => {
    it('resolvePlanningInput fills missing parts from the Excel sample', () => {
        const partial = { manday: { blocks: { '1.1': { days: 3 } } } } as unknown as Partial<PlanningInput>;
        const r = resolvePlanningInput(partial);
        expect(r.manday.blocks['1.1']).toEqual({ skilled: 1, labourers: 1, wageSet: 'A', days: 3 });
        expect(r.manday.blocks['1.2']?.days).toBe(2);
        expect(r.manday.wageSets.B).toEqual({ skilled: 1000, labourer: 600 });
        expect(r.schedule.tasks['4.2']?.duration).toBe(4);
        expect(r.cashflow.installments).toHaveLength(9);
        expect(resolvePlanningInput()).toEqual(defaultPlanningInput());
    });

    it('blankPlanningInput keeps the sample plan but drops the sample progress tracking', () => {
        const b = blankPlanningInput();
        const d = defaultPlanningInput();
        expect(b.manday).toEqual(d.manday);
        expect(b.schedule.tasks['1.1']).toEqual({ start: '2026-01-10', progress: 0 });
        expect(b.schedule.tasks['4.2']).toEqual({ start: '2026-03-18', progress: 0, duration: 4 });
        expect(Object.values(b.cashflow.progress).every(p => p === 0)).toBe(true);
        expect(b.cashflow.actualCost).toBe(0);
        expect(b.cashflow.installments).toEqual(d.cashflow.installments);
        const r = computePlanning(b, boq);
        expect(r.schedule.status.lastUpdate).toBeNull();
        expect(r.schedule.durationDays).toBe(142);
        expect(r.cashflow.evm.ev).toBe(0);
        expect(r.cashflow.evm.ac).toBe(0);
        // Stored edits still win over the blank base.
        const stored = { schedule: { ...b.schedule, tasks: { ...b.schedule.tasks, '1.2': { start: '2026-01-11', actual: { days: 2 } } } } };
        const resolved = resolvePlanningInput(stored, blankPlanningInput());
        expect(resolved.schedule.tasks['1.2']).toEqual({ start: '2026-01-11', progress: 0, actual: { days: 2 } });
        expect(resolved.schedule.tasks['1.1']?.actual).toBeUndefined();
    });

    it('computeProject exposes planning; CashFlow cost = BOQ construction total', () => {
        const project = createProject();
        const res = computeProject(project);
        expect(res.planning.cashflow.cost).toBe(res.boq.constructionTotal);
        expect(res.planning.manday.blocks).toHaveLength(32);
        const edited = computeProject({
            ...project,
            planning: { cashflow: { ...defaultPlanningInput().cashflow, quotationFactor: 1.5 } },
        });
        expect(edited.planning.cashflow.quotation).toBeCloseTo(res.boq.constructionTotal * 1.5, 6);
    });
});
