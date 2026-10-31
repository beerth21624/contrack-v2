// ─── Read endpoints of the ledger (WP-20), gated by `project-hub` ───
import { Injectable } from '@nestjs/common';
import {
    type CostLedgerDto, type CostLedgerEntryDto, type CostLedgerQuery, FIN_EVENT_TYPES, type FinEventDto, type FinEventListQuery, type FinEventType,
} from '@contrack/contract';
import { ModuleAccess } from '../../../../shared/application/module-access';
import type { CostLedgerEntry, FinEvent } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, asProjectId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { sumTotals, totalsByCode } from '../../domain/ledger-rules';
import { CostLedgerRepository, FinEventRepository } from '../ports/ledger.repository';

const MODULE = 'project-hub';

const toEntryDto = (e: CostLedgerEntry): CostLedgerEntryDto => ({
    id: e.id,
    projectId: e.projectId,
    costCodeId: e.costCodeId,
    entryDate: e.entryDate,
    kind: e.kind,
    category: e.category,
    amount: e.amount,
    qty: e.qty,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    sourceLineId: e.sourceLineId,
    commitmentRef: e.commitmentRef,
    reversesId: e.reversesId,
    note: e.note,
    createdBy: e.createdBy,
    createdAt: e.createdAt.toISOString(),
});

const toEventDto = (e: FinEvent): FinEventDto => ({
    id: e.id,
    projectId: e.projectId,
    eventDate: e.eventDate,
    eventType: e.eventType,
    direction: e.direction,
    counterpartyType: e.counterpartyType,
    counterpartyId: e.counterpartyId,
    counterpartyName: e.counterpartyName,
    counterpartyTaxId: e.counterpartyTaxId,
    counterpartyBranch: e.counterpartyBranch,
    docType: e.docType,
    docNumber: e.docNumber,
    docDate: e.docDate,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    net: e.net,
    vat: e.vat,
    wht: e.wht,
    retention: e.retention,
    cash: e.cash,
    reversesId: e.reversesId,
    data: e.data,
    createdBy: e.createdBy,
    createdAt: e.createdAt.toISOString(),
});

/** GET /projects/:projectId/cost-ledger?costCodeId= — `cost.read`. */
@Injectable()
export class GetCostLedgerUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: CostLedgerRepository) {}

    async execute(userId: UserId, projectId: ProjectId, query: CostLedgerQuery): Promise<Result<CostLedgerDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['cost.read'], write: false });
        if (!grant.ok) return grant;
        const entries = await this.repo.listByProject(grant.value.workspaceId, projectId, query.costCodeId?.toLowerCase());
        return ok({ entries: entries.map(toEntryDto), byCostCode: totalsByCode(entries), totals: sumTotals(entries) });
    }
}

/** GET /workspaces/:workspaceId/fin-events?from=&to=&type=&projectId= — `tax.reports` (every type) or `billing.read` (ar.* only). */
@Injectable()
export class ListFinEventsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: FinEventRepository) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: FinEventListQuery): Promise<Result<FinEventDto[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE);
        if (!grant.ok) return grant;
        const allTypes = can(grant.value.role, 'tax.reports');
        if (!allTypes && !can(grant.value.role, 'billing.read')) return err(DomainError.forbidden());
        // `billing.read` alone sees the customer side only (ar.*); payables / wages need `tax.reports` (D-171).
        const requested: readonly FinEventType[] = query.type ?? FIN_EVENT_TYPES;
        const types = allTypes ? query.type : requested.filter(type => type.startsWith('ar.'));
        if (types?.length === 0) return ok([]);
        const events = await this.repo.list(workspaceId, {
            from: query.from,
            to: query.to,
            types,
            projectId: query.projectId === undefined ? undefined : asProjectId(query.projectId.toLowerCase()),
        });
        return ok(events.map(toEventDto));
    }
}
