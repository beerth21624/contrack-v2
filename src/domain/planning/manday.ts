// ─── Man-Day_Basic, planning columns O..U ─────────────────────────────────────
// One block per planned BOQ category. Excel duplicates the whole BOQ into columns A..M; the app
// reads the category's labour / total straight from the BOQ result instead (design §1.6, oddity 1).
//   Q = O + P                        crew size
//   R = rate_skilled·O + rate_lab·P  daily crew wage (wage set A 800/500 or B 1000/600)
//   S = labour ÷ R                   calculated days (variants: 20 % of total, none for piles)
//   T = typed estimate               → S-Curve duration
//   U = block total (BOQ M)          → S-Curve budget
// docs/excel-spec/06-manday-scurve-cashflow.md §1.4.
import type { BoqItemRow, BoqResult } from '../boq/types';
import { PLAN_TASKS, type ManDayBlockDef, type ManDayLabourBasis, type PlanTaskDef, type WageSetId } from './tasks';

export interface WageRate {
    skilled: number;    // ฿/day per ช่าง
    labourer: number;   // ฿/day per คนงาน
}

export interface ManDayBlockInput {
    skilled: number;      // O 1.ช่าง
    labourers: number;    // P 2.คนงาน
    wageSet: WageSetId;   // which wage set R uses
    days: number;         // T 6.ประเมิน (วัน)
}

export interface ManDayInput {
    /** Daily wages per set. Excel hard-codes them in the R formulas (A 800/500, B 1000/600) — decision D16. */
    wageSets: Record<WageSetId, WageRate>;
    /** Share of the total treated as labour for 'shareOfTotal' blocks (Excel 0.2 in S233 / S278). */
    subcontractLabourShare: number;
    /** Keyed by task id ("1.1" … "8.6"); the 32 blocks map 1:1 to the S-Curve tasks. */
    blocks: Record<string, ManDayBlockInput>;
}

export interface ManDayBlockResult {
    /** Task id the block feeds ("1.1" …). */
    id: string;
    excelRow: number;
    title: string;
    section: number;
    labourBasis: ManDayLabourBasis;
    skilled: number;          // O
    labourers: number;        // P
    crew: number;             // Q
    wageSet: WageSetId;
    dailyWage: number;        // R
    /** Labour total of the block's BOQ rows (BOQ L / Man-Day K). */
    boqLabour: number;
    /** What S divides by R: the labour total, or share × total, or 0 for 'none'. */
    labourCost: number;
    /** S 5.คำนวณ (วัน); null when there is no calculation (piles) or no crew (R = 0, Excel #DIV/0!). */
    calcDays: number | null;
    /** ROUND(S) — a hint for the T input (D16 suggests T defaults to it; Excel's T is typed). */
    suggestedDays: number | null;
    days: number;             // T
    budget: number;           // U
}

export interface ManDayResult {
    blocks: ManDayBlockResult[];
    /** T310 รวมเวลา = Σ T. A sum of task days, not the calendar duration of the project. */
    totalDays: number;
    /** U310 รวมงบประมาณ = Σ U. */
    totalBudget: number;
}

const finite = (x: number | undefined): number => (x !== undefined && Number.isFinite(x) ? x : 0);

/** Labour and total of the BOQ rows a block reads. */
export function blockBoqTotals(def: ManDayBlockDef, boq: BoqResult): { labour: number; total: number } {
    const own = ownBlockTotals(def, boq);
    for (const no of def.alsoSections ?? []) {
        const s = boq.sections.find(x => x.no === no);
        if (s) { own.labour += s.labTotal; own.total += s.total; }
    }
    return own;
}

function ownBlockTotals(def: ManDayBlockDef, boq: BoqResult): { labour: number; total: number } {
    const section = boq.sections.find(s => s.no === def.section);
    if (!section) return { labour: 0, total: 0 };
    if (!def.rows) return { labour: section.labTotal, total: section.total };
    const from = def.rows.from ?? -Infinity;
    const to = def.rows.to ?? Infinity;
    const rows = section.rows.filter((r): r is BoqItemRow => r.type === 'item' && r.excelRow >= from && r.excelRow < to);
    return {
        labour: rows.reduce((s, r) => s + r.labTotal, 0),
        total: rows.reduce((s, r) => s + r.total, 0),
    };
}

export function computeManDayBlock(
    task: PlanTaskDef, block: ManDayBlockInput, input: ManDayInput, boq: BoqResult,
): ManDayBlockResult {
    const def = task.manday;
    const skilled = finite(block.skilled);
    const labourers = finite(block.labourers);
    const rate = input.wageSets[block.wageSet];
    const dailyWage = finite(rate.skilled) * skilled + finite(rate.labourer) * labourers;
    const { labour, total } = blockBoqTotals(def, boq);
    const labourCost = def.labourBasis === 'labour' ? labour
        : def.labourBasis === 'shareOfTotal' ? total * finite(input.subcontractLabourShare)
            : 0;
    const calcDays = def.labourBasis === 'none' || dailyWage === 0 ? null : labourCost / dailyWage;
    return {
        id: task.id,
        excelRow: def.excelRow,
        title: def.title,
        section: def.section,
        labourBasis: def.labourBasis,
        skilled,
        labourers,
        crew: skilled + labourers,
        wageSet: block.wageSet,
        dailyWage,
        boqLabour: labour,
        labourCost,
        calcDays,
        suggestedDays: calcDays === null ? null : Math.round(calcDays),
        days: finite(block.days),
        budget: total,
    };
}

/** Evaluates every Man-Day block from the BOQ. `input.blocks` must hold every task id (see resolvePlanningInput). */
export function computeManDay(input: ManDayInput, boq: BoqResult): ManDayResult {
    const blocks = PLAN_TASKS.map(task => {
        const block = input.blocks[task.id] ?? {
            skilled: task.sample.skilled, labourers: task.sample.labourers,
            wageSet: task.sample.wageSet, days: task.sample.days,
        };
        return computeManDayBlock(task, block, input, boq);
    });
    return {
        blocks,
        totalDays: blocks.reduce((s, b) => s + b.days, 0),
        totalBudget: blocks.reduce((s, b) => s + b.budget, 0),
    };
}
