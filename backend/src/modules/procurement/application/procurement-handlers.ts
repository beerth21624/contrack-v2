// ─── What procurement plugs into the core registries (wired in ProcurementModule.onModuleInit) ───
// ApprovalHandlers('purchase_request.approve'), PortalSources (approved PRs waiting for a PO).
import { Injectable } from '@nestjs/common';
import { PURCHASE_REQUEST_ORDERABLE_STATUSES } from '@contrack/contract';
import {
    type ApprovalDecidedEvent, AuditLog, Clock, ModuleFlags, type PortalContext, type PortalTaskItem, UnitOfWork,
} from '../../../shared/application/ports';
import type { DomainError } from '../../../shared/domain/domain-error';
import { type Result, okVoid } from '../../../shared/domain/result';
import { PurchaseRequestRepository } from './ports/procurement.repository';
import { MODULE, transact } from './procurement.service';

@Injectable()
export class ProcurementHandlers {
    constructor(
        private readonly requests: PurchaseRequestRepository,
        private readonly flags: ModuleFlags,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    /** Approval of `purchase_request.approve` (subject id = the request id): approved → `approved`, rejected → `rejected`. */
    async onPurchaseRequestDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>> {
        if (!(await this.flags.isEnabled(e.workspaceId, MODULE))) return okVoid();
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.requests.lock(e.workspaceId, e.subjectId.toLowerCase());
            // Cancelled meanwhile: nothing to apply.
            if (r?.status !== 'pending_approval') return okVoid();
            const status = e.decision === 'approved' ? 'approved' : 'rejected';
            await this.requests.save({ ...r, status, updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: e.workspaceId, projectId: r.projectId, actor: e.decidedBy, entityType: 'purchase_request', entityId: r.id,
                action: status === 'approved' ? 'approved' : 'approval_rejected', data: { status: ['pending_approval', status], note: e.note },
            });
            return okVoid();
        });
    }

    /** Approved purchase requests not fully ordered yet, of the workspace's live projects. */
    async portalToOrder(ctx: PortalContext): Promise<PortalTaskItem[]> {
        if (!(await this.flags.isEnabled(ctx.workspaceId, MODULE))) return [];
        return (await this.requests.listByProjects(ctx.workspaceId, [...ctx.projects.keys()]))
            .filter(r => PURCHASE_REQUEST_ORDERABLE_STATUSES.includes(r.status))
            .map(r => ({
                kind: 'purchase_request_to_order' as const,
                params: { number: r.number ?? '' },
                href: `/p/${r.projectId}/procurement`,
                dueDate: r.requiredDate,
                amount: r.estTotal,
                projectId: r.projectId,
            }));
    }
}
