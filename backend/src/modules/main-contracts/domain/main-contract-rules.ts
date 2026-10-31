// ─── Pure rules of main contracts: default terms, milestones and their amounts, claimable on read ───
// docs/erp/02-domain-model.md §3. The advance payment is milestone `no` 0 (kind `advance`, from `terms.advancePct`,
// not part of the 100%); work / final milestones are numbered 1…n and their amounts = allocate(value, pct[]).
import type {
    ContractMilestoneInput, ContractMilestoneStatus, MainContractStatus, MainContractTerms, MilestoneTemplateItem, ProjectCommercialSettings,
} from '@contrack/contract';
import { allocate, round2, sumMoney } from '@contrack/domain/money';
import type { CostCode, MainContractMilestone } from '../../../shared/application/ports';

export const ADVANCE_LABEL = { th: 'เงินล่วงหน้า', en: 'Advance payment' } as const;
export const VARIATION_LABEL = { th: 'งานเพิ่ม-ลด', en: 'Variation' } as const;

/** Not claimed yet (amounts may still be re-allocated). */
export const UNCLAIMED: ReadonlySet<ContractMilestoneStatus> = new Set(['planned', 'claimable']);

/** Contract terms from the project's commercial settings (00-vision §4). */
export function defaultTerms(s: ProjectCommercialSettings): MainContractTerms {
    return {
        advancePct: Math.min(s.advancePct, 0.3),
        retentionPct: Math.min(s.retentionPct, 0.1),
        retentionCapPct: null,
        retentionRelease: 'half_at_completion_half_after_warranty',
        customerWhtRate: s.customerWhtRate,
        penaltyRatePerDay: s.penaltyRatePerDay,
        penaltyBase: 'contract_value',
        penaltyCapPct: 0.1,
        warrantyMonths: s.warrantyMonths,
        guaranteePct: s.guaranteePct,
        paymentTermDays: s.paymentTermDays,
        // D-13: the K formula is entered per contract; 4% is the usual threshold.
        escalation: s.escalation ? { enabled: true, fixed: 0, terms: [], threshold: 0.04 } : null,
    };
}

/** A work / final milestone before numbering and amounts. */
export interface MilestoneDraft {
    labelTh: string;
    labelEn: string;
    kind: 'work' | 'final';
    pct: number;
    trigger: MainContractMilestone['trigger'];
    triggerProgress: number | null;
    dueDate: string | null;
    costCodeIds: string[];
}

/** Payment terms of a quotation / project template → drafts (handover = the final one; progress without a level = cumulative %). */
export function draftsFromTemplate(items: readonly MilestoneTemplateItem[]): MilestoneDraft[] {
    let cumulative = 0;
    return items.map(i => {
        cumulative += i.pct;
        return {
            labelTh: i.labelTh,
            labelEn: i.labelEn,
            kind: i.trigger === 'handover' ? 'final' : 'work',
            pct: i.pct,
            trigger: i.trigger,
            triggerProgress: i.trigger === 'progress' ? Math.min(1, i.progressAt ?? cumulative) : null,
            dueDate: null,
            costCodeIds: [],
        };
    });
}

export function draftsFromInput(items: readonly ContractMilestoneInput[]): MilestoneDraft[] {
    return items.map(i => ({
        labelTh: i.labelTh,
        labelEn: i.labelEn === '' ? i.labelTh : i.labelEn,
        kind: i.kind,
        pct: i.pct,
        trigger: i.trigger,
        triggerProgress: i.trigger === 'progress' ? (i.triggerProgress ?? null) : null,
        dueDate: i.dueDate ?? null,
        costCodeIds: [...new Set((i.costCodeIds ?? []).map(id => id.toLowerCase()))],
    }));
}

/** The work / final milestones of a contract as drafts (to re-plan them). */
export function draftsOf(milestones: readonly MainContractMilestone[]): MilestoneDraft[] {
    return milestones.filter(m => m.kind !== 'advance').map(m => ({
        labelTh: m.labelTh, labelEn: m.labelEn, kind: m.kind === 'final' ? 'final' : 'work', pct: m.pct, trigger: m.trigger,
        triggerProgress: m.triggerProgress, dueDate: m.dueDate, costCodeIds: [...m.costCodeIds],
    }));
}

export type PlannedMilestone = Omit<MainContractMilestone, 'id' | 'contractId'>;

/**
 * Numbered milestones with amounts: the advance one (no 0) when `advancePct` > 0 = round2(value × advancePct), then the
 * drafts 1…n with allocate(value, pct[]) so they add up to `value` exactly.
 */
export function planMilestones(drafts: readonly MilestoneDraft[], value: number, advancePct: number): PlannedMilestone[] {
    const out: PlannedMilestone[] = [];
    if (advancePct > 0) {
        out.push({
            no: 0, labelTh: ADVANCE_LABEL.th, labelEn: ADVANCE_LABEL.en, kind: 'advance', pct: advancePct, amount: round2(value * advancePct),
            trigger: 'signing', triggerProgress: null, dueDate: null, costCodeIds: [], status: 'planned', source: 'contract', variationId: null,
        });
    }
    const amounts = allocate(value, drafts.map(d => d.pct));
    drafts.forEach((d, i) => {
        out.push({ ...d, no: i + 1, amount: amounts[i] ?? 0, status: 'planned', source: 'contract', variationId: null });
    });
    return out;
}

/**
 * `spread` of a variation: the unclaimed contract milestones get `currentValue` minus everything else (claimed ones and
 * variation milestones), split by their shares. undefined when no milestone is left to take it.
 */
export function spreadUnclaimed(milestones: readonly MainContractMilestone[], currentValue: number): Map<string, number> | undefined {
    const work = milestones.filter(m => m.kind !== 'advance');
    const open = work.filter(m => m.source === 'contract' && UNCLAIMED.has(m.status));
    if (open.length === 0) return undefined;
    const openIds = new Set(open.map(m => m.id));
    const fixed = sumMoney(work.filter(m => !openIds.has(m.id)).map(m => m.amount));
    const amounts = allocate(currentValue - fixed, open.map(m => m.pct));
    return new Map(open.map((m, i) => [m.id, amounts[i] ?? 0]));
}

/** Cumulative reported progress weighted by selling amount (contract + variation); null when nothing is priced. */
export function weightedProgress(costCodes: readonly CostCode[]): number | null {
    let weight = 0;
    let done = 0;
    for (const c of costCodes) {
        if (c.status === 'omitted') continue;
        const w = c.contractAmount + c.voContractAmount;
        if (w <= 0) continue;
        weight += w;
        done += w * Math.min(1, Math.max(0, c.reportedProgress));
    }
    return weight > 0 ? done / weight : null;
}

/** Stored status, with `planned` turned `claimable` once its trigger is met (computed on read, no job). */
export function effectiveMilestoneStatus(
    m: MainContractMilestone, ctx: { contractStatus: MainContractStatus; today: string; progress: number | null },
): ContractMilestoneStatus {
    if (m.status !== 'planned') return m.status;
    if (ctx.contractStatus !== 'signed' && ctx.contractStatus !== 'completed') return 'planned';
    switch (m.trigger) {
        case 'signing': return 'claimable';
        case 'date': return m.dueDate !== null && m.dueDate <= ctx.today ? 'claimable' : 'planned';
        case 'progress':
            return m.triggerProgress !== null && ctx.progress !== null && ctx.progress + 1e-9 >= m.triggerProgress ? 'claimable' : 'planned';
        case 'handover': return ctx.contractStatus === 'completed' ? 'claimable' : 'planned';
        case 'manual': return 'planned';
    }
}
