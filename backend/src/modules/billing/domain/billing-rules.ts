// ─── Pure rules of billing that are not money formulas (those live in src/domain/billing) ───
import type { ContractMilestoneStatus, MainContractStatus } from '@contrack/contract';
import type { CostCode, MainContractMilestone } from '../../../shared/application/ports';

/** Text of the lines printed on invoices (stored in the document, like the milestone labels of main-contracts). */
export const INVOICE_TEXT = {
    advance: { th: 'เงินล่วงหน้า', en: 'Advance payment' },
    advanceRecovery: { th: 'หักคืนเงินล่วงหน้า', en: 'Advance payment recovery' },
    escalation: { th: 'ค่า K (เงินเพิ่ม/ลดค่างาน)', en: 'Price escalation (K)' },
    retentionRelease: { th: 'คืนเงินประกันผลงาน', en: 'Retention release' },
} as const;

export const claimText = (claimNo: number): { th: string; en: string } => ({
    th: `ค่างานงวดที่ ${claimNo}`,
    en: `Progress claim no. ${claimNo}`,
});

/** Contract statuses a claim may be made / invoiced in. */
export const BILLABLE_CONTRACT: readonly MainContractStatus[] = ['signed', 'completed'];

/**
 * Cumulative reported progress weighted by selling amount (contract + variation); null when nothing is priced.
 * Same rule as main-contracts' `weightedProgress` (modules do not import each other).
 */
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

/** Stored status with `planned` read as `claimable` once its trigger is met (same rule as main-contracts). */
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

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Default cumulative progress of a new claim line: reported progress, never below what was claimed before. */
export const defaultCumProgress = (reported: number, prev: number): number => Math.max(clamp01(prev), clamp01(reported));
