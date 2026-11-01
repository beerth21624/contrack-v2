// ─── Cash plan source of procurement (WP-47): issued purchase orders not billed yet, due delivery + payment term ───
import { Injectable } from '@nestjs/common';
import { addDays } from '@contrack/domain/dates/business-date';
import { round2 } from '@contrack/domain/money';
import type { PurchaseOrderStatus } from '@contrack/contract';
import { type CashPlanItem, ModuleFlags } from '../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../shared/domain/ids';
import { MODULE } from './procurement.service';
import { type PurchaseOrderLineRecord, PurchaseOrderRepository } from './ports/procurement.repository';

/** Issued and not closed: the supplier will be paid what is not billed yet. */
const PAYABLE_STATUSES: readonly PurchaseOrderStatus[] = ['issued', 'partially_received', 'received'];

/** Share of the order not billed yet (by line amount; 1 without lines). */
function unbilledShare(lines: readonly PurchaseOrderLineRecord[]): number {
    const total = lines.reduce((s, l) => s + l.amount, 0);
    if (total <= 0) return lines.length === 0 ? 1 : 0;
    const open = lines.reduce((s, l) => s + (l.qty > 0 ? l.amount * Math.max(0, l.qty - l.billedQty) / l.qty : 0), 0);
    return Math.min(1, Math.max(0, open / total));
}

@Injectable()
export class ProcurementCashPlan {
    constructor(private readonly orders: PurchaseOrderRepository, private readonly flags: ModuleFlags) {}

    async plan(workspaceId: WorkspaceId, projectIds: readonly ProjectId[] | 'all', from: string, to: string): Promise<CashPlanItem[]> {
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return [];
        const wanted = projectIds === 'all' ? null : new Set<string>(projectIds);
        const out: CashPlanItem[] = [];
        for (const o of await this.orders.listByWorkspace(workspaceId, PAYABLE_STATUSES)) {
            if (wanted !== null && !wanted.has(o.projectId)) continue;
            const base = o.deliveryDate ?? o.orderDate ?? from;
            const date = addDays(base, o.paymentTermDays ?? 0);
            if (date > to) continue;
            const amount = round2(o.total * unbilledShare(await this.orders.linesOf(workspaceId, o.id)));
            if (amount <= 0) continue;
            out.push({ projectId: o.projectId, date, direction: 'out', amount, source: 'purchase_order', ref: o.number ?? '' });
        }
        return out;
    }
}
