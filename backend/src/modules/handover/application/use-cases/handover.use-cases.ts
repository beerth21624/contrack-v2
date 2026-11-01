// ─── Handover use cases (docs/erp/04-implementation-plan.md WP-53, docs/erp/02-domain-model.md §11) ───
// Read `handover.read`; create / edit / schedule / inspect / accept / reject / documents `handover.manage`. A handover
// needs the project's main contract `signed` (409 `contract_not_signed`). Scheduling moves the project to `handover`;
// accepting (one transaction) issues the `HO` number, completes the contract (handover milestones become claimable),
// moves the project to `warranty` and starts the warranty (`end = addMonths(handoverDate, warrantyMonths)`).
import { Injectable } from '@nestjs/common';
import type {
    AcceptHandoverRequest, AddHandoverDocumentRequest, CreateHandoverRequest, HandoverDto, InspectHandoverRequest, PatchHandoverRequest,
    ProjectHandoverDto, RejectHandoverRequest, ScheduleHandoverRequest,
} from '@contrack/contract';
import { addMonths, bangkokToday } from '@contrack/domain/dates/business-date';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    AuditLog, Clock, DocumentNumbering, FileService, IdGenerator, type MainContractInfo, MainContracts, ProjectLifecycle, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { DEFAULT_HANDOVER_CHECKLIST, HANDOVER_EDITABLE, requireHandoverTransition, requireStatus } from '../../domain/handover-state';
import { HandoverAccess, HandoverViews, MANAGE, MODULE, READ, transact } from '../handover.service';
import { type HandoverRecord, HandoverRepository } from '../ports/handover.repository';

const notSigned = (): DomainError =>
    DomainError.conflict('The main contract of the project is not signed', { reason: 'contract_not_signed' });

/** The contract a handover belongs to, still `signed` (completed only by acceptance). */
async function signedContract(contracts: MainContracts, h: HandoverRecord): Promise<Result<MainContractInfo, DomainError>> {
    const c = await contracts.find(h.workspaceId, h.contractId);
    return c?.status === 'signed' ? ok(c) : err(notSigned());
}

/** Loads, locks and saves a handover with `change` (which may refuse); audited; returns the fresh DTO. */
async function changeHandover(
    deps: { access: HandoverAccess; repo: HandoverRepository; views: HandoverViews; audit: AuditLog; uow: UnitOfWork; clock: Clock },
    userId: UserId, handoverId: string, action: string,
    change: (h: HandoverRecord, grant: ProjectGrant) => Promise<Result<{ next: HandoverRecord; data: Record<string, unknown> }, DomainError>>,
): Promise<Result<HandoverDto, DomainError>> {
    const loaded = await deps.access.handover(userId, handoverId, true);
    if (!loaded.ok) return loaded;
    const { grant } = loaded.value;
    const ws = grant.workspaceId;
    const saved = await transact(deps.uow, async (): Promise<Result<HandoverRecord, DomainError>> => {
        const h = await deps.repo.lockHandover(ws, loaded.value.handover.id);
        if (h === undefined) return err(DomainError.notFound('Handover'));
        const changed = await change(h, grant);
        if (!changed.ok) return changed;
        const next = { ...changed.value.next, updatedAt: deps.clock.now() };
        await deps.repo.saveHandover(next);
        await deps.audit.record({
            workspaceId: ws, projectId: h.projectId, actor: userId, entityType: 'handover', entityId: h.id, action, data: changed.value.data,
        });
        return ok(next);
    });
    if (!saved.ok) return saved;
    return ok(await deps.views.handover(grant, saved.value));
}

// ── reads ──

/** GET /projects/:projectId/handover — the handover (null before one is made) and the contract it needs. */
@Injectable()
export class GetProjectHandoverUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: HandoverRepository,
        private readonly views: HandoverViews,
        private readonly contracts: MainContracts,
    ) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<ProjectHandoverDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const h = await this.repo.handoverForProject(ws, projectId);
        const c = h === undefined ? await this.contracts.forProject(ws, projectId) : await this.contracts.find(ws, h.contractId);
        return ok({
            handover: h === undefined ? null : await this.views.handover(grant.value, h),
            contract: c === undefined
                ? null
                : { id: c.id, number: c.number, status: c.status, warrantyMonths: c.terms.warrantyMonths, language: c.language },
            canCreate: h === undefined && c?.status === 'signed' && can(grant.value.role, 'handover.manage') && !grant.value.archived,
        });
    }
}

// ── writes ──

/** POST /projects/:projectId/handover — a draft for the signed contract (409 `handover_exists` when there is one). */
@Injectable()
export class CreateHandoverUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: HandoverRepository,
        private readonly views: HandoverViews,
        private readonly contracts: MainContracts,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: CreateHandoverRequest }): Promise<Result<HandoverDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: MANAGE, write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const contract = await this.contracts.forProject(ws, projectId);
        if (contract?.status !== 'signed') return err(notSigned());
        const created = await transact(this.uow, async (): Promise<Result<HandoverRecord, DomainError>> => {
            if ((await this.repo.handoverForProject(ws, projectId)) !== undefined) {
                return err(DomainError.conflict('The project already has a handover', { reason: 'handover_exists' }));
            }
            const now = this.clock.now();
            const h: HandoverRecord = {
                id: this.ids.newId(), workspaceId: ws, projectId, contractId: contract.id, number: null, status: 'draft',
                scheduledDate: body.scheduledDate ?? null, inspectionDate: null, handoverDate: null, attendees: body.attendees ?? [],
                checklist: body.checklist ?? DEFAULT_HANDOVER_CHECKLIST.map(i => ({ ...i })), defectsNote: '', acceptedByName: '',
                language: body.language ?? contract.language, createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insertHandover(h);
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'handover', entityId: h.id, action: 'create', data: { contractId: contract.id },
            });
            return ok(h);
        });
        if (!created.ok) return created;
        return ok(await this.views.handover(grant.value, created.value, []));
    }
}

/** PATCH /handovers/:handoverId — content while not accepted; `removeDocumentIds` in any status. */
@Injectable()
export class PatchHandoverUseCase {
    constructor(
        readonly access: HandoverAccess,
        readonly repo: HandoverRepository,
        readonly views: HandoverViews,
        readonly audit: AuditLog,
        readonly uow: UnitOfWork,
        readonly clock: Clock,
    ) {}

    execute(input: { userId: UserId; handoverId: string; body: PatchHandoverRequest }): Promise<Result<HandoverDto, DomainError>> {
        const { removeDocumentIds, ...content } = input.body;
        return changeHandover(this, input.userId, input.handoverId, 'update', async h => {
            const fields = Object.keys(content).filter(k => (content as Record<string, unknown>)[k] !== undefined);
            if (fields.length > 0) {
                const editable = requireStatus(h.status, HANDOVER_EDITABLE);
                if (!editable.ok) return editable;
            }
            const next: HandoverRecord = {
                ...h,
                language: content.language ?? h.language,
                scheduledDate: content.scheduledDate === undefined ? h.scheduledDate : content.scheduledDate,
                inspectionDate: content.inspectionDate === undefined ? h.inspectionDate : content.inspectionDate,
                attendees: content.attendees ?? h.attendees,
                checklist: content.checklist ?? h.checklist,
                defectsNote: content.defectsNote ?? h.defectsNote,
                acceptedByName: content.acceptedByName ?? h.acceptedByName,
            };
            const removed = removeDocumentIds?.map(id => id.toLowerCase()) ?? [];
            if (removed.length > 0) await this.repo.deleteDocuments(h.workspaceId, h.id, removed);
            return ok({ next, data: { fields, ...(removed.length > 0 ? { removedDocuments: removed.length } : {}) } });
        });
    }
}

/** POST /handovers/:handoverId/schedule — the appointment with the customer; the project moves to `handover`. */
@Injectable()
export class ScheduleHandoverUseCase {
    constructor(
        readonly access: HandoverAccess,
        readonly repo: HandoverRepository,
        readonly views: HandoverViews,
        readonly audit: AuditLog,
        readonly uow: UnitOfWork,
        readonly clock: Clock,
        private readonly contracts: MainContracts,
        private readonly lifecycle: ProjectLifecycle,
    ) {}

    execute(input: { userId: UserId; handoverId: string; body: ScheduleHandoverRequest }): Promise<Result<HandoverDto, DomainError>> {
        const { userId, body } = input;
        return changeHandover(this, userId, input.handoverId, 'schedule', async h => {
            const allowed = requireHandoverTransition(h.status, 'scheduled');
            if (!allowed.ok) return allowed;
            const contract = await signedContract(this.contracts, h);
            if (!contract.ok) return contract;
            await this.lifecycle.advance(h.workspaceId, h.projectId, 'handover', userId);
            return ok({
                next: { ...h, status: 'scheduled', scheduledDate: body.scheduledDate, attendees: body.attendees ?? h.attendees },
                data: { status: [h.status, 'scheduled'], scheduledDate: [h.scheduledDate, body.scheduledDate] },
            });
        });
    }
}

/** POST /handovers/:handoverId/inspect — the joint inspection (checklist); inspection date defaults to today. */
@Injectable()
export class InspectHandoverUseCase {
    constructor(
        readonly access: HandoverAccess,
        readonly repo: HandoverRepository,
        readonly views: HandoverViews,
        readonly audit: AuditLog,
        readonly uow: UnitOfWork,
        readonly clock: Clock,
    ) {}

    execute(input: { userId: UserId; handoverId: string; body: InspectHandoverRequest }): Promise<Result<HandoverDto, DomainError>> {
        const { body } = input;
        return changeHandover(this, input.userId, input.handoverId, 'inspect', h => {
            const allowed = requireHandoverTransition(h.status, 'inspected');
            if (!allowed.ok) return Promise.resolve(allowed);
            const inspectionDate = body.inspectionDate ?? bangkokToday(this.clock.now());
            const checklist = body.checklist ?? h.checklist;
            return Promise.resolve(ok({
                next: {
                    ...h, status: 'inspected' as const, inspectionDate, checklist, attendees: body.attendees ?? h.attendees,
                    defectsNote: body.defectsNote ?? h.defectsNote,
                },
                data: {
                    status: [h.status, 'inspected'], inspectionDate, toFix: checklist.filter(i => i.status === 'fix').length,
                },
            }));
        });
    }
}

/**
 * POST /handovers/:handoverId/accept — the customer accepts (inspected → accepted), all in one transaction: number `HO`,
 * contract completed on the handover date, project `warranty`, warranty `start = handoverDate`, `end = addMonths(start,
 * warrantyMonths)`. The retention due at completion is announced by billing's daily sweep (D-354).
 */
@Injectable()
export class AcceptHandoverUseCase {
    constructor(
        readonly access: HandoverAccess,
        readonly repo: HandoverRepository,
        readonly views: HandoverViews,
        readonly audit: AuditLog,
        readonly uow: UnitOfWork,
        readonly clock: Clock,
        private readonly contracts: MainContracts,
        private readonly lifecycle: ProjectLifecycle,
        private readonly numbering: DocumentNumbering,
        private readonly ids: IdGenerator,
    ) {}

    execute(input: { userId: UserId; handoverId: string; body: AcceptHandoverRequest }): Promise<Result<HandoverDto, DomainError>> {
        const { userId, body } = input;
        return changeHandover(this, userId, input.handoverId, 'accept', async h => {
            const allowed = requireHandoverTransition(h.status, 'accepted');
            if (!allowed.ok) return allowed;
            const contract = await signedContract(this.contracts, h);
            if (!contract.ok) return contract;
            const ws = h.workspaceId;
            const handoverDate = body.handoverDate ?? h.inspectionDate ?? bangkokToday(this.clock.now());
            if ((await this.repo.warrantyForProject(ws, h.projectId)) !== undefined) {
                return err(DomainError.conflict('The project already has a warranty', { reason: 'invalid_transition', status: h.status }));
            }
            const issued = await this.numbering.issue({
                workspaceId: ws, docType: 'handover', issueDate: handoverDate, subjectType: 'handover', subjectId: h.id,
                projectId: h.projectId, issuedBy: userId,
            });
            if (!issued.ok) return issued;
            const completed = await this.contracts.complete(ws, contract.value.id, handoverDate, userId);
            if (!completed.ok) return completed;
            await this.lifecycle.advance(ws, h.projectId, 'warranty', userId);
            const now = this.clock.now();
            const endDate = addMonths(handoverDate, contract.value.terms.warrantyMonths);
            await this.repo.insertWarranty({
                id: this.ids.newId(), workspaceId: ws, projectId: h.projectId, contractId: contract.value.id, handoverId: h.id,
                startDate: handoverDate, endDate, status: 'active', createdAt: now, updatedAt: now,
            });
            return ok({
                next: { ...h, status: 'accepted' as const, number: issued.value.number, handoverDate, acceptedByName: body.acceptedByName },
                data: { status: [h.status, 'accepted'], number: issued.value.number, handoverDate, warrantyEnd: endDate },
            });
        });
    }
}

/** POST /handovers/:handoverId/reject — the customer does not accept yet (defects); schedule again after fixing. */
@Injectable()
export class RejectHandoverUseCase {
    constructor(
        readonly access: HandoverAccess,
        readonly repo: HandoverRepository,
        readonly views: HandoverViews,
        readonly audit: AuditLog,
        readonly uow: UnitOfWork,
        readonly clock: Clock,
    ) {}

    execute(input: { userId: UserId; handoverId: string; body: RejectHandoverRequest }): Promise<Result<HandoverDto, DomainError>> {
        return changeHandover(this, input.userId, input.handoverId, 'reject', h => {
            const allowed = requireHandoverTransition(h.status, 'rejected');
            if (!allowed.ok) return Promise.resolve(allowed);
            return Promise.resolve(ok({
                next: { ...h, status: 'rejected' as const, defectsNote: input.body.defectsNote ?? h.defectsNote },
                data: { status: [h.status, 'rejected'] },
            }));
        });
    }
}

/** POST /handovers/:handoverId/documents — attaches a file uploaded by the caller (any status). */
@Injectable()
export class AddHandoverDocumentUseCase {
    constructor(
        readonly access: HandoverAccess,
        readonly repo: HandoverRepository,
        readonly views: HandoverViews,
        readonly audit: AuditLog,
        readonly uow: UnitOfWork,
        readonly clock: Clock,
        private readonly files: FileService,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: { userId: UserId; handoverId: string; body: AddHandoverDocumentRequest }): Promise<Result<HandoverDto, DomainError>> {
        const { userId, body } = input;
        const fileId = body.fileId.toLowerCase();
        const uploaded = await this.files.assertUploadedBy([fileId], userId);
        if (!uploaded.ok) return uploaded;
        return changeHandover(this, userId, input.handoverId, 'add_document', async h => {
            const id = this.ids.newId();
            await this.repo.insertDocument({
                id, handoverId: h.id, workspaceId: h.workspaceId, kind: body.kind, fileId, title: body.title, createdBy: userId,
                createdAt: this.clock.now(),
            });
            return ok({ next: h, data: { documentId: id, kind: body.kind, fileId } });
        });
    }
}
