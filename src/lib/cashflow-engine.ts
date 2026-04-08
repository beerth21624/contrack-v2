/**
 * CashFlow Engine
 *
 * Generates a weekly cash-flow projection based on:
 *  - Schedule (which steps run in which weeks)
 *  - BOQ step results + price list (construction cost per step)
 *  - Configurable installment schedule (cash-in from client)
 *  - Operating cost % and profit %
 *
 * IMPORTANT: Cost calculation uses buildBOQSections (same as BOQ Summary)
 * to ensure 100% data consistency between BOQ Summary and Cash Flow.
 */

import type { StepResult, PriceItem } from '@/types';
import type { FinancialConfig } from './store';
import type { StepSchedule } from '@/data/schedule-data';
import { type ProjectSchedule, type ScheduleConfig, buildSchedule } from './schedule-engine';
import { buildBOQSections } from './boq-mapper';

/* ──────────────────── Types ──────────────────── */

export interface Installment {
    label: string;       // e.g. "มัดจำ", "งวดที่ 1"
    percent: number;     // 0.0–1.0
    triggerWeek: number;  // week number when this is received
}

export interface CashFlowConfig {
    depositPercent: number;       // มัดจำ % (default 0.30)
    installments: Installment[];  // payment schedule
    creditTermDays?: number;      // เครดิตเทอมจ่ายของ (default 0 วัน)
    fixedMonthlyCost?: number;    // fixed overhead per month (optional)
}

export interface StepWeeklyCost {
    stepId: number;
    title: string;
    cost: number;       // total cost for this step in this week
    percent: number;    // % of total construction cost
}

export interface WeeklyCashFlow {
    weekNumber: number;
    weekLabel: string;       // "Week 1", "Week 2", ...
    // Cash IN
    cashIn: number;
    cashInItems: string[];   // names of installments received this week
    // Cash OUT
    cashOut: number;
    constructionCost: number;
    operatingCost: number;
    stepBreakdown: StepWeeklyCost[];
    // Net
    netWeekly: number;       // cashIn - cashOut
    cumulative: number;      // running sum
}

export interface CashFlowResult {
    totalConstructionCost: number;
    contingencyAmount: number;
    quotationPrice: number;
    totalCashIn: number;
    totalCashOut: number;
    totalProfit: number;
    totalOperating: number;
    totalContingency: number;
    minCashBalance: number;
    minCashWeek: number;
    maxNegativeCash: number;     // for OD warning
    gapStartWeek: number | null; // week when cash flow first dips below 0
    gapEndWeek: number | null;   // week when cash flow recovers to >= 0
    weeks: WeeklyCashFlow[];
    config: CashFlowConfig;
}

/* ──────── Default config (matches Excel) ──────── */

export const DEFAULT_CASHFLOW_CONFIG: CashFlowConfig = {
    depositPercent: 0.30,
    installments: [
        { label: 'มัดจำทำสัญญา', percent: 0.30, triggerWeek: 1 },
        { label: 'งวดที่ 1', percent: 0.10, triggerWeek: 6 },
        { label: 'งวดที่ 2', percent: 0.10, triggerWeek: 8 },
        { label: 'งวดที่ 3', percent: 0.10, triggerWeek: 9 },
        { label: 'งวดที่ 4', percent: 0.10, triggerWeek: 12 },
        { label: 'งวดที่ 5', percent: 0.10, triggerWeek: 15 },
        { label: 'งวดที่ 6', percent: 0.10, triggerWeek: 17 },
        { label: 'งวดที่ 7', percent: 0.05, triggerWeek: 19 },
        { label: 'งวดที่ 8', percent: 0.05, triggerWeek: 20 },
    ],
    creditTermDays: 15,
};

/** Default financial config — used when none is provided */
const DEFAULT_FINANCIAL: FinancialConfig = {
    overheadPercent: 5,
    fixedMonthlyOverhead: 15000,
    profitPercent: 15,
    taxPercent: 7,
    contingencyPercent: 5,
};

/* ──────── Main: Build CashFlow ──────── */

export function buildCashFlow(
    stepSaves: Record<number, { inp?: unknown; res: StepResult } | undefined>,
    priceList: PriceItem[],
    scheduleData: StepSchedule[],
    config: CashFlowConfig = DEFAULT_CASHFLOW_CONFIG,
    scheduleConfig: ScheduleConfig = { crewOverrides: {}, dayOverrides: {}, isManualOverrides: {}, weatherBufferPercent: 0 },
    financialConfig: FinancialConfig = DEFAULT_FINANCIAL
): CashFlowResult {
    // 1. Build schedule to get step timing
    const schedule: ProjectSchedule = buildSchedule(stepSaves, scheduleData, scheduleConfig);
    const scheduleWeeks = Math.ceil(schedule.totalDays / 7);
    const shiftWeeks = Math.round((config.creditTermDays ?? 0) / 7);
    
    // Find absolute maximum week needed
    let maxWeek = scheduleWeeks + shiftWeeks;
    for (const inst of config.installments) {
        if (inst.triggerWeek > maxWeek) maxWeek = inst.triggerWeek;
    }

    // 2. Compute total construction cost per step using buildBOQSections
    //    (same source of truth as BOQ Summary — exact price code matching)
    const stepCosts = new Map<number, number>();
    let totalConstructionCost = 0;

    const boqSections = buildBOQSections(stepSaves, priceList);
    for (const sec of boqSections) {
        stepCosts.set(sec.stepNo, sec.sectionTotal);
        totalConstructionCost += sec.sectionTotal;
    }

    // 3. Quotation price — derived from FinancialConfig (same formula as BOQ Summary)
    const contingencyAmt = totalConstructionCost * (financialConfig.contingencyPercent / 100);
    const totalMonths = scheduleWeeks / 4;
    const fixedOverheadAmt = financialConfig.fixedMonthlyOverhead * totalMonths;
    const overheadAmt = (totalConstructionCost * (financialConfig.overheadPercent / 100)) + fixedOverheadAmt;
    const profitAmt = totalConstructionCost * (financialConfig.profitPercent / 100);
    const subTotal = totalConstructionCost + contingencyAmt + overheadAmt + profitAmt;
    const taxAmt = subTotal * (financialConfig.taxPercent / 100);
    const quotationPrice = subTotal + taxAmt;

    // 4. Distribute step costs across their active weeks WITH credit term shift
    // weekStepCosts[weekNumber] = [{ stepId, title, cost, percent }]
    const weekStepCosts = new Map<number, StepWeeklyCost[]>();
    for (let w = 1; w <= maxWeek; w++) {
        weekStepCosts.set(w, []);
    }

    for (const item of schedule.items) {
        const cost = stepCosts.get(item.stepId) ?? 0;
        if (cost <= 0) continue;

        const startWeek = Math.ceil(item.startDay / 7);
        const endWeek = Math.ceil(item.endDay / 7);
        const numWeeks = endWeek - startWeek + 1;
        const costPerWeek = cost / numWeeks;
        const percentPerWeek = totalConstructionCost > 0 ? costPerWeek / totalConstructionCost : 0;

        for (let w = startWeek; w <= endWeek; w++) {
            const paymentWeek = w + shiftWeeks;
            if (paymentWeek > maxWeek) continue; // safety

            const arr = weekStepCosts.get(paymentWeek) ?? [];
            arr.push({
                stepId: item.stepId,
                title: item.title,
                cost: costPerWeek,
                percent: percentPerWeek,
            });
            weekStepCosts.set(paymentWeek, arr);
        }
    }

    // 5. Build weekly cashflow rows
    const weeks: WeeklyCashFlow[] = [];
    let cumulative = 0;
    let totalCashIn = 0;
    let totalCashOut = 0;
    let minCashBalance = Infinity;
    let minCashWeek = 1;
    let maxNegativeCash = 0;
    let gapStartWeek: number | null = null;
    let gapEndWeek: number | null = null;

    for (let w = 1; w <= maxWeek; w++) {
        // Cash IN: installments for this week
        const inItems: string[] = [];
        let cashIn = 0;
        let taxOutForThisWeek = 0;
        for (const inst of config.installments) {
            if (inst.triggerWeek === w) {
                const amount = quotationPrice * inst.percent;
                cashIn += amount;
                
                // Remit VAT from the received payment
                taxOutForThisWeek += taxAmt * inst.percent;
                
                inItems.push(inst.label);
            }
        }

        // Cash OUT: construction cost + operating + contingency spread
        const stepBreakdown = weekStepCosts.get(w) ?? [];
        const constructionCost = stepBreakdown.reduce((s, c) => s + c.cost, 0);
        
        // Verify operating cost formula -> Fixed + %Variable
        const varOperatingCost = constructionCost * (financialConfig.overheadPercent / 100);
        const fixedOperatingCost = (w <= scheduleWeeks) ? financialConfig.fixedMonthlyOverhead / 4 : 0;
        const operatingCost = varOperatingCost + fixedOperatingCost;

        // Spread contingency evenly across all schedule weeks
        const contingencyPerWeek = maxWeek > 0 ? contingencyAmt / maxWeek : 0;
        const cashOut = constructionCost + operatingCost + contingencyPerWeek + taxOutForThisWeek;

        const netWeekly = cashIn - cashOut;
        cumulative += netWeekly;
        totalCashIn += cashIn;
        totalCashOut += cashOut;

        if (cumulative < minCashBalance) {
            minCashBalance = cumulative;
            minCashWeek = w;
        }

        if (cumulative < 0) {
            gapStartWeek ??= w;
            if (cumulative < maxNegativeCash) {
                maxNegativeCash = cumulative;
            }
        } else if (gapStartWeek !== null && cumulative >= 0 && gapEndWeek === null) {
            gapEndWeek = w;
        }

        weeks.push({
            weekNumber: w,
            weekLabel: `สัปดาห์ ${w}`,
            cashIn,
            cashInItems: inItems,
            cashOut,
            constructionCost,
            operatingCost,
            stepBreakdown,
            netWeekly,
            cumulative,
        });
    }

    const totalOperating = overheadAmt;
    const totalContingency = contingencyAmt;
    const totalProfit = quotationPrice - totalConstructionCost - totalOperating - totalContingency - taxAmt;

    return {
        totalConstructionCost,
        contingencyAmount: contingencyAmt,
        quotationPrice,
        totalCashIn,
        totalCashOut,
        totalProfit,
        totalOperating,
        totalContingency,
        minCashBalance: minCashBalance === Infinity ? 0 : minCashBalance,
        minCashWeek,
        maxNegativeCash,
        gapStartWeek,
        gapEndWeek,
        weeks,
        config,
    };
}
