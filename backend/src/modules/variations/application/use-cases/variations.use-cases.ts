// ─── Variation order use cases (docs/erp/04-implementation-plan.md WP-33, docs/erp/02-domain-model.md §5) ───
// Read `variations.read`; create / edit / evidence / submit / record the answer / withdraw / cancel `variations.manage`.
// A VO needs the project's signed main contract.
import { Injectable } from '@nestjs/common';
import {
    type AddVariationEvidenceRequest, type ComputeVariationOrderRequest, type CreateVariationOrderRequest, EMPTY_VARIATION_SANDBOX,
    type PatchVariationOrderRequest, type PutVariationOrderLinesRequest, type RecordVariationResponseRequest, type VariationOrderDto,
    type VariationOrderSummaryDto,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { variationLinesFromSandbox } from '@contrack/domain/variations/sandbox';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    Approvals, AuditLog, BaselineControl, Clock, type CostCode, CostCodeLookup, FileService, IdGenerator, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { defaultVariationBilling } from '../../domain/variation-rules';
import { requireDraft, requireStatus } from '../../domain/variation-state';
import { VariationRepository, type VariationRecord } from '../ports/variation.repository';
import { editOptions, seesCost, summaryDto, VariationViews } from '../variation-views';
import { MODULE, type UnpricedLine, VariationAccess, VariationWorkflow, checkBilling, transact } from '../variation.service';

const MANAGE = ['variations.manage' as const];
const READ = ['variations.read' as const];

/** Re-reads a variation after a change. */
async function fresh(repo: VariationRepository, views: VariationViews, grant: ProjectGrant, variationId: string): Promise<Result<VariationOrderDto, DomainError>> {
    const v = await repo.find(variationId);
    return v === undefined ? err(DomainError.notFound('Variation')) : ok(await views.detail(v, editOptions(grant, v)));
}

// ── reads ──

/** GET /projects/:projectId/variations — `variations.read`, newest first. */
@Injectable()
export class ListVariationsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: VariationRepository) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<VariationOrderSummaryDto[], DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const list = await this.repo.listByProject(ws, projectId);
        const counts = await this.repo.counts(ws, list.map(v => v.id));
        return ok(list.map(v => summaryDto(v, counts.get(v.id), { seesCost: seesCost(grant.value), canEdit: false })));
    }
}

/** GET /variations/:variationId — `variations.read`. */
@Injectable()
export class GetVariationUseCase {
    constructor(private readonly variations: VariationAccess, private readonly views: VariationViews) {}

    async execute(userId: UserId, variationId: string): Promise<Result<VariationOrderDto, DomainError>> {
        const loaded = await this.variations.variation(userId, variationId, READ, false);
        if (!loaded.ok) return loaded;
        const { grant, variation } = loaded.value;
        return ok(await this.views.detail(variation, editOptions(grant, variation)));
    }
}

// ── writes ──

/** POST /projects/:projectId/variations — `variations.manage`; the project's contract must be signed. */
@Injectable()
export class CreateVariationUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: VariationRepository,
        private readonly workflow: VariationWorkflow,
        private readonly views: VariationViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: CreateVariationOrderRequest }): Promise<Result<VariationOrderDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: MANAGE, write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const contract = await this.workflow.signedContract(ws, projectId);
        if (!contract.ok) return contract;
        const billing = body.billing ?? defaultVariationBilling(contract.value.billingMode);
        const allowed = checkBilling(contract.value, billing);
        if (!allowed.ok) return allowed;

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const now = this.clock.now();
            const v: VariationRecord = {
                id: this.ids.newId(), workspaceId: ws, projectId, contractId: contract.value.id,
                seqNo: (await this.repo.maxSeq(ws, contract.value.id)) + 1, number: null, title: body.title, reason: body.reason ?? 'owner_request',
                requestedByName: body.requestedByName, requestedDate: body.requestedDate ?? bangkokToday(now), status: 'draft',
                sandbox: structuredClone(EMPTY_VARIATION_SANDBOX), costTotal: 0, sellTotal: 0, vat: 0,
                scheduleImpactDays: body.scheduleImpactDays ?? 0, billing, language: body.language ?? contract.value.language,
                customerSnapshot: null, acceptedAt: null, acceptedByName: '', responseNote: '', submittedAt: null,
                createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insert(v);
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'variation', entityId: v.id, action: 'create',
                data: { contractId: v.contractId, seqNo: v.seqNo, billing, reason: v.reason },
            });
            return ok(v.id);
        });
        if (!created.ok) return created;
        return fresh(this.repo, this.views, grant.value, created.value);
    }
}

/** PATCH /variations/:variationId — `variations.manage`, draft only. */
@Injectable()
export class PatchVariationUseCase {
    constructor(
        private readonly variations: VariationAccess,
        private readonly repo: VariationRepository,
        private readonly workflow: VariationWorkflow,
        private readonly views: VariationViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; variationId: string; body: PatchVariationOrderRequest }): Promise<Result<VariationOrderDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.variations.variation(userId, input.variationId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;

        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(ws, loaded.value.variation.id);
            if (v === undefined) return err(DomainError.notFound('Variation'));
            const draft = requireDraft(v.status);
            if (!draft.ok) return draft;
            if (body.billing !== undefined && body.billing !== v.billing) {
                const contract = await this.workflow.contractOf(v);
                if (contract === undefined) return err(DomainError.notFound('MainContract'));
                const allowed = checkBilling(contract, body.billing);
                if (!allowed.ok) return allowed;
            }
            const next: VariationRecord = {
                ...v,
                title: body.title ?? v.title,
                reason: body.reason ?? v.reason,
                requestedByName: body.requestedByName ?? v.requestedByName,
                requestedDate: body.requestedDate !== undefined ? body.requestedDate : v.requestedDate,
                billing: body.billing ?? v.billing,
                scheduleImpactDays: body.scheduleImpactDays ?? v.scheduleImpactDays,
                language: body.language ?? v.language,
                sandbox: body.sandbox ?? v.sandbox,
                updatedAt: this.clock.now(),
            };
            await this.repo.save(next);
            const changed: Record<string, unknown> = {};
            for (const key of ['title', 'reason', 'requestedByName', 'requestedDate', 'billing', 'scheduleImpactDays', 'language'] as const) {
                if (next[key] !== v[key]) changed[key] = [v[key], next[key]];
            }
            if (body.sandbox !== undefined) changed.sandbox = true;
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: userId, entityType: 'variation', entityId: v.id, action: 'update', data: changed,
            });
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, loaded.value.variation.id);
    }
}

/** Cost code of each BOQ line key (a baseline one first). */
function codesByLineKey(codes: readonly CostCode[]): Map<string, CostCode> {
    const out = new Map<string, CostCode>();
    for (const c of codes) {
        if (c.lineKey === null) continue;
        const known = out.get(c.lineKey);
        if (known === undefined || (known.source !== 'baseline' && c.source === 'baseline')) out.set(c.lineKey, c);
    }
    return out;
}

/** PUT /variations/:variationId/lines — `variations.manage`, draft only: the manual lines as a whole, priced by the server. */
@Injectable()
export class PutVariationLinesUseCase {
    constructor(
        private readonly variations: VariationAccess,
        private readonly repo: VariationRepository,
        private readonly workflow: VariationWorkflow,
        private readonly costCodes: CostCodeLookup,
        private readonly views: VariationViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: { userId: UserId; variationId: string; body: PutVariationOrderLinesRequest }): Promise<Result<VariationOrderDto, DomainError>> {
        const loaded = await this.variations.variation(input.userId, input.variationId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const projectId = loaded.value.variation.projectId;
        const codeIds = [...new Set(input.body.lines.flatMap(l => (l.costCodeId === undefined || l.costCodeId === null ? [] : [l.costCodeId.toLowerCase()])))];
        const codes = new Map((codeIds.length === 0 ? [] : await this.costCodes.findMany(ws, projectId, codeIds)).map(c => [c.id, c]));
        if (codes.size < codeIds.length) return err(DomainError.notFound('CostCode'));

        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(ws, loaded.value.variation.id);
            if (v === undefined) return err(DomainError.notFound('Variation'));
            const draft = requireDraft(v.status);
            if (!draft.ok) return draft;
            const contract = await this.workflow.contractOf(v);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            const kept = (await this.repo.linesOf(ws, v.id)).filter(l => l.source === 'calculator');
            const manual = input.body.lines.map((l): UnpricedLine => {
                const code = l.costCodeId === undefined || l.costCodeId === null ? undefined : codes.get(l.costCodeId.toLowerCase());
                return {
                    id: this.ids.newId(), variationId: v.id, workspaceId: ws, costCodeId: code?.id ?? null,
                    sectionNo: code?.sectionNo ?? l.sectionNo ?? 0, lineKey: code?.lineKey ?? null,
                    descTh: code?.descTh ?? l.descTh ?? '', descEn: code?.descEn ?? l.descEn ?? '', unit: code?.unit ?? l.unit ?? '',
                    qtyDelta: l.qtyDelta, costMatUnit: l.costMatUnit, costLabUnit: l.costLabUnit, source: 'manual',
                };
            });
            const next = await this.workflow.storeLines(v, [...kept, ...manual], await this.workflow.sellFactors(ws, contract), contract.vatRate);
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: input.userId, entityType: 'variation', entityId: v.id, action: 'edit',
                data: { manualLines: manual.length, sellTotal: [v.sellTotal, next.sellTotal] },
            });
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, loaded.value.variation.id);
    }
}

/**
 * POST /variations/:variationId/compute — `variations.manage`, draft only: lays the sandbox (sent, else stored) over
 * the baseline snapshot, recomputes the BOQ and replaces the calculator lines with the difference (manual lines kept).
 */
@Injectable()
export class ComputeVariationUseCase {
    constructor(
        private readonly variations: VariationAccess,
        private readonly repo: VariationRepository,
        private readonly workflow: VariationWorkflow,
        private readonly baseline: BaselineControl,
        private readonly costCodes: CostCodeLookup,
        private readonly views: VariationViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: { userId: UserId; variationId: string; body: ComputeVariationOrderRequest }): Promise<Result<VariationOrderDto, DomainError>> {
        const loaded = await this.variations.variation(input.userId, input.variationId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const projectId = loaded.value.variation.projectId;
        const snapshot = await this.baseline.baselineProject(ws, projectId);
        if (snapshot === undefined) return err(DomainError.conflict('The BOQ baseline is not locked', { reason: 'baseline_not_locked' }));
        const byKey = codesByLineKey(await this.costCodes.listByProject(ws, projectId));

        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(ws, loaded.value.variation.id);
            if (v === undefined) return err(DomainError.notFound('Variation'));
            const draft = requireDraft(v.status);
            if (!draft.ok) return draft;
            const contract = await this.workflow.contractOf(v);
            if (contract === undefined) return err(DomainError.notFound('MainContract'));
            const sandbox = input.body.sandbox ?? v.sandbox;
            const computed = variationLinesFromSandbox(snapshot, sandbox).map((l): UnpricedLine => {
                const code = byKey.get(l.lineKey);
                return {
                    id: this.ids.newId(), variationId: v.id, workspaceId: ws, costCodeId: code?.id ?? null, sectionNo: l.sectionNo,
                    lineKey: l.lineKey, descTh: code?.descTh ?? l.descTh, descEn: code !== undefined && code.descEn !== '' ? code.descEn : l.descEn,
                    unit: l.unit, qtyDelta: l.qtyDelta, costMatUnit: l.costMatUnit, costLabUnit: l.costLabUnit, costAmount: l.costAmount,
                    source: 'calculator',
                };
            });
            const manual = (await this.repo.linesOf(ws, v.id)).filter(l => l.source === 'manual');
            const withSandbox: VariationRecord = { ...v, sandbox };
            const next = await this.workflow.storeLines(withSandbox, [...computed, ...manual], await this.workflow.sellFactors(ws, contract), contract.vatRate);
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: input.userId, entityType: 'variation', entityId: v.id, action: 'compute',
                data: { calculatorLines: computed.length, sellTotal: [v.sellTotal, next.sellTotal] },
            });
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, loaded.value.variation.id);
    }
}

/** POST /variations/:variationId/evidence — `variations.manage`, until the VO is answered; files must be the caller's. */
@Injectable()
export class AddVariationEvidenceUseCase {
    constructor(
        private readonly variations: VariationAccess,
        private readonly repo: VariationRepository,
        private readonly files: FileService,
        private readonly views: VariationViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; variationId: string; body: AddVariationEvidenceRequest }): Promise<Result<VariationOrderDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.variations.variation(userId, input.variationId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const fileId = body.fileId?.toLowerCase();
        if (fileId !== undefined) {
            const mine = await this.files.assertUploadedBy([fileId], userId);
            if (!mine.ok) return mine;
        }

        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(ws, loaded.value.variation.id);
            if (v === undefined) return err(DomainError.notFound('Variation'));
            const open = requireStatus(v.status, ['draft', 'pending_approval', 'submitted']);
            if (!open.ok) return open;
            const now = this.clock.now();
            const id = this.ids.newId();
            await this.repo.insertEvidence({
                id, variationId: v.id, workspaceId: ws, kind: body.kind, fileId: fileId ?? null, note: body.note?.trim() ?? '',
                takenAt: body.takenAt === undefined ? null : new Date(body.takenAt), authorUserId: userId, createdAt: now,
            });
            await this.repo.save({ ...v, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: userId, entityType: 'variation', entityId: v.id, action: 'add_evidence',
                data: { evidenceId: id, kind: body.kind, fileId: fileId ?? null },
            });
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        return fresh(this.repo, this.views, grant, loaded.value.variation.id);
    }
}

/** DELETE /variation-evidence/:evidenceId — `variations.manage`, until the VO is answered. */
@Injectable()
export class DeleteVariationEvidenceUseCase {
    constructor(
        private readonly variations: VariationAccess,
        private readonly repo: VariationRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; evidenceId: string }): Promise<Result<void, DomainError>> {
        const loaded = await this.variations.evidence(input.userId, input.evidenceId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant, evidence } = loaded.value;
        const ws = grant.workspaceId;
        return transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(ws, evidence.variationId);
            if (v === undefined) return err(DomainError.notFound('VariationEvidence'));
            const open = requireStatus(v.status, ['draft', 'pending_approval', 'submitted']);
            if (!open.ok) return open;
            await this.repo.deleteEvidence(ws, evidence.id);
            await this.repo.save({ ...v, updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: input.userId, entityType: 'variation', entityId: v.id, action: 'remove_evidence',
                data: { evidenceId: evidence.id, kind: evidence.kind },
            });
            return ok(undefined);
        });
    }
}

/**
 * POST /variations/:variationId/submit — `variations.manage`, draft only: approval `variation.submit` (skipped by
 * the auto rules / policy off) → `submitted` with its `VO` number, else `pending_approval`.
 */
@Injectable()
export class SubmitVariationUseCase {
    constructor(
        private readonly variations: VariationAccess,
        private readonly repo: VariationRepository,
        private readonly workflow: VariationWorkflow,
        private readonly approvals: Approvals,
        private readonly views: VariationViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; variationId: string }): Promise<Result<VariationOrderDto, DomainError>> {
        const { userId } = input;
        const loaded = await this.variations.variation(userId, input.variationId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;

        const done = await transact(this.uow, async (): Promise<Result<{ pendingRequestId: string | null }, DomainError>> => {
            const v = await this.repo.lock(ws, loaded.value.variation.id);
            if (v === undefined) return err(DomainError.notFound('Variation'));
            const draft = requireDraft(v.status);
            if (!draft.ok) return draft;
            const contract = await this.workflow.contractOf(v);
            if (contract?.status !== 'signed') {
                return err(DomainError.conflict('The project has no signed main contract', { reason: 'contract_not_signed', status: contract?.status ?? 'none' }));
            }
            const allowed = checkBilling(contract, v.billing);
            if (!allowed.ok) return allowed;
            const ticket = await this.approvals.request({
                workspaceId: ws, subject: 'variation.submit', subjectId: v.id, projectId: v.projectId, amount: v.sellTotal,
                title: `${v.title} (#${v.seqNo})`, requestedBy: userId, requesterRole: grant.role,
            });
            if (!ticket.ok) return ticket;
            if (ticket.value.status === 'approved') {
                const submitted = await this.workflow.submitLocked(v, userId);
                if (!submitted.ok) return submitted;
                return ok({ pendingRequestId: null });
            }
            await this.repo.save({ ...v, status: 'pending_approval', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: userId, entityType: 'variation', entityId: v.id, action: 'submit',
                data: { status: [v.status, 'pending_approval'], approvalRequestId: ticket.value.requestId },
            });
            return ok({ pendingRequestId: ticket.value.requestId });
        });
        if (!done.ok) return done;
        if (done.value.pendingRequestId !== null) await this.approvals.notifyRequested(done.value.pendingRequestId);
        return fresh(this.repo, this.views, grant, loaded.value.variation.id);
    }
}

/**
 * POST /variations/:variationId/record-response — `variations.manage`, submitted only: the team records the customer's
 * answer (accept needs ≥ 1 evidence item: 422 `evidence_required`) and its effects apply as with the link.
 */
@Injectable()
export class RecordVariationResponseUseCase {
    constructor(
        private readonly variations: VariationAccess,
        private readonly repo: VariationRepository,
        private readonly workflow: VariationWorkflow,
        private readonly views: VariationViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; variationId: string; body: RecordVariationResponseRequest }): Promise<Result<VariationOrderDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.variations.variation(userId, input.variationId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(ws, loaded.value.variation.id);
            if (v === undefined) return err(DomainError.notFound('Variation'));
            const answered = await this.workflow.respondLocked(v, {
                action: body.action, name: body.name, note: body.note ?? '', at: body.at === undefined ? this.clock.now() : new Date(body.at),
                actor: userId, via: 'recorded',
            });
            return answered.ok ? ok(undefined) : answered;
        });
        if (!done.ok) return done;
        await this.workflow.notifyResponse(ws, loaded.value.variation.id, userId);
        return fresh(this.repo, this.views, grant, loaded.value.variation.id);
    }
}

/**
 * POST /variations/:variationId/withdraw — `variations.manage`: a submitted VO → `withdrawn` (its number stays issued);
 * one waiting for approval goes back to draft (the approval request cancelled).
 */
@Injectable()
export class WithdrawVariationUseCase {
    constructor(
        private readonly variations: VariationAccess,
        private readonly repo: VariationRepository,
        private readonly approvals: Approvals,
        private readonly views: VariationViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; variationId: string }): Promise<Result<VariationOrderDto, DomainError>> {
        const loaded = await this.variations.variation(input.userId, input.variationId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(ws, loaded.value.variation.id);
            if (v === undefined) return err(DomainError.notFound('Variation'));
            const allowed = requireStatus(v.status, ['submitted', 'pending_approval']);
            if (!allowed.ok) return allowed;
            const status = v.status === 'submitted' ? 'withdrawn' : 'draft';
            if (v.status === 'pending_approval') await this.approvals.cancel(ws, 'variation.submit', v.id, input.userId);
            await this.repo.save({ ...v, status, updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: input.userId, entityType: 'variation', entityId: v.id, action: 'withdraw',
                data: { status: [v.status, status] },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, loaded.value.variation.id);
    }
}

/** POST /variations/:variationId/cancel — `variations.manage`: a draft, or one waiting for approval (request cancelled). */
@Injectable()
export class CancelVariationUseCase {
    constructor(
        private readonly variations: VariationAccess,
        private readonly repo: VariationRepository,
        private readonly approvals: Approvals,
        private readonly views: VariationViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; variationId: string }): Promise<Result<VariationOrderDto, DomainError>> {
        const loaded = await this.variations.variation(input.userId, input.variationId, MANAGE, true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const v = await this.repo.lock(ws, loaded.value.variation.id);
            if (v === undefined) return err(DomainError.notFound('Variation'));
            const allowed = requireStatus(v.status, ['draft', 'pending_approval']);
            if (!allowed.ok) return allowed;
            if (v.status === 'pending_approval') await this.approvals.cancel(ws, 'variation.submit', v.id, input.userId);
            await this.repo.save({ ...v, status: 'cancelled', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: input.userId, entityType: 'variation', entityId: v.id, action: 'cancel',
                data: { status: [v.status, 'cancelled'] },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return fresh(this.repo, this.views, grant, loaded.value.variation.id);
    }
}
