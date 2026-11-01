// ─── Supplier bill use cases (docs/erp/04-implementation-plan.md WP-49, docs/erp/02-domain-model.md §10) ───
// Read `payables.read`; create / edit / approve / void `payables.manage`. Approving asks `supplier_bill.approve` (skipped →
// posted at once): number `AP`, fin_events `ap.bill_posted`, cost of price differences / bills without a PO, PO billed.
import { Injectable } from '@nestjs/common';
import {
    type ApproveSupplierBillRequest, type CreateBillFromOrderRequest, type CreateBillFromPayPeriodRequest, type CreateBillFromScClaimRequest,
    type CreateSupplierBillRequest, type PatchSupplierBillRequest, type PayablesDueDto, type PayablesDueQuery,
    PURCHASE_ORDER_ISSUED_STATUSES, SUPPLIER_BILL_OPEN_STATUSES, type SupplierBillDto, type SupplierBillKind, type SupplierBillLineInput,
    type SupplierBillListDto, type SupplierBillListQuery, type SupplierWhtPreset, type VoidSupplierBillRequest,
} from '@contrack/contract';
import { addDays, bangkokToday } from '@contrack/domain/dates/business-date';
import { THAI_VAT_RATE, round2, roundQty, sumMoney } from '@contrack/domain/money';
import { type WorkspaceGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    Approvals, AuditLog, Clock, FileService, IdGenerator, ModuleFlags, PayPeriodPayments, type PurchaseOrderLineInfo, PurchaseOrders,
    SubcontractPayables, type Supplier, SupplierLookup, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../shared/domain/result';
import { requireBillDraft } from '../../domain/payables-state';
import {
    APPROVAL_SUBJECT, BILL_SOURCE, BillLines, BillPosting, BillViews, type DraftBillLine, MANAGE, MODULE, PayablesAccess, READ, billNotFound,
    billTotals, supplierDisplayName, transact, whtRateOf,
} from '../payables.service';
import { type BillLineRecord, type BillRecord, PayablesRepository } from '../ports/payables.repository';

const notBillable = (what: string, status: string): DomainError =>
    DomainError.conflict(`The ${what} cannot be billed while it is ${status}`, { reason: 'not_billable', status });
const alreadyBilled = (billId: string): DomainError =>
    DomainError.conflict('A supplier bill already exists for this document', { reason: 'already_billed', billId });

/** Fields every new bill starts from. */
function blankBill(input: {
    id: string; workspaceId: WorkspaceId; projectId: ProjectId | null; supplierId: string | null; kind: SupplierBillKind; billDate: string;
    dueDate: string; by: UserId; now: Date;
}): BillRecord {
    return {
        id: input.id, workspaceId: input.workspaceId, projectId: input.projectId, supplierId: input.supplierId, payPeriodId: null, kind: input.kind,
        number: null, billDate: input.billDate, supplierInvoiceNo: '', supplierInvoiceDate: null, taxInvoiceNo: '', taxInvoiceDate: null,
        inputVatClaimable: false, status: 'draft', dueDate: input.dueDate, orderId: null, scClaimId: null, vatRate: 0, subtotal: 0, discount: 0,
        vat: 0, total: 0, whtPreset: 'none', whtRate: 0, whtAmount: 0, retentionAmount: 0, payable: 0, paidAmount: 0,
        matchStatus: 'not_applicable', fileIds: [], note: '', approvedBy: null, approvedAt: null, voidedAt: null, voidReason: '',
        createdBy: input.by, createdAt: input.now, updatedAt: input.now,
    };
}

/** The bill's header fields from a request (only those given). */
function headerOf(body: {
    supplierInvoiceNo?: string; supplierInvoiceDate?: string | null; taxInvoiceNo?: string; taxInvoiceDate?: string | null;
    inputVatClaimable?: boolean; note?: string; billDate?: string; dueDate?: string;
}): Partial<BillRecord> {
    const out: Partial<BillRecord> = {};
    if (body.billDate !== undefined) out.billDate = body.billDate;
    if (body.dueDate !== undefined) out.dueDate = body.dueDate;
    if (body.supplierInvoiceNo !== undefined) out.supplierInvoiceNo = body.supplierInvoiceNo;
    if (body.supplierInvoiceDate !== undefined) out.supplierInvoiceDate = body.supplierInvoiceDate;
    if (body.taxInvoiceNo !== undefined) out.taxInvoiceNo = body.taxInvoiceNo;
    if (body.taxInvoiceDate !== undefined) out.taxInvoiceDate = body.taxInvoiceDate;
    if (body.inputVatClaimable !== undefined) out.inputVatClaimable = body.inputVatClaimable;
    if (body.note !== undefined) out.note = body.note;
    return out;
}

/** Due date: invoice date (else bill date) + payment term days. */
const dueOf = (b: Pick<BillRecord, 'supplierInvoiceDate' | 'billDate'>, termDays: number): string =>
    addDays(b.supplierInvoiceDate ?? b.billDate, Math.max(0, termDays));

/** Supplier of the workspace that may receive a new bill (archived → 409 `supplier_archived`). */
async function billableSupplier(suppliers: SupplierLookup, workspaceId: WorkspaceId, supplierId: string): Promise<Result<Supplier, DomainError>> {
    const s = await suppliers.find(workspaceId, supplierId);
    if (s === undefined) return err(DomainError.notFound('Supplier'));
    if (s.archivedAt !== null) return err(DomainError.conflict('The supplier is archived', { reason: 'supplier_archived' }));
    return ok(s);
}

/** Files sent with a request that are not on the bill yet must be the caller's uploads. */
async function checkFiles(files: FileService, ids: readonly string[] | undefined, known: readonly string[], userId: UserId): Promise<Result<string[] | undefined, DomainError>> {
    if (ids === undefined) return ok(undefined);
    const list = [...new Set(ids.map(f => f.toLowerCase()))];
    const fresh = list.filter(f => !known.includes(f));
    if (fresh.length > 0) {
        const owned = await files.assertUploadedBy(fresh, userId);
        if (!owned.ok) return owned;
    }
    return ok(list);
}

/** Totals of a bill from its lines and money fields; sets the amounts on the record. */
function withTotals(b: BillRecord, lines: readonly Pick<BillLineRecord, 'amount'>[], opts: { vat?: number; wht?: number } = {}): Result<BillRecord, DomainError> {
    const totals = billTotals({
        amounts: lines.map(l => l.amount), discount: b.discount, vatRate: b.vatRate, vat: opts.vat, whtRate: b.whtRate, wht: opts.wht,
        retention: b.retentionAmount,
    });
    if (!totals.ok) return totals;
    return ok({ ...b, ...totals.value });
}

/** Default "input VAT claimable": a tax invoice number and VAT on the bill. */
const claimableDefault = (b: Pick<BillRecord, 'taxInvoiceNo' | 'vat'>): boolean => b.taxInvoiceNo !== '' && b.vat > 0;

/** Saves a new bill with its lines (duplicate invoice number checked under the workspace lock); returns its id. */
async function insertBill(
    repo: PayablesRepository, lines: BillLines, audit: AuditLog, bill: BillRecord, rows: readonly BillLineRecord[], by: UserId,
    data: Record<string, unknown>,
): Promise<Result<string, DomainError>> {
    await repo.lockWorkspace(bill.workspaceId);
    const unique = await lines.uniqueInvoice(repo, bill);
    if (!unique.ok) return unique;
    await repo.insert(bill, rows);
    await audit.record({
        workspaceId: bill.workspaceId, projectId: bill.projectId, actor: by, entityType: BILL_SOURCE, entityId: bill.id, action: 'create',
        data: { kind: bill.kind, total: bill.total, payable: bill.payable, matchStatus: bill.matchStatus, ...data },
    });
    return ok(bill.id);
}

async function freshDetail(repo: PayablesRepository, views: BillViews, grant: WorkspaceGrant, id: string): Promise<Result<SupplierBillDto, DomainError>> {
    const b = await repo.find(id);
    return b === undefined ? err(billNotFound()) : ok(await views.detail(b, grant.role));
}

// ── reads ──

/** GET /workspaces/:workspaceId/supplier-bills?status=&kind=&supplierId=&projectId= — `payables.read`, newest first. */
@Injectable()
export class ListSupplierBillsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: PayablesRepository, private readonly views: BillViews) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: SupplierBillListQuery): Promise<Result<SupplierBillListDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, READ);
        if (!grant.ok) return grant;
        const list = await this.repo.list(workspaceId, {
            statuses: query.status, kind: query.kind, supplierId: query.supplierId?.toLowerCase(),
            projectId: query.projectId?.toLowerCase() as ProjectId | undefined,
        });
        return ok({ items: await this.views.summaries(workspaceId, list) });
    }
}

/** GET /supplier-bills/:billId — `payables.read`. */
@Injectable()
export class GetSupplierBillUseCase {
    constructor(private readonly access: PayablesAccess, private readonly views: BillViews) {}

    async execute(userId: UserId, billId: string): Promise<Result<SupplierBillDto, DomainError>> {
        const loaded = await this.access.bill(userId, billId, READ);
        if (!loaded.ok) return loaded;
        return ok(await this.views.detail(loaded.value.bill, loaded.value.grant.role));
    }
}

/**
 * GET /workspaces/:workspaceId/payables/due?within=30 — `payables.read`: posted bills not paid due by today + within
 * (overdue too), plus approved subcontract claims and pay periods not billed yet.
 */
@Injectable()
export class GetPayablesDueUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: PayablesRepository,
        private readonly views: BillViews,
        private readonly scPayables: SubcontractPayables,
        private readonly periods: PayPeriodPayments,
        private readonly suppliers: SupplierLookup,
        private readonly flags: ModuleFlags,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: PayablesDueQuery): Promise<Result<PayablesDueDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, READ);
        if (!grant.ok) return grant;
        const today = bangkokToday(this.clock.now());
        const open = (await this.repo.list(workspaceId, { statuses: SUPPLIER_BILL_OPEN_STATUSES, dueTo: addDays(today, query.within) }))
            .filter(b => round2(b.payable - b.paidAmount) > 0)
            .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
        const left = (b: BillRecord): number => round2(b.payable - b.paidAmount);

        const claims = await this.scPayables.listApprovedUnpaid(workspaceId);
        const billed = await this.repo.billedClaims(workspaceId, claims.map(c => c.claimId));
        const scClaims = [];
        for (const c of claims.filter(x => !billed.has(x.claimId))) {
            const supplier = await this.suppliers.findByScVendorEntry(workspaceId, c.vendorListEntryId);
            scClaims.push({
                claimId: c.claimId, subcontractId: c.subcontractId, projectId: c.projectId, contractNo: c.contractNo, title: c.title,
                vendorName: c.vendorName, supplierId: supplier?.id ?? null, installmentNo: c.installmentNo, approvedOn: c.approvedOn,
                gross: c.gross, retention: c.retention, wht: c.wht, vat: c.vat, net: c.net,
            });
        }
        const payPeriods = (await this.flags.isEnabled(workspaceId, 'labour'))
            ? (await this.periods.approvedUnbilled(workspaceId)).map(p => ({
                periodId: p.id, periodKey: p.periodKey, startDate: p.startDate, endDate: p.endDate, net: p.net,
            }))
            : [];
        return ok({
            bills: await this.views.summaries(workspaceId, open),
            totalDue: sumMoney(open.map(left)),
            totalOverdue: sumMoney(open.filter(b => b.dueDate < today).map(left)),
            scClaims,
            payPeriods,
        });
    }
}

// ── create ──

/** POST /workspaces/:workspaceId/supplier-bills — `payables.manage`: a typed bill (material without a PO, service, expense). */
@Injectable()
export class CreateSupplierBillUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly payablesAccess: PayablesAccess,
        private readonly repo: PayablesRepository,
        private readonly lines: BillLines,
        private readonly views: BillViews,
        private readonly suppliers: SupplierLookup,
        private readonly files: FileService,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, body: CreateSupplierBillRequest): Promise<Result<SupplierBillDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, MANAGE);
        if (!grant.ok) return grant;
        let projectId: ProjectId | null = null;
        if (body.projectId !== undefined && body.projectId !== null) {
            const project = await this.payablesAccess.project(userId, workspaceId, body.projectId);
            if (!project.ok) return project;
            projectId = project.value;
        }
        const supplier = await billableSupplier(this.suppliers, workspaceId, body.supplierId);
        if (!supplier.ok) return supplier;
        const fileIds = await checkFiles(this.files, body.fileIds, [], userId);
        if (!fileIds.ok) return fileIds;

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const drafts = await this.lines.fromInput(workspaceId, projectId, body.kind, body.lines ?? [], []);
            if (!drafts.ok) return drafts;
            const now = this.clock.now();
            const id = this.ids.newId();
            const s = supplier.value;
            let bill: BillRecord = {
                ...blankBill({ id, workspaceId, projectId, supplierId: s.id, kind: body.kind, billDate: bangkokToday(now), dueDate: '', by: userId, now }),
                ...headerOf(body),
                vatRate: body.vatRate ?? (s.vatRegistered ? THAI_VAT_RATE : 0),
                discount: round2(body.discount ?? 0),
                whtPreset: body.whtPreset ?? s.defaultWhtPreset,
                fileIds: fileIds.value ?? [],
            };
            bill = { ...bill, whtRate: whtRateOf(bill.whtPreset), dueDate: body.dueDate ?? dueOf(bill, s.creditTermDays) };
            const rows = this.lines.build(workspaceId, id, drafts.value);
            const totals = withTotals(bill, rows, { vat: body.vat });
            if (!totals.ok) return totals;
            bill = { ...totals.value, inputVatClaimable: body.inputVatClaimable ?? claimableDefault(totals.value) };
            return insertBill(this.repo, this.lines, this.audit, bill, rows, userId, {});
        });
        if (!created.ok) return created;
        return freshDetail(this.repo, this.views, grant.value, created.value);
    }
}

/**
 * POST /purchase-orders/:orderId/bill — `payables.manage` in the PO's workspace: a material bill of an issued PO.
 * Without `lines`: each PO line's received − billed quantity at the PO price (422 `nothing_received` when none).
 */
@Injectable()
export class CreateBillFromOrderUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly payablesAccess: PayablesAccess,
        private readonly repo: PayablesRepository,
        private readonly orders: PurchaseOrders,
        private readonly lines: BillLines,
        private readonly views: BillViews,
        private readonly suppliers: SupplierLookup,
        private readonly files: FileService,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, orderId: string, body: CreateBillFromOrderRequest): Promise<Result<SupplierBillDto, DomainError>> {
        const notFound = (): DomainError => DomainError.notFound('PurchaseOrder');
        const ws = await this.orders.locate(orderId);
        if (ws === undefined) return err(notFound());
        const grant = await this.access.inWorkspace(userId, ws, MODULE, MANAGE);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(notFound()) : grant;
        const po = await this.orders.find(ws, orderId);
        if (po === undefined) return err(notFound());
        const project = await this.payablesAccess.project(userId, ws, po.projectId);
        if (!project.ok) return project;
        if (!PURCHASE_ORDER_ISSUED_STATUSES.includes(po.status)) return err(notBillable('purchase order', po.status));
        const supplier = await this.suppliers.find(ws, po.supplierId);
        if (supplier === undefined) return err(DomainError.notFound('Supplier'));
        const fileIds = await checkFiles(this.files, body.fileIds, [], userId);
        if (!fileIds.ok) return fileIds;

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const orderLines = await this.orders.linesWithReceived(ws, po.id);
            const open = (l: PurchaseOrderLineInfo): number => roundQty(l.receivedQty - l.billedQty);
            const inputs: SupplierBillLineInput[] = body.lines
                ?? orderLines.filter(l => open(l) > 0).map(l => ({ orderLineId: l.id, qty: open(l) }));
            if (inputs.length === 0) {
                return err(DomainError.unprocessable('Nothing received is waiting to be billed', { reason: 'nothing_received' }));
            }
            const drafts = await this.lines.fromInput(ws, po.projectId, 'material', inputs, orderLines);
            if (!drafts.ok) return drafts;
            const now = this.clock.now();
            const id = this.ids.newId();
            const built = this.lines.build(ws, id, drafts.value);
            const matched = this.lines.match(po.id, built, orderLines);
            // Default discount: the PO's, in proportion to the PO value billed.
            const discount = body.discount ?? (po.subtotal > 0 ? round2(po.discount * sumMoney(built.map(l => l.amount)) / po.subtotal) : 0);
            let bill: BillRecord = {
                ...blankBill({ id, workspaceId: ws, projectId: po.projectId, supplierId: po.supplierId, kind: 'material', billDate: bangkokToday(now), dueDate: '', by: userId, now }),
                ...headerOf(body),
                orderId: po.id,
                vatRate: body.vatRate ?? po.vatRate,
                discount: Math.min(round2(discount), sumMoney(built.map(l => l.amount))),
                whtPreset: body.whtPreset ?? po.whtPreset,
                matchStatus: matched.status,
                fileIds: fileIds.value ?? [],
            };
            bill = { ...bill, whtRate: whtRateOf(bill.whtPreset), dueDate: body.dueDate ?? dueOf(bill, po.paymentTermDays ?? supplier.creditTermDays) };
            const totals = withTotals(bill, matched.lines, { vat: body.vat });
            if (!totals.ok) return totals;
            bill = { ...totals.value, inputVatClaimable: body.inputVatClaimable ?? claimableDefault(totals.value) };
            return insertBill(this.repo, this.lines, this.audit, bill, matched.lines, userId, { orderId: po.id });
        });
        if (!created.ok) return created;
        return freshDetail(this.repo, this.views, grant.value, created.value);
    }
}

/**
 * POST /workspaces/:workspaceId/supplier-bills/from-sc-claim — `payables.manage`: a subcontract bill of an approved claim
 * (amounts as approved: retention, WHT, VAT; payable = the claim's net). 409 `already_billed`, 409 `not_billable` (not
 * approved), 422 `supplier_required` when the vendor has no supplier in the register and none is given.
 */
@Injectable()
export class CreateBillFromScClaimUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly payablesAccess: PayablesAccess,
        private readonly repo: PayablesRepository,
        private readonly scPayables: SubcontractPayables,
        private readonly lines: BillLines,
        private readonly views: BillViews,
        private readonly suppliers: SupplierLookup,
        private readonly files: FileService,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, body: CreateBillFromScClaimRequest): Promise<Result<SupplierBillDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, MANAGE);
        if (!grant.ok) return grant;
        const claim = await this.scPayables.find(workspaceId, body.claimId);
        if (claim === undefined) return err(DomainError.notFound('Claim'));
        if (claim.status !== 'approved') return err(notBillable('claim', claim.status));
        const project = await this.payablesAccess.project(userId, workspaceId, claim.projectId);
        if (!project.ok) return project;
        let supplier: Supplier | undefined;
        if (body.supplierId !== undefined) {
            const picked = await billableSupplier(this.suppliers, workspaceId, body.supplierId);
            if (!picked.ok) return picked;
            supplier = picked.value;
        } else {
            supplier = await this.suppliers.findByScVendorEntry(workspaceId, claim.vendorListEntryId);
        }
        if (supplier === undefined) {
            return err(DomainError.unprocessable('Pick the supplier of this subcontractor', { reason: 'supplier_required', vendorName: claim.vendorName }));
        }
        const s = supplier;
        const fileIds = await checkFiles(this.files, body.fileIds, [], userId);
        if (!fileIds.ok) return fileIds;

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            await this.repo.lockWorkspace(workspaceId);
            const billed = await this.repo.billedClaims(workspaceId, [claim.claimId]);
            if (billed.has(claim.claimId)) return err(alreadyBilled(claim.claimId));
            const now = this.clock.now();
            const id = this.ids.newId();
            const draft: DraftBillLine = {
                orderLineId: null, costCodeId: null, category: 'subcontract', desc: `${claim.contractNo} #${claim.installmentNo}`, unit: '',
                qty: 1, unitPrice: claim.base, amount: round2(claim.base),
            };
            const rows = this.lines.build(workspaceId, id, [draft]);
            const preset: SupplierWhtPreset = claim.wht > 0 ? 'service' : 'none';
            let bill: BillRecord = {
                ...blankBill({ id, workspaceId, projectId: claim.projectId, supplierId: s.id, kind: 'subcontract', billDate: bangkokToday(now), dueDate: '', by: userId, now }),
                ...headerOf(body),
                scClaimId: claim.claimId,
                vatRate: claim.vat > 0 ? THAI_VAT_RATE : 0,
                whtPreset: preset,
                whtRate: claim.whtPct,
                retentionAmount: claim.retention,
                fileIds: fileIds.value ?? [],
            };
            bill = { ...bill, dueDate: body.dueDate ?? dueOf(bill, s.creditTermDays) };
            const totals = withTotals(bill, rows, { vat: claim.vat, wht: claim.wht });
            if (!totals.ok) return totals;
            bill = { ...totals.value, inputVatClaimable: body.inputVatClaimable ?? claimableDefault(totals.value) };
            return insertBill(this.repo, this.lines, this.audit, bill, rows, userId, { claimId: claim.claimId });
        });
        if (!created.ok) return created;
        return freshDetail(this.repo, this.views, grant.value, created.value);
    }
}

/**
 * POST /workspaces/:workspaceId/supplier-bills/from-pay-period — `payables.manage`: the labour bill of an approved pay
 * period (no supplier, no VAT / WHT, payable = the period's net). 409 `already_billed`, 409 `not_billable`.
 */
@Injectable()
export class CreateBillFromPayPeriodUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: PayablesRepository,
        private readonly periods: PayPeriodPayments,
        private readonly lines: BillLines,
        private readonly views: BillViews,
        private readonly audit: AuditLog,
        private readonly ids: IdGenerator,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, body: CreateBillFromPayPeriodRequest): Promise<Result<SupplierBillDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, MANAGE);
        if (!grant.ok) return grant;
        const period = await this.periods.find(workspaceId, body.periodId);
        if (period === undefined) return err(DomainError.notFound('PayPeriod'));

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            await this.repo.lockWorkspace(workspaceId);
            const existing = await this.repo.findByPayPeriod(workspaceId, period.id);
            if (existing !== undefined) return err(alreadyBilled(existing.id));
            if (period.status !== 'approved') return err(notBillable('pay period', period.status));
            const now = this.clock.now();
            const id = this.ids.newId();
            const billDate = body.billDate ?? bangkokToday(now);
            const payDay = addDays(period.endDate, 1);
            const draft: DraftBillLine = {
                orderLineId: null, costCodeId: null, category: 'labour', desc: period.periodKey, unit: '', qty: 1, unitPrice: period.net,
                amount: round2(period.net),
            };
            const rows = this.lines.build(workspaceId, id, [draft]);
            const bill: BillRecord = {
                ...blankBill({
                    id, workspaceId, projectId: null, supplierId: null, kind: 'labour', billDate,
                    dueDate: body.dueDate ?? (payDay > billDate ? payDay : billDate), by: userId, now,
                }),
                payPeriodId: period.id,
                note: body.note ?? '',
            };
            const totals = withTotals(bill, rows);
            if (!totals.ok) return totals;
            return insertBill(this.repo, this.lines, this.audit, totals.value, rows, userId, { periodKey: period.periodKey });
        });
        if (!created.ok) return created;
        return freshDetail(this.repo, this.views, grant.value, created.value);
    }
}

// ── change ──

/**
 * PATCH /supplier-bills/:billId — `payables.manage`, draft only. Subcontract / labour bills keep their amounts (422
 * `action_not_supported` for lines / money fields / project); a PO bill keeps its project. Totals and the 3-way match
 * are recomputed when lines or money fields change.
 */
@Injectable()
export class PatchSupplierBillUseCase {
    constructor(
        private readonly access: PayablesAccess,
        private readonly repo: PayablesRepository,
        private readonly lines: BillLines,
        private readonly views: BillViews,
        private readonly suppliers: SupplierLookup,
        private readonly files: FileService,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, billId: string, body: PatchSupplierBillRequest): Promise<Result<SupplierBillDto, DomainError>> {
        const loaded = await this.access.bill(userId, billId, MANAGE);
        if (!loaded.ok) return loaded;
        const { grant, bill: found } = loaded.value;
        const ws = found.workspaceId;
        const money = body.lines !== undefined || body.vat !== undefined || body.vatRate !== undefined || body.discount !== undefined
            || body.whtPreset !== undefined;
        const fixedAmounts = found.kind === 'subcontract' || found.kind === 'labour';
        const projectChange = body.projectId !== undefined && (body.projectId?.toLowerCase() ?? null) !== found.projectId;
        if ((fixedAmounts && (money || projectChange)) || (found.orderId !== null && projectChange)) {
            return err(DomainError.unprocessable('This bill keeps its amounts and project', { reason: 'action_not_supported' }));
        }
        let projectId = found.projectId;
        if (projectChange) {
            if (body.projectId === null || body.projectId === undefined) projectId = null;
            else {
                const project = await this.access.project(userId, ws, body.projectId);
                if (!project.ok) return project;
                projectId = project.value;
            }
        }
        const fileIds = await checkFiles(this.files, body.fileIds, found.fileIds, userId);
        if (!fileIds.ok) return fileIds;

        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            await this.repo.lockWorkspace(ws);
            const b = await this.repo.lock(ws, found.id);
            if (b === undefined) return err(billNotFound());
            const draft = requireBillDraft(b.status);
            if (!draft.ok) return draft;
            const now = this.clock.now();
            let next: BillRecord = { ...b, ...headerOf(body), projectId, updatedAt: now };
            if (fileIds.value !== undefined) next.fileIds = fileIds.value;
            if (body.vatRate !== undefined) next.vatRate = body.vatRate;
            if (body.discount !== undefined) next.discount = round2(body.discount);
            if (body.whtPreset !== undefined) next = { ...next, whtPreset: body.whtPreset, whtRate: whtRateOf(body.whtPreset) };
            if (body.supplierInvoiceDate !== undefined && body.dueDate === undefined && b.supplierId !== null && !fixedAmounts) {
                const s = await this.suppliers.find(ws, b.supplierId);
                if (s !== undefined && b.orderId === null) next.dueDate = dueOf(next, s.creditTermDays);
            }

            let rows = await this.repo.linesOf(ws, b.id);
            if (body.lines !== undefined) {
                const orderLines = await this.lines.orderLines(ws, b.orderId);
                const drafts = await this.lines.fromInput(ws, projectId, b.kind, body.lines, orderLines);
                if (!drafts.ok) return drafts;
                rows = this.lines.build(ws, b.id, drafts.value);
            } else if (projectChange) {
                const codes = await this.lines.checkCostCodes(ws, projectId, rows);
                if (!codes.ok) return codes;
            }
            if (!fixedAmounts) {
                const matched = this.lines.match(b.orderId, rows, await this.lines.orderLines(ws, b.orderId));
                rows = matched.lines;
                next.matchStatus = matched.status;
                // A VAT typed from the invoice stays until money fields change; then it is recomputed unless sent.
                const totals = withTotals(next, rows, { vat: body.vat ?? (money ? undefined : b.vat) });
                if (!totals.ok) return totals;
                next = totals.value;
                if (body.inputVatClaimable === undefined && (body.taxInvoiceNo !== undefined || money)) next.inputVatClaimable = claimableDefault(next);
                await this.repo.replaceLines(ws, b.id, rows);
            }
            const unique = await this.lines.uniqueInvoice(this.repo, next);
            if (!unique.ok) return unique;
            await this.repo.save(next);
            const changes: Record<string, [unknown, unknown]> = {};
            for (const k of ['supplierInvoiceNo', 'taxInvoiceNo', 'billDate', 'dueDate', 'projectId', 'total', 'payable', 'matchStatus'] as const) {
                if (b[k] !== next[k]) changes[k] = [b[k], next[k]];
            }
            await this.audit.record({ workspaceId: ws, projectId: next.projectId, actor: userId, entityType: BILL_SOURCE, entityId: b.id, action: 'edit', data: changes });
            return okVoid();
        });
        if (!done.ok) return done;
        return freshDetail(this.repo, this.views, grant, found.id);
    }
}

/**
 * POST /supplier-bills/:billId/approve — `payables.manage`, draft: asks `supplier_bill.approve` (amount = total);
 * skipped → posted at once, else pending_approval. 422 `no_lines`; 422 `match_note_required` when the 3-way match has
 * exceptions and the bill has no note; 409 `not_billable` when its claim / pay period is no longer approved.
 */
@Injectable()
export class ApproveSupplierBillUseCase {
    constructor(
        private readonly access: PayablesAccess,
        private readonly repo: PayablesRepository,
        private readonly lines: BillLines,
        private readonly posting: BillPosting,
        private readonly views: BillViews,
        private readonly approvals: Approvals,
        private readonly scPayables: SubcontractPayables,
        private readonly periods: PayPeriodPayments,
        private readonly suppliers: SupplierLookup,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, billId: string, body: ApproveSupplierBillRequest): Promise<Result<SupplierBillDto, DomainError>> {
        const loaded = await this.access.bill(userId, billId, MANAGE);
        if (!loaded.ok) return loaded;
        const { grant, bill: found } = loaded.value;
        const ws = found.workspaceId;

        const done = await transact(this.uow, async (): Promise<Result<string | null, DomainError>> => {
            await this.repo.lockWorkspace(ws);
            const locked = await this.repo.lock(ws, found.id);
            if (locked === undefined) return err(billNotFound());
            const draft = requireBillDraft(locked.status);
            if (!draft.ok) return draft;
            const now = this.clock.now();
            let b: BillRecord = body.note !== undefined && body.note !== '' ? { ...locked, note: body.note, updatedAt: now } : locked;

            const rows = await this.repo.linesOf(ws, b.id);
            if (rows.length === 0) return err(DomainError.unprocessable('The bill has no lines', { reason: 'no_lines' }));
            const matched = this.lines.match(b.orderId, rows, await this.lines.orderLines(ws, b.orderId));
            if (matched.status === 'exceptions' && b.note.trim() === '') {
                return err(DomainError.unprocessable('Explain the 3-way match exceptions in the note', {
                    reason: 'match_note_required', lines: matched.lines.filter(l => l.match === 'qty_exceeds_received' || l.match === 'price_differs').map(l => l.id),
                }));
            }
            await this.repo.saveLines(matched.lines);
            b = { ...b, matchStatus: matched.status };
            if (b.scClaimId !== null) {
                const claim = await this.scPayables.find(ws, b.scClaimId);
                if (claim?.status !== 'approved') return err(notBillable('claim', claim?.status ?? 'unknown'));
            }
            if (b.payPeriodId !== null) {
                const period = await this.periods.find(ws, b.payPeriodId);
                if (period?.status !== 'approved') return err(notBillable('pay period', period?.status ?? 'unknown'));
            }
            const unique = await this.lines.uniqueInvoice(this.repo, b);
            if (!unique.ok) return unique;

            const supplier = b.supplierId === null ? undefined : await this.suppliers.find(ws, b.supplierId);
            const title = [b.supplierInvoiceNo, supplierDisplayName(supplier)].filter(x => x !== '').join(' · ') || b.kind;
            const ticket = await this.approvals.request({
                workspaceId: ws, subject: APPROVAL_SUBJECT, subjectId: b.id, projectId: b.projectId, amount: b.total, title,
                requestedBy: userId, requesterRole: grant.role,
            });
            if (!ticket.ok) return ticket;
            if (ticket.value.status === 'approved') {
                const posted = await this.posting.post(b, userId);
                return posted.ok ? ok(null) : posted;
            }
            await this.repo.save({ ...b, status: 'pending_approval', updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: b.projectId, actor: userId, entityType: BILL_SOURCE, entityId: b.id, action: 'submit',
                data: { status: ['draft', 'pending_approval'], total: b.total, approvalRequestId: ticket.value.requestId },
            });
            return ok(ticket.value.requestId);
        });
        if (!done.ok) return done;
        if (done.value !== null) await this.approvals.notifyRequested(done.value);
        return freshDetail(this.repo, this.views, grant, found.id);
    }
}

/**
 * POST /supplier-bills/:billId/void {reason} — `payables.manage`: draft / pending / approved (not scheduled or paid).
 * A posted bill is reversed (fin_events, cost, PO billed quantities, number voided).
 */
@Injectable()
export class VoidSupplierBillUseCase {
    constructor(
        private readonly access: PayablesAccess,
        private readonly repo: PayablesRepository,
        private readonly posting: BillPosting,
        private readonly views: BillViews,
        private readonly uow: UnitOfWork,
    ) {}

    async execute(userId: UserId, billId: string, body: VoidSupplierBillRequest): Promise<Result<SupplierBillDto, DomainError>> {
        const loaded = await this.access.bill(userId, billId, MANAGE);
        if (!loaded.ok) return loaded;
        const { grant, bill: found } = loaded.value;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const b = await this.repo.lock(found.workspaceId, found.id);
            if (b === undefined) return err(billNotFound());
            const voided = await this.posting.void(b, body.reason, userId);
            return voided.ok ? okVoid() : voided;
        });
        if (!done.ok) return done;
        return freshDetail(this.repo, this.views, grant, found.id);
    }
}

