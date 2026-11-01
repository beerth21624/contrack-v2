// ─── SubcontractCashPlan (shared/application/ports.ts, WP-47): unpaid installments of live subcontracts as cash out ───
// Approved claim → its net on the approval day; requested / inspected claim → its net a week after the request;
// installment not claimed yet → amount + VAT − WHT (no retention) spread over the schedule (start → finish, or start +
// days), installment k of n at start + span × k / n. Nothing for an unclaimed installment without a schedule.
import { Injectable } from '@nestjs/common';
import type { SubcontractStatus } from '@contrack/contract';
import { addDays, bangkokToday, daysBetween } from '@contrack/domain/dates/business-date';
import { THAI_VAT_RATE, round2 } from '@contrack/domain/money';
import { type CashPlanItem, ModuleFlags, SubcontractCashPlan } from '../../../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../../../shared/domain/ids';
import type { Claim } from '../../domain/entities/claim.entity';
import type { Subcontract } from '../../domain/entities/subcontract.entity';
import { ClaimRepository } from '../../application/ports/claim.repository';
import { SubcontractRepository } from '../../application/ports/subcontract.repository';

/** Subcontracts that will still be paid. */
const LIVE: readonly SubcontractStatus[] = ['active', 'completed'];
/** Days from a claim request to its expected payment. */
const REQUEST_TO_PAY_DAYS = 7;

/** First and last day of the schedule; null when it cannot be known. */
function scheduleSpan(s: Subcontract): { start: string; finish: string } | null {
    const p = s.state;
    const start = p.schedule.start ?? (p.activatedAt === null ? null : bangkokToday(p.activatedAt));
    if (start === null) return null;
    const finish = p.schedule.finish ?? (p.schedule.days === null ? null : addDays(start, p.schedule.days));
    return finish === null || finish < start ? null : { start, finish };
}

@Injectable()
export class RepositorySubcontractCashPlan extends SubcontractCashPlan {
    constructor(
        private readonly flags: ModuleFlags,
        private readonly subcontracts: SubcontractRepository,
        private readonly claims: ClaimRepository,
    ) {
        super();
    }

    async plan(workspaceId: WorkspaceId, projectIds: readonly ProjectId[] | 'all', _today: string, to: string): Promise<CashPlanItem[]> {
        if (!(await this.flags.isEnabled(workspaceId, 'subcontracting'))) return [];
        const list = projectIds === 'all'
            ? await this.subcontracts.listByBuyer(workspaceId)
            : (await Promise.all([...new Set(projectIds)].map(id => this.subcontracts.listByProject(workspaceId, id)))).flat();
        const live = list.filter(s => LIVE.includes(s.status));
        if (live.length === 0) return [];
        const claimsBy = new Map<string, Claim[]>();
        for (const c of await this.claims.listBySubcontracts(live.map(s => s.id))) {
            if (c.status === 'rejected') continue;
            claimsBy.set(c.subcontractId, [...(claimsBy.get(c.subcontractId) ?? []), c]);
        }
        const out: CashPlanItem[] = [];
        for (const s of live) {
            const p = s.state;
            const amounts = s.installmentAmounts();
            const span = scheduleSpan(s);
            const mine = claimsBy.get(p.id) ?? [];
            const push = (date: string, amount: number, no: number): void => {
                const rounded = round2(amount);
                if (date > to || rounded <= 0) return;
                out.push({ projectId: p.projectId, date, direction: 'out', amount: rounded, source: 'subcontract', ref: `${p.contractNo} #${no}` });
            };
            for (const inst of amounts) {
                const claim = mine
                    .filter(c => c.installmentNo === inst.no)
                    .sort((a, b) => b.state.createdAt.getTime() - a.state.createdAt.getTime())[0];
                if (claim?.status === 'paid') continue;
                if (claim?.status === 'approved') {
                    const approvedAt = claim.state.approvedAt;
                    push(approvedAt === null ? bangkokToday(claim.requestedAt) : bangkokToday(approvedAt), claim.amounts.net, inst.no);
                } else if (claim !== undefined) {
                    push(addDays(bangkokToday(claim.requestedAt), REQUEST_TO_PAY_DAYS), claim.amounts.net, inst.no);
                } else if (span !== null && amounts.length > 0) {
                    const offset = Math.round(daysBetween(span.start, span.finish) * inst.no / amounts.length);
                    const vat = p.terms.vat ? round2(inst.amount * THAI_VAT_RATE) : 0;
                    const wht = round2(inst.amount * p.terms.whtPct);
                    push(addDays(span.start, offset), inst.amount + vat - wht, inst.no);
                }
            }
        }
        return out;
    }
}
