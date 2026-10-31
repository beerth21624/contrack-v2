// ─── Shared parts of the procurement use cases: transactions, access, PR lines and the budget check ───
import { Injectable } from '@nestjs/common';
import type { BudgetWarning, PurchaseRequestLineInput } from '@contrack/contract';
import { type BudgetCheckCode, budgetWarnings, materialBudgetOf } from '@contrack/domain/procurement/budget-check';
import { round2, roundQty, sumMoney } from '@contrack/domain/money';
import { type ProjectGrant, ModuleAccess } from '../../../shared/application/module-access';
import { type CostCode, CostCodeLookup, CostLedger, IdGenerator, UnitOfWork } from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import type { Permission } from '../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../shared/domain/result';
import {
    GoodsReceiptRepository, type GoodsReceiptRecord, PurchaseOrderRepository, type PurchaseOrderRecord, type PurchaseRequestLineRecord,
    PurchaseRequestRepository, type PurchaseRequestRecord, type RfqRecord, RfqRepository,
} from './ports/procurement.repository';

export const MODULE = 'procurement';

/** Thrown inside a transaction so an `err` rolls it back (the UnitOfWork commits on a normal return). */
class Rollback extends Error {
    constructor(readonly error: DomainError) {
        super(error.message);
    }
}

/** Runs `work` in one transaction; an `err` result rolls everything back and is returned. */
export async function transact<T>(uow: UnitOfWork, work: () => Promise<Result<T, DomainError>>): Promise<Result<T, DomainError>> {
    try {
        return await uow.run(async () => {
            const r = await work();
            if (!r.ok) throw new Rollback(r.error);
            return r;
        });
    } catch (e) {
        if (e instanceof Rollback) return err(e.error);
        throw e;
    }
}

/** Loads a PR / RFQ by id and authorizes the caller on its project (a stranger or an unknown id → not_found). */
@Injectable()
export class ProcurementAccess {
    constructor(
        private readonly access: ModuleAccess,
        private readonly requests: PurchaseRequestRepository,
        private readonly rfqs: RfqRepository,
        private readonly orders: PurchaseOrderRepository,
        private readonly receipts: GoodsReceiptRepository,
    ) {}

    private async grantOn<T extends { workspaceId: WorkspaceId; projectId: ProjectId }>(
        userId: UserId, doc: T | undefined, entity: string, permissions: Permission[], write: boolean,
    ): Promise<Result<{ grant: ProjectGrant; doc: T }, DomainError>> {
        if (doc === undefined) return err(DomainError.notFound(entity));
        const grant = await this.access.toProject(userId, doc.projectId, MODULE, { permissions, write });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound(entity)) : grant;
        if (grant.value.workspaceId !== doc.workspaceId) return err(DomainError.notFound(entity));
        return ok({ grant: grant.value, doc });
    }

    async request(userId: UserId, requestId: string, permissions: Permission[], write: boolean): Promise<Result<{ grant: ProjectGrant; doc: PurchaseRequestRecord }, DomainError>> {
        if (!isUuid(requestId)) return err(DomainError.notFound('PurchaseRequest'));
        return this.grantOn(userId, await this.requests.find(requestId.toLowerCase()), 'PurchaseRequest', permissions, write);
    }

    async rfq(userId: UserId, rfqId: string, permissions: Permission[], write: boolean): Promise<Result<{ grant: ProjectGrant; doc: RfqRecord }, DomainError>> {
        if (!isUuid(rfqId)) return err(DomainError.notFound('Rfq'));
        return this.grantOn(userId, await this.rfqs.find(rfqId.toLowerCase()), 'Rfq', permissions, write);
    }

    async order(userId: UserId, orderId: string, permissions: Permission[], write: boolean): Promise<Result<{ grant: ProjectGrant; doc: PurchaseOrderRecord }, DomainError>> {
        if (!isUuid(orderId)) return err(DomainError.notFound('PurchaseOrder'));
        return this.grantOn(userId, await this.orders.find(orderId.toLowerCase()), 'PurchaseOrder', permissions, write);
    }

    async receipt(userId: UserId, receiptId: string, permissions: Permission[], write: boolean): Promise<Result<{ grant: ProjectGrant; doc: GoodsReceiptRecord }, DomainError>> {
        if (!isUuid(receiptId)) return err(DomainError.notFound('GoodsReceipt'));
        return this.grantOn(userId, await this.receipts.find(receiptId.toLowerCase()), 'GoodsReceipt', permissions, write);
    }
}

/** A line before it is stored (id / request / sort set by `PurchaseRequestLines.build`). */
export type DraftRequestLine = Omit<PurchaseRequestLineRecord, 'id' | 'requestId' | 'workspaceId' | 'sort' | 'orderedQty'>;

@Injectable()
export class PurchaseRequestLines {
    constructor(
        private readonly repo: PurchaseRequestRepository,
        private readonly orders: PurchaseOrderRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly ledger: CostLedger,
        private readonly ids: IdGenerator,
    ) {}

    /** The project's cost codes among `ids` (lower-cased); not_found `CostCode` when one is not of the project. */
    async codes(workspaceId: WorkspaceId, projectId: ProjectId, ids: readonly string[]): Promise<Result<Map<string, CostCode>, DomainError>> {
        const wanted = [...new Set(ids.map(id => id.toLowerCase()))];
        if (wanted.length === 0) return ok(new Map());
        const found = await this.costCodes.findMany(workspaceId, projectId, wanted);
        if (found.length < wanted.length) return err(DomainError.notFound('CostCode'));
        return ok(new Map(found.map(c => [c.id, c])));
    }

    /** A typed line: description / unit / estimate default to its cost code's. */
    fromInput(l: PurchaseRequestLineInput, codes: ReadonlyMap<string, CostCode>): DraftRequestLine {
        const code = l.costCodeId === undefined || l.costCodeId === null ? undefined : codes.get(l.costCodeId.toLowerCase());
        const qty = roundQty(l.qty);
        const estUnitPrice = roundQty(l.estUnitPrice ?? code?.baselineMatUnit ?? 0);
        return {
            costCodeId: code?.id ?? null,
            descTh: l.descTh !== undefined && l.descTh !== '' ? l.descTh : code?.descTh ?? '',
            descEn: l.descEn !== undefined && l.descEn !== '' ? l.descEn : code?.descEn ?? '',
            unit: l.unit !== undefined && l.unit !== '' ? l.unit : code?.unit ?? '',
            qty, estUnitPrice, estAmount: round2(qty * estUnitPrice), note: l.note ?? '',
        };
    }

    /** A line picked from the BOQ: the quantity that remains of the cost code (never below 0). */
    fromCode(code: CostCode, priorQty: number): DraftRequestLine {
        const qty = Math.max(0, roundQty(code.baselineQty + code.voQty - priorQty));
        const estUnitPrice = roundQty(code.baselineMatUnit);
        return {
            costCodeId: code.id, descTh: code.descTh, descEn: code.descEn, unit: code.unit, qty, estUnitPrice,
            estAmount: round2(qty * estUnitPrice), note: '',
        };
    }

    /** Numbers the lines in order; `orderedQty` 0 (a draft has no PO yet). */
    build(workspaceId: WorkspaceId, requestId: string, lines: readonly DraftRequestLine[]): PurchaseRequestLineRecord[] {
        return lines.map((l, i) => ({ ...l, id: this.ids.newId(), requestId, workspaceId, orderedQty: 0, sort: i + 1 }));
    }

    estTotal(lines: readonly Pick<PurchaseRequestLineRecord, 'estAmount'>[]): number {
        return sumMoney(lines.map(l => l.estAmount));
    }

    /** What other requests of the project hold of each cost code, plus PO lines typed without a request (D-278). */
    async priorQty(workspaceId: WorkspaceId, projectId: ProjectId, costCodeIds: readonly string[], exceptRequestId: string | null): Promise<Map<string, number>> {
        const out = await this.repo.requestedQty(workspaceId, projectId, costCodeIds, exceptRequestId);
        for (const [code, qty] of await this.orders.orderedQty(workspaceId, projectId, costCodeIds, null, true)) {
            out.set(code, roundQty((out.get(code) ?? 0) + qty));
        }
        return out;
    }

    /** Budget warnings of a request's lines against its cost codes, the ledger and the other requests. */
    async warnings(
        workspaceId: WorkspaceId, projectId: ProjectId, requestId: string | null,
        lines: readonly Pick<PurchaseRequestLineRecord, 'costCodeId' | 'qty' | 'estUnitPrice' | 'estAmount'>[],
    ): Promise<BudgetWarning[]> {
        const codeIds = [...new Set(lines.flatMap(l => (l.costCodeId === null ? [] : [l.costCodeId])))];
        if (codeIds.length === 0) return [];
        const codes = await this.costCodes.findMany(workspaceId, projectId, codeIds);
        const ledger = new Map((await this.ledger.totalsByCostCode(workspaceId, projectId)).map(t => [t.costCodeId, t]));
        const prior = await this.priorQty(workspaceId, projectId, codeIds, requestId);
        const check = new Map<string, BudgetCheckCode>(codes.map(c => [c.id, {
            costCodeId: c.id, code: c.code, baselineQty: c.baselineQty, voQty: c.voQty, baselineMatUnit: c.baselineMatUnit,
            materialBudget: materialBudgetOf(c), committedOpen: ledger.get(c.id)?.committedOpen ?? 0, actual: ledger.get(c.id)?.actual ?? 0,
            priorQty: prior.get(c.id) ?? 0,
        }]));
        return budgetWarnings(lines.map(l => ({ costCodeId: l.costCodeId, qty: l.qty, unitPrice: l.estUnitPrice, amount: l.estAmount })), check);
    }
}
