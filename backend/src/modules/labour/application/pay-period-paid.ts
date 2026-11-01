// ─── Paying an approved pay period: shared by POST .../pay (labour) and PayPeriodPayments.markPaid (payables, WP-50) ───
import type { LabourPaymentMethod } from '@contrack/contract';
import { allocate, round2 } from '@contrack/domain/money';
import type { AuditLog, FinancialEvents } from '../../../shared/application/ports';
import type { DomainError } from '../../../shared/domain/domain-error';
import type { ProjectId, UserId } from '../../../shared/domain/ids';
import { type Result, ok } from '../../../shared/domain/result';
import { PERIOD_SOURCE } from './labour.service';
import type { LabourRepository, PayPeriodRecord } from './ports/labour.repository';

/**
 * Inside the caller's transaction, the period locked and approved: fin_events `lb.wages_paid` per project (net = the
 * project's wages, cash = the period net spread by them) and `lb.advance_recovered` per person, timesheets and lines
 * paid, period paid, audit `pay`.
 */
export async function markPeriodPaid(
    deps: { repo: LabourRepository; events: FinancialEvents; audit: AuditLog },
    period: PayPeriodRecord,
    input: { paidDate: string; paymentMethod: LabourPaymentMethod; by: UserId; now: Date; data?: Record<string, unknown> },
): Promise<Result<PayPeriodRecord, DomainError>> {
    const { repo, events, audit } = deps;
    const { paidDate, paymentMethod, by: userId, now } = input;
    const ws = period.workspaceId;
    const periodKey = period.periodKey;
    const entries = await repo.entriesOfPeriod(ws, period.id);
    const lines = await repo.linesOf(ws, period.id);

    // Wages per project: the cost (gross) and the cash actually paid (period net spread by the gross).
    const byProject = new Map<ProjectId, number>();
    for (const e of entries) byProject.set(e.projectId, round2((byProject.get(e.projectId) ?? 0) + e.amount));
    const projects = [...byProject.keys()].sort();
    const cash = allocate(period.net, projects.map(p => byProject.get(p) ?? 0));
    const common = { eventDate: paidDate, counterpartyType: 'worker' as const, sourceType: PERIOD_SOURCE, sourceId: period.id, by: userId };
    for (const [i, projectId] of projects.entries()) {
        const posted = await events.post(ws, {
            ...common, projectId, eventType: 'lb.wages_paid', direction: 'out', counterpartyName: '', net: byProject.get(projectId) ?? 0,
            cash: cash[i] ?? 0, data: { periodKey, paymentMethod, ...input.data },
        });
        if (!posted.ok) return posted;
    }
    for (const l of lines.filter(x => x.advanceDeduction > 0)) {
        const posted = await events.post(ws, {
            ...common, projectId: null, eventType: 'lb.advance_recovered', direction: 'none', counterpartyId: l.personId,
            counterpartyName: l.personName, net: l.advanceDeduction, cash: 0, data: { periodKey, payLineId: l.id },
        });
        if (!posted.ok) return posted;
    }

    await repo.markLinesPaid(ws, period.id);
    await repo.saveEntries(entries.map(e => ({ ...e, status: 'paid' as const, updatedAt: now })));
    const paid: PayPeriodRecord = { ...period, status: 'paid', paidDate, paidAt: now, paidBy: userId, paymentMethod, updatedAt: now };
    await repo.savePeriod(paid);
    await audit.record({
        workspaceId: ws, projectId: null, actor: userId, entityType: 'pay_period', entityId: period.id, action: 'pay',
        data: { status: [period.status, 'paid'], periodKey, net: period.net, paidDate, paymentMethod, ...input.data },
    });
    return ok(paid);
}
