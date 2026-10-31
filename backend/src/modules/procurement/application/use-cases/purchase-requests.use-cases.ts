// ─── Purchase request use cases (docs/erp/04-implementation-plan.md WP-38, docs/erp/02-domain-model.md §7.2) ───
// Read `procurement.read`; create / edit / submit / cancel `procurement.request`.
import { Injectable } from '@nestjs/common';
import type {
    BudgetWarning, CreatePurchaseRequestRequest, PatchPurchaseRequestRequest, PurchaseRequestDto, PurchaseRequestSummaryDto,
    SubmitPurchaseRequestRequest,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import { Approvals, AuditLog, Clock, DocumentNumbering, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId } from '../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../shared/domain/result';
import { requireRequestDraft, requireStatus } from '../../domain/procurement-state';
import { PurchaseRequestRepository, type PurchaseRequestRecord, RfqRepository } from '../ports/procurement.repository';
import { ProcurementViews, requestSummaryDto } from '../procurement-views';
import { type DraftRequestLine, MODULE, ProcurementAccess, PurchaseRequestLines, transact } from '../procurement.service';

const READ = ['procurement.read' as const];
const REQUEST = ['procurement.request' as const];

async function fresh(repo: PurchaseRequestRepository, views: ProcurementViews, grant: ProjectGrant, id: string): Promise<Result<PurchaseRequestDto, DomainError>> {
    const r = await repo.find(id);
    return r === undefined ? err(DomainError.notFound('PurchaseRequest')) : ok(await views.request(r, grant));
}

/** Changed fields of a request for the audit trail. */
function changes(before: PurchaseRequestRecord, after: PurchaseRequestRecord): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of ['requiredDate', 'note', 'overrideReason', 'estTotal'] as const) {
        if (before[key] !== after[key]) out[key] = [before[key], after[key]];
    }
    return out;
}

export const overrideReasonRequired = (warnings: readonly BudgetWarning[]): DomainError =>
    DomainError.unprocessable('Budget warnings need an override reason', { reason: 'override_reason_required', warnings });

// ── reads ──

/** GET /projects/:projectId/purchase-requests — `procurement.read`, newest first. */
@Injectable()
export class ListPurchaseRequestsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: PurchaseRequestRepository) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<PurchaseRequestSummaryDto[], DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const list = await this.repo.listByProjects(ws, [projectId]);
        const counts = await this.repo.lineCounts(ws, list.map(r => r.id));
        return ok(list.map(r => requestSummaryDto(r, counts.get(r.id) ?? 0)));
    }
}

/** GET /purchase-requests/:requestId — `procurement.read`. */
@Injectable()
export class GetPurchaseRequestUseCase {
    constructor(private readonly access: ProcurementAccess, private readonly views: ProcurementViews) {}

    async execute(userId: UserId, requestId: string): Promise<Result<PurchaseRequestDto, DomainError>> {
        const loaded = await this.access.request(userId, requestId, READ, false);
        if (!loaded.ok) return loaded;
        return ok(await this.views.request(loaded.value.doc, loaded.value.grant));
    }
}

// ── writes ──

/**
 * POST /projects/:projectId/purchase-requests — `procurement.request`. From the BOQ: one line per cost code with the
 * quantity that remains (baseline + VO − requested by the project's other live requests); typed lines after them.
 */
@Injectable()
export class CreatePurchaseRequestUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: PurchaseRequestRepository,
        private readonly lines: PurchaseRequestLines,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: CreatePurchaseRequestRequest }): Promise<Result<PurchaseRequestDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: REQUEST, write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const picked = [...new Set((body.costCodeIds ?? []).map(id => id.toLowerCase()))];
        const typed = body.lines ?? [];
        const codes = await this.lines.codes(ws, projectId, [
            ...picked, ...typed.flatMap(l => (l.costCodeId === undefined || l.costCodeId === null ? [] : [l.costCodeId])),
        ]);
        if (!codes.ok) return codes;

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const prior = await this.lines.priorQty(ws, projectId, picked, null);
            const drafts: DraftRequestLine[] = [
                ...picked.flatMap(id => {
                    const code = codes.value.get(id);
                    return code === undefined ? [] : [this.lines.fromCode(code, prior.get(id) ?? 0)];
                }),
                ...typed.map(l => this.lines.fromInput(l, codes.value)),
            ];
            const now = this.clock.now();
            const id = this.ids.newId();
            const stored = this.lines.build(ws, id, drafts);
            const r: PurchaseRequestRecord = {
                id, workspaceId: ws, projectId, number: null, status: 'draft', source: body.source, requiredDate: body.requiredDate ?? null,
                requestedBy: userId, note: body.note ?? '', estTotal: this.lines.estTotal(stored),
                budgetWarnings: await this.lines.warnings(ws, projectId, id, stored), overrideReason: '', submittedAt: null,
                createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insert(r);
            await this.repo.replaceLines(ws, id, stored);
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'purchase_request', entityId: id, action: 'create',
                data: { source: r.source, lines: stored.length, estTotal: r.estTotal },
            });
            return ok(id);
        });
        if (!created.ok) return created;
        return fresh(this.repo, this.views, grant.value, created.value);
    }
}

/** PATCH /purchase-requests/:requestId — `procurement.request`, draft only; `lines` replaces every line. */
@Injectable()
export class PatchPurchaseRequestUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: PurchaseRequestRepository,
        private readonly lines: PurchaseRequestLines,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; requestId: string; body: PatchPurchaseRequestRequest }): Promise<Result<PurchaseRequestDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.request(userId, input.requestId, REQUEST, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const codes = await this.lines.codes(ws, doc.projectId, (body.lines ?? []).flatMap(l => (l.costCodeId === undefined || l.costCodeId === null ? [] : [l.costCodeId])));
        if (!codes.ok) return codes;

        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('PurchaseRequest'));
            const draft = requireRequestDraft(r.status);
            if (!draft.ok) return draft;
            const stored = body.lines === undefined
                ? await this.repo.linesOf(ws, r.id)
                : this.lines.build(ws, r.id, body.lines.map(l => this.lines.fromInput(l, codes.value)));
            if (body.lines !== undefined) await this.repo.replaceLines(ws, r.id, stored);
            const next: PurchaseRequestRecord = {
                ...r,
                requiredDate: body.requiredDate !== undefined ? body.requiredDate : r.requiredDate,
                note: body.note ?? r.note,
                overrideReason: body.overrideReason ?? r.overrideReason,
                estTotal: this.lines.estTotal(stored),
                budgetWarnings: await this.lines.warnings(ws, r.projectId, r.id, stored),
                updatedAt: this.clock.now(),
            };
            await this.repo.save(next);
            const data = changes(r, next);
            if (body.lines !== undefined) data.lines = stored.length;
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: userId, entityType: 'purchase_request', entityId: r.id, action: 'update', data,
            });
            return okVoid();
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/**
 * POST /purchase-requests/:requestId/submit — `procurement.request`, draft only: budget check (warnings need an
 * override reason: 422 `override_reason_required`) → number `PR` → approval `purchase_request.approve`
 * (approved at once by the auto rules → `approved`, else `pending_approval`).
 */
@Injectable()
export class SubmitPurchaseRequestUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: PurchaseRequestRepository,
        private readonly lines: PurchaseRequestLines,
        private readonly numbering: DocumentNumbering,
        private readonly approvals: Approvals,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; requestId: string; body: SubmitPurchaseRequestRequest }): Promise<Result<PurchaseRequestDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.access.request(userId, input.requestId, REQUEST, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;

        const done = await transact(this.uow, async (): Promise<Result<{ pendingRequestId: string | null }, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('PurchaseRequest'));
            const draft = requireRequestDraft(r.status);
            if (!draft.ok) return draft;
            const lines = await this.repo.linesOf(ws, r.id);
            if (lines.length === 0) return err(DomainError.unprocessable('The purchase request has no lines', { reason: 'no_lines' }));
            if (lines.some(l => l.qty <= 0)) {
                return err(DomainError.unprocessable('Every line needs a quantity above 0', { reason: 'quantity_not_positive' }));
            }
            const warnings = await this.lines.warnings(ws, r.projectId, r.id, lines);
            const overrideReason = (body.overrideReason ?? r.overrideReason).trim();
            if (warnings.length > 0 && overrideReason === '') return err(overrideReasonRequired(warnings));

            const now = this.clock.now();
            const issued = await this.numbering.issue({
                workspaceId: ws, docType: 'purchase_request', issueDate: bangkokToday(now), subjectType: 'purchase_request', subjectId: r.id,
                projectId: r.projectId, issuedBy: userId,
            });
            if (!issued.ok) return issued;
            const estTotal = this.lines.estTotal(lines);
            const ticket = await this.approvals.request({
                workspaceId: ws, subject: 'purchase_request.approve', subjectId: r.id, projectId: r.projectId, amount: estTotal,
                title: issued.value.number, requestedBy: userId, requesterRole: grant.role,
            });
            if (!ticket.ok) return ticket;
            const status = ticket.value.status === 'approved' ? 'approved' : 'pending_approval';
            await this.repo.save({
                ...r, number: issued.value.number, status, estTotal, budgetWarnings: warnings,
                overrideReason: warnings.length > 0 ? overrideReason : r.overrideReason, submittedAt: now, updatedAt: now,
            });
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: userId, entityType: 'purchase_request', entityId: r.id, action: 'submit',
                data: {
                    status: [r.status, status], number: issued.value.number, estTotal, warnings: warnings.length,
                    ...(warnings.length > 0 ? { overrideReason } : {}), approvalRequestId: ticket.value.requestId,
                },
            });
            return ok({ pendingRequestId: status === 'pending_approval' ? ticket.value.requestId : null });
        });
        if (!done.ok) return done;
        if (done.value.pendingRequestId !== null) await this.approvals.notifyRequested(done.value.pendingRequestId);
        return fresh(this.repo, this.views, grant, doc.id);
    }
}

/**
 * POST /purchase-requests/:requestId/cancel — `procurement.request`: a draft, one waiting for approval (the request
 * cancelled) or an approved one not on an open RFQ (409 `request_in_rfq`). Its number stays issued.
 */
@Injectable()
export class CancelPurchaseRequestUseCase {
    constructor(
        private readonly access: ProcurementAccess,
        private readonly repo: PurchaseRequestRepository,
        private readonly rfqs: RfqRepository,
        private readonly approvals: Approvals,
        private readonly views: ProcurementViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; requestId: string }): Promise<Result<PurchaseRequestDto, DomainError>> {
        const loaded = await this.access.request(input.userId, input.requestId, REQUEST, true);
        if (!loaded.ok) return loaded;
        const { grant, doc } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const r = await this.repo.lock(ws, doc.id);
            if (r === undefined) return err(DomainError.notFound('PurchaseRequest'));
            const allowed = requireStatus(r.status, ['draft', 'pending_approval', 'approved']);
            if (!allowed.ok) return allowed;
            if (r.status === 'approved') {
                const open = await this.rfqs.withRequest(ws, r.id, ['draft', 'sent', 'awarded']);
                if (open.length > 0) {
                    return err(DomainError.conflict('The purchase request is on an open RFQ', { reason: 'request_in_rfq', count: open.length }));
                }
            }
            if (r.status === 'pending_approval') await this.approvals.cancel(ws, 'purchase_request.approve', r.id, input.userId);
            await this.repo.save({ ...r, status: 'cancelled', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: r.projectId, actor: input.userId, entityType: 'purchase_request', entityId: r.id, action: 'cancel',
                data: { status: [r.status, 'cancelled'] },
            });
            return okVoid();
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, doc.id);
    }
}
