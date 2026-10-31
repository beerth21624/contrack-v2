// ─── RFQ use cases (docs/erp/04-implementation-plan.md WP-38, docs/erp/02-domain-model.md §7.2) ───
// Read `procurement.read`; everything else `procurement.manage`. Suppliers are checked through SupplierLookup
// (of the workspace; an archived one cannot be invited). Awarding makes a PO draft from the winning quote (WP-39).
import { Injectable } from '@nestjs/common';
import {
    type AwardRfqRequest, type CreateRfqRequest, PURCHASE_REQUEST_ORDERABLE_STATUSES, type PatchRfqRequest, type PutRfqQuoteRequest,
    type PutRfqSuppliersRequest, type RfqAwardDto, type RfqCompareDto, type RfqDto, type RfqQuoteLine, type RfqSummaryDto,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { THAI_VAT_RATE, roundQty } from '@contrack/domain/money';
import { orderLineAmount } from '@contrack/domain/procurement/order-totals';
import { compareQuotes, quoteLineAmount, quoteTotals } from '@contrack/domain/procurement/compare';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    AuditLog, Clock, DocumentNumbering, FileService, IdGenerator, type Supplier, SupplierLookup, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../shared/domain/result';
import { requireStatus } from '../../domain/procurement-state';
import {
    PurchaseRequestRepository, type RfqLineRecord, type RfqRecord, RfqRepository, type RfqSupplierRecord,
} from '../ports/procurement.repository';
import { ProcurementViews, rfqSummaryDto } from '../procurement-views';
import { MODULE, ProcurementAccess, transact } from '../procurement.service';
import { type DraftOrderLine, PurchaseOrderWorkflow, orderableSupplier } from '../purchasing.service';

const READ = ['procurement.read' as const];
const MANAGE = ['procurement.manage' as const];

async function fresh(repo: RfqRepository, views: ProcurementViews, grant: ProjectGrant, id: string): Promise<Result<RfqDto, DomainError>> {
    const r = await repo.find(id);
    return r === undefined ? err(DomainError.notFound('Rfq')) : ok(await views.rfq(r, grant));
}

/** Suppliers that may be invited: of the workspace (404 `Supplier`) and not archived (409 `supplier_archived`). */
async function invitable(lookup: SupplierLookup, workspaceId: WorkspaceId, ids: readonly string[]): Promise<Result<Supplier[], DomainError>> {
    const wanted = [...new Set(ids.map(id => id.toLowerCase()))];
    if (wanted.length === 0) return ok([]);
    const found = await lookup.findMany(workspaceId, wanted);
    if (found.length < wanted.length) return err(DomainError.notFound('Supplier'));
    const archived = found.find(s => s.archivedAt !== null);
    if (archived !== undefined) {
        return err(DomainError.conflict('The supplier is archived', { reason: 'supplier_archived', supplierId: archived.id }));
    }
    const byId = new Map(found.map(s => [s.id, s]));
    return ok(wanted.flatMap(id => { const s = byId.get(id); return s === undefined ? [] : [s]; }));
}

// ── reads ──

/** GET /projects/:projectId/rfqs — `procurement.read`, newest first. */
@Injectable()
export class ListRfqsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: RfqRepository) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<RfqSummaryDto[], DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const list = await this.repo.listByProject(ws, projectId);
        const counts = await this.repo.counts(ws, list.map(r => r.id));
        return ok(list.map(r => rfqSummaryDto(r, counts.get(r.id))));
    }
}

/** GET /rfqs/:rfqId — `procurement.read`. */
@Injectable()
export class GetRfqUseCase {
    constructor(private readonly access: ProcurementAccess, private readonly views: ProcurementViews) {}

    async execute(userId: UserId, rfqId: string): Promise<Result<RfqDto, DomainError>> {
        const loaded = await this.access.rfq(userId, rfqId, READ, false);
        if (!loaded.ok) return loaded;
        return ok(await this.views.rfq(loaded.value.doc, loaded.value.grant));
    }
}

/**
 * GET /rfqs/:rfqId/compare — `procurement.read`: lowest unit price per line and the totals per supplier, normalized
 * (lines a supplier does not offer count at the budget). Without VAT.
 */
@Injectable()
export class CompareRfqUseCase {
    constructor(private readonly access: ProcurementAccess, private readonly repo: RfqRepository, private readonly suppliers: SupplierLookup) {}

    async execute(userId: UserId, rfqId: string): Promise<Result<RfqCompareDto, DomainError>> {
        const loaded = await this.access.rfq(userId, rfqId, READ, false);
        if (!loaded.ok) return loaded;
        const r = loaded.value.doc;
        const ws = r.workspaceId;
        const lines = await this.repo.linesOf(ws, r.id);
        const quoted = new Set((await this.repo.suppliersOf(ws, r.id)).filter(s => s.status === 'quoted').map(s => s.supplierId));
        const quotes = (await this.repo.quotesOf(ws, r.id)).filter(q => quoted.has(q.supplierId));
        const names = new Map((quotes.length === 0 ? [] : await this.suppliers.findMany(ws, quotes.map(q => q.supplierId))).map(s => [s.id, s]));
        const result = compareQuotes(
            lines.map(l => ({ id: l.id, qty: l.qty, budgetUnitPrice: l.budgetUnitPrice })),
            quotes.map(q => ({
                supplierId: q.supplierId, pricesIncludeVat: q.pricesIncludeVat, vatRate: q.vat !== 0 ? THAI_VAT_RATE : 0, subtotal: q.subtotal,
                lines: q.lines,
            })),
        );
        const byLine = new Map(lines.map(l => [l.id, l]));
        const bySupplier = new Map(quotes.map(q => [q.supplierId, q]));
        return ok({
            rfqId: r.id,
            lines: result.lines.flatMap(l => {
                const line = byLine.get(l.rfqLineId);
                if (line === undefined) return [];
                return [{
                    ...l, descTh: line.descTh, descEn: line.descEn, unit: line.unit, qty: line.qty, budgetUnitPrice: line.budgetUnitPrice,
                }];
            }),
            suppliers: result.suppliers.flatMap(s => {
                const q = bySupplier.get(s.supplierId);
                if (q === undefined) return [];
                const sup = names.get(s.supplierId);
                return [{
                    ...s, nameTh: sup?.nameTh ?? '', nameEn: sup?.nameEn ?? '', vat: q.vat, total: q.total, deliveryDays: q.deliveryDays,
                    paymentTermDays: q.paymentTermDays, validUntil: q.validUntil,
                }];
            }),
            bestSupplierId: result.bestSupplierId,
            budgetTotal: result.budgetTotal,
        });
    }
}

// ── writes ──

/**
 * POST /projects/:projectId/rfqs — `procurement.manage`: lines from lines of the project's approved purchase requests
 * (409 `request_not_approved`), at the quantity not ordered yet (422 `nothing_remaining` when none), and the
 * suppliers invited.
 */
@Injectable()
export class CreateRfqUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: RfqRepository,
        private readonly requests: PurchaseRequestRepository,
        private readonly suppliers: SupplierLookup,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: CreateRfqRequest }): Promise<Result<RfqDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: MANAGE, write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const invited = await invitable(this.suppliers, ws, body.supplierIds ?? []);
        if (!invited.ok) return invited;

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const lineIds = [...new Set(body.requestLineIds.map(id => id.toLowerCase()))];
            const found = new Map((await this.requests.linesByIds(ws, lineIds)).map(l => [l.id, l]));
            if (found.size < lineIds.length) return err(DomainError.notFound('PurchaseRequestLine'));
            const requestIds = [...new Set([...found.values()].map(l => l.requestId))];
            const requests = await this.requests.findMany(ws, requestIds);
            for (const r of requests) {
                if (r.projectId !== projectId) return err(DomainError.notFound('PurchaseRequestLine'));
                if (!PURCHASE_REQUEST_ORDERABLE_STATUSES.includes(r.status)) {
                    return err(DomainError.conflict('The purchase request is not approved', { reason: 'request_not_approved', requestId: r.id, status: r.status }));
                }
            }
            const now = this.clock.now();
            const id = this.ids.newId();
            const lines: RfqLineRecord[] = [];
            for (const lineId of lineIds) {
                const l = found.get(lineId);
                if (l === undefined) continue;
                const qty = roundQty(l.qty - l.orderedQty);
                if (qty <= 0) return err(DomainError.unprocessable('Nothing remains to order on the line', { reason: 'nothing_remaining', requestLineId: l.id }));
                lines.push({
                    id: this.ids.newId(), rfqId: id, workspaceId: ws, requestLineId: l.id, costCodeId: l.costCodeId, descTh: l.descTh,
                    descEn: l.descEn, unit: l.unit, qty, budgetUnitPrice: l.estUnitPrice, sort: lines.length + 1,
                });
            }
            const numbers = requests.flatMap(r => (r.number === null ? [] : [r.number]));
            const rfq: RfqRecord = {
                id, workspaceId: ws, projectId, number: null, status: 'draft', title: body.title ?? numbers.join(', '),
                dueDate: body.dueDate ?? null, deliveryAddress: body.deliveryAddress ?? '', language: body.language ?? 'th', requestIds,
                awardedSupplierId: null, awardedAt: null, sentAt: null, createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insert(rfq);
            await this.repo.replaceLines(ws, id, lines);
            await this.repo.replaceSuppliers(ws, id, invited.value.map(s => ({
                rfqId: id, supplierId: s.id, workspaceId: ws, status: 'invited', invitedAt: now, quotedAt: null,
            })));
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'rfq', entityId: id, action: 'create',
                data: { requestIds, lines: lines.length, suppliers: invited.value.length },
            });
            return ok(id);
        });
        if (!created.ok) return created;
        return fresh(this.repo, this.views, grant.value, created.value);
    }
}

/** PATCH /rfqs/:rfqId — `procurement.manage`, draft only. */
@Injectable()
export class PatchRfqUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: RfqRepository,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; rfqId: string; body: PatchRfqRequest }): Promise<Result<RfqDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.rfq(userId, input.rfqId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('Rfq'));
            const draft = requireStatus(r.status, ['draft']);
            if (!draft.ok) return draft;
            const data: Record<string, unknown> = {};
            if (body.lines !== undefined) {
                const lines = await this.repo.linesOf(ws, r.id);
                const qty = new Map(body.lines.map(l => [l.id.toLowerCase(), roundQty(l.qty)]));
                if ([...qty.keys()].some(id => !lines.some(l => l.id === id))) return err(DomainError.notFound('RfqLine'));
                await this.repo.replaceLines(ws, r.id, lines.map(l => ({ ...l, qty: qty.get(l.id) ?? l.qty })));
                data.lines = qty.size;
            }
            const next: RfqRecord = {
                ...r,
                title: body.title ?? r.title,
                dueDate: body.dueDate !== undefined ? body.dueDate : r.dueDate,
                deliveryAddress: body.deliveryAddress ?? r.deliveryAddress,
                language: body.language ?? r.language,
                updatedAt: this.clock.now(),
            };
            for (const key of ['title', 'dueDate', 'deliveryAddress', 'language'] as const) {
                if (next[key] !== r[key]) data[key] = [r[key], next[key]];
            }
            await this.repo.save(next);
            await this.audit.record({ workspaceId: ws, projectId: r.projectId, actor: userId, entityType: 'rfq', entityId: r.id, action: 'update', data });
            return okVoid();
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/**
 * PUT /rfqs/:rfqId/suppliers — `procurement.manage`, draft / sent: the whole invited set. A supplier who quoted cannot
 * be removed (409 `supplier_quoted`); suppliers kept keep their status.
 */
@Injectable()
export class PutRfqSuppliersUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: RfqRepository,
        private readonly suppliers: SupplierLookup,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; rfqId: string; body: PutRfqSuppliersRequest }): Promise<Result<RfqDto, DomainError>> {
        const loaded = await this.access.rfq(input.userId, input.rfqId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const wanted = [...new Set(input.body.supplierIds.map(id => id.toLowerCase()))];
        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('Rfq'));
            const open = requireStatus(r.status, ['draft', 'sent']);
            if (!open.ok) return open;
            const current = await this.repo.suppliersOf(ws, r.id);
            const known = new Map(current.map(s => [s.supplierId, s]));
            const removedQuoted = current.find(s => s.status === 'quoted' && !wanted.includes(s.supplierId));
            if (removedQuoted !== undefined) {
                return err(DomainError.conflict('The supplier has quoted', { reason: 'supplier_quoted', supplierId: removedQuoted.supplierId }));
            }
            const added = await invitable(this.suppliers, ws, wanted.filter(id => !known.has(id)));
            if (!added.ok) return added;
            const now = this.clock.now();
            const rows: RfqSupplierRecord[] = wanted.map(id => known.get(id) ?? {
                rfqId: r.id, supplierId: id, workspaceId: ws, status: 'invited', invitedAt: now, quotedAt: null,
            });
            const removed = current.filter(s => !wanted.includes(s.supplierId)).map(s => s.supplierId);
            await this.repo.replaceSuppliers(ws, r.id, rows);
            for (const id of removed) await this.repo.deleteQuote(ws, r.id, id);
            await this.repo.save({ ...r, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: input.userId, entityType: 'rfq', entityId: r.id, action: 'invite',
                data: { added: added.value.map(s => s.id), removed },
            });
            return okVoid();
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/** POST /rfqs/:rfqId/send — `procurement.manage`, draft only: needs lines (`no_lines`) and suppliers (`no_suppliers`); number `RFQ`. */
@Injectable()
export class SendRfqUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: RfqRepository,
        private readonly numbering: DocumentNumbering,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; rfqId: string }): Promise<Result<RfqDto, DomainError>> {
        const loaded = await this.access.rfq(input.userId, input.rfqId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('Rfq'));
            const draft = requireStatus(r.status, ['draft']);
            if (!draft.ok) return draft;
            if ((await this.repo.linesOf(ws, r.id)).length === 0) return err(DomainError.unprocessable('The RFQ has no lines', { reason: 'no_lines' }));
            if ((await this.repo.suppliersOf(ws, r.id)).length === 0) {
                return err(DomainError.unprocessable('Invite at least one supplier', { reason: 'no_suppliers' }));
            }
            const now = this.clock.now();
            const issued = await this.numbering.issue({
                workspaceId: ws, docType: 'rfq', issueDate: bangkokToday(now), subjectType: 'rfq', subjectId: r.id, projectId: r.projectId,
                issuedBy: input.userId,
            });
            if (!issued.ok) return issued;
            await this.repo.save({ ...r, status: 'sent', number: issued.value.number, sentAt: now, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: input.userId, entityType: 'rfq', entityId: r.id, action: 'send',
                data: { status: [r.status, 'sent'], number: issued.value.number },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/** POST /rfqs/:rfqId/cancel — `procurement.manage`, draft / sent. */
@Injectable()
export class CancelRfqUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: RfqRepository,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; rfqId: string }): Promise<Result<RfqDto, DomainError>> {
        const loaded = await this.access.rfq(input.userId, input.rfqId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('Rfq'));
            const allowed = requireStatus(r.status, ['draft', 'sent']);
            if (!allowed.ok) return allowed;
            await this.repo.save({ ...r, status: 'cancelled', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: input.userId, entityType: 'rfq', entityId: r.id, action: 'cancel',
                data: { status: [r.status, 'cancelled'] },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/**
 * PUT /rfqs/:rfqId/quotes/:supplierId — `procurement.manage`, RFQ sent, supplier invited: the prices received
 * (amount = qty × unit price, totals split / add VAT at 7% when the supplier is VAT registered), or `declined`.
 */
@Injectable()
export class PutRfqQuoteUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: RfqRepository,
        private readonly suppliers: SupplierLookup,
        private readonly files: FileService,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; rfqId: string; supplierId: string; body: PutRfqQuoteRequest }): Promise<Result<RfqDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.rfq(userId, input.rfqId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        if (!isUuid(input.supplierId)) return err(DomainError.notFound('Supplier'));
        const supplierId = input.supplierId.toLowerCase();
        const supplier = await this.suppliers.find(ws, supplierId);
        if (supplier === undefined) return err(DomainError.notFound('Supplier'));

        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('Rfq'));
            const sent = requireStatus(r.status, ['sent']);
            if (!sent.ok) return sent;
            const invited = await this.repo.suppliersOf(ws, r.id);
            const row = invited.find(s => s.supplierId === supplierId);
            if (row === undefined) return err(DomainError.notFound('Supplier'));
            const existing = (await this.repo.quotesOf(ws, r.id)).find(q => q.supplierId === supplierId);
            const now = this.clock.now();

            if (body.declined === true) {
                await this.repo.deleteQuote(ws, r.id, supplierId);
                await this.repo.replaceSuppliers(ws, r.id, invited.map(s => (s.supplierId === supplierId ? { ...s, status: 'declined', quotedAt: null } : s)));
                await this.repo.save({ ...r, updatedAt: now });
                await this.audit.record({
                    workspaceId: ws, projectId: r.projectId, actor: userId, entityType: 'rfq', entityId: r.id, action: 'quote',
                    data: { supplierId, declined: true },
                });
                return okVoid();
            }

            const lines = await this.repo.linesOf(ws, r.id);
            const byId = new Map(lines.map(l => [l.id, l]));
            const priced = new Map<string, RfqQuoteLine>();
            for (const l of body.lines) {
                const line = byId.get(l.rfqLineId.toLowerCase());
                if (line === undefined) {
                    return err(DomainError.unprocessable('The line is not on this RFQ', { reason: 'unknown_rfq_line', rfqLineId: l.rfqLineId }));
                }
                const unitPrice = roundQty(l.unitPrice);
                priced.set(line.id, {
                    rfqLineId: line.id, unitPrice, amount: l.available ? quoteLineAmount(line.qty, unitPrice) : 0, available: l.available,
                    note: l.note ?? '',
                });
            }
            const quoteLines = lines.flatMap(l => { const p = priced.get(l.id); return p === undefined ? [] : [p]; });
            const totals = quoteTotals(
                quoteLines.filter(l => l.available).map(l => l.amount), body.pricesIncludeVat, supplier.vatRegistered ? THAI_VAT_RATE : 0,
            );
            const fileIds = [...new Set((body.fileIds ?? existing?.fileIds ?? []).map(id => id.toLowerCase()))];
            const newFiles = fileIds.filter(id => !(existing?.fileIds ?? []).includes(id));
            if (newFiles.length > 0) {
                const mine = await this.files.assertUploadedBy(newFiles, userId);
                if (!mine.ok) return mine;
            }
            await this.repo.upsertQuote({
                id: existing?.id ?? this.ids.newId(), rfqId: r.id, supplierId, workspaceId: ws,
                quoteRef: body.quoteRef ?? existing?.quoteRef ?? '',
                quoteDate: body.quoteDate !== undefined ? body.quoteDate : existing?.quoteDate ?? bangkokToday(now),
                validUntil: body.validUntil !== undefined ? body.validUntil : existing?.validUntil ?? null,
                pricesIncludeVat: body.pricesIncludeVat,
                deliveryDays: body.deliveryDays !== undefined ? body.deliveryDays : existing?.deliveryDays ?? null,
                paymentTermDays: body.paymentTermDays !== undefined ? body.paymentTermDays : existing?.paymentTermDays ?? supplier.creditTermDays,
                lines: quoteLines, ...totals, fileIds, note: body.note ?? existing?.note ?? '',
                createdBy: existing?.createdBy ?? userId, createdAt: existing?.createdAt ?? now, updatedAt: now,
            });
            await this.repo.replaceSuppliers(ws, r.id, invited.map(s => (s.supplierId === supplierId ? { ...s, status: 'quoted', quotedAt: now } : s)));
            await this.repo.save({ ...r, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: userId, entityType: 'rfq', entityId: r.id, action: 'quote',
                data: { supplierId, lines: quoteLines.length, subtotal: [existing?.subtotal ?? null, totals.subtotal], total: totals.total },
            });
            return okVoid();
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/**
 * POST /rfqs/:rfqId/award — `procurement.manage`, RFQ sent: the winning supplier must have quoted (409
 * `supplier_not_quoted`) and not be archived → `awarded`, and a PO draft with the lines it offered (unit prices
 * without VAT, payment term / delivery address / language from the quote and the RFQ) in the same transaction.
 */
@Injectable()
export class AwardRfqUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: RfqRepository,
        private readonly suppliers: SupplierLookup,
        private readonly workflow: PurchaseOrderWorkflow,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; rfqId: string; body: AwardRfqRequest }): Promise<Result<RfqAwardDto, DomainError>> {
        const loaded = await this.access.rfq(input.userId, input.rfqId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const supplierId = input.body.supplierId.toLowerCase();
        return transact(this.uow, async (): Promise<Result<RfqAwardDto, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('Rfq'));
            const sent = requireStatus(r.status, ['sent']);
            if (!sent.ok) return sent;
            const row = (await this.repo.suppliersOf(ws, r.id)).find(s => s.supplierId === supplierId);
            const quote = (await this.repo.quotesOf(ws, r.id)).find(q => q.supplierId === supplierId);
            if (row?.status !== 'quoted' || quote === undefined) {
                return err(DomainError.conflict('The supplier has not quoted', { reason: 'supplier_not_quoted', supplierId }));
            }
            const supplier = await orderableSupplier(this.suppliers, ws, supplierId);
            if (!supplier.ok) return supplier;
            const quoteVat = quote.vat !== 0 ? THAI_VAT_RATE : 0;
            const priced = new Map(quote.lines.filter(l => l.available).map(l => [l.rfqLineId, l]));
            const lines: DraftOrderLine[] = (await this.repo.linesOf(ws, r.id)).flatMap(l => {
                const p = priced.get(l.id);
                if (p === undefined) return [];
                const unitPrice = roundQty(quote.pricesIncludeVat ? p.unitPrice / (1 + quoteVat) : p.unitPrice);
                return [{
                    costCodeId: l.costCodeId, requestLineId: l.requestLineId, descTh: l.descTh, descEn: l.descEn, unit: l.unit, qty: l.qty,
                    unitPrice, amount: orderLineAmount(l.qty, unitPrice),
                }];
            });
            const now = this.clock.now();
            const order = await this.workflow.createDraft({
                workspaceId: ws, projectId: r.projectId, supplier: supplier.value, rfqId: r.id, by: input.userId, lines,
                deliveryAddress: r.deliveryAddress, language: r.language, paymentTermDays: quote.paymentTermDays ?? supplier.value.creditTermDays,
            });
            if (!order.ok) return order;
            await this.repo.save({ ...r, status: 'awarded', awardedSupplierId: supplierId, awardedAt: now, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: input.userId, entityType: 'rfq', entityId: r.id, action: 'award',
                data: { status: [r.status, 'awarded'], supplierId, subtotal: quote.subtotal, total: quote.total, orderId: order.value },
            });
            return ok({ awardedSupplierId: supplierId, orderId: order.value });
        });
    }
}
