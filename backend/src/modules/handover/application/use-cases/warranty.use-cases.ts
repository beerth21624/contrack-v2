// ─── Warranty and warranty claim use cases (docs/erp/04-implementation-plan.md WP-53, docs/erp/02-domain-model.md §11) ───
// Read `handover.read`; claims are written with `handover.manage`. A claim needs the project's warranty (after the
// customer accepted the handover, 409 `no_warranty`) and gets its `WC` number when opened. Closing with a cost > 0
// posts it to the cost ledger: `actual`, category `other`, source `warranty_claim`, no cost code.
import { Injectable } from '@nestjs/common';
import {
    type AssignWarrantyClaimRequest, type CloseWarrantyClaimRequest, type CreateWarrantyClaimRequest, type PatchWarrantyClaimRequest,
    type ProjectWarrantyDto, type RejectWarrantyClaimRequest, type ResolveWarrantyClaimRequest, WARRANTY_CLAIM_OPEN_STATUSES,
    type WarrantyClaimDto, type WarrantyClaimListDto, type WarrantyClaimListQuery, type WarrantyClaimPhoto, type WarrantyClaimStatus,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { round2 } from '@contrack/domain/money';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    AuditLog, Clock, CostLedger, DocumentNumbering, FileService, IdGenerator, SupplierLookup, UnitOfWork, WorkspaceDirectory,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type ProjectId, type UserId, asUserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { CLAIM_EDITABLE, requireClaimTransition, requireStatus } from '../../domain/handover-state';
import {
    HandoverAccess, HandoverNotices, HandoverViews, LEDGER_SOURCE, MANAGE, MODULE, READ, transact, warrantyDto,
} from '../handover.service';
import { HandoverRepository, type WarrantyClaimRecord } from '../ports/handover.repository';

const OPEN_STATUSES: readonly WarrantyClaimStatus[] = WARRANTY_CLAIM_OPEN_STATUSES;

/** Photos not already on the claim must be the caller's uploads. */
async function checkPhotos(
    files: FileService, userId: UserId, photos: readonly WarrantyClaimPhoto[], existing: readonly WarrantyClaimPhoto[],
): Promise<Result<WarrantyClaimPhoto[], DomainError>> {
    const known = new Set(existing.map(p => p.fileId));
    const out = photos.map(p => ({ ...p, fileId: p.fileId.toLowerCase() }));
    const fresh = [...new Set(out.map(p => p.fileId).filter(id => !known.has(id)))];
    if (fresh.length > 0) {
        const uploaded = await files.assertUploadedBy(fresh, userId);
        if (!uploaded.ok) return uploaded;
    }
    return ok(out);
}

// ── reads ──

/** GET /projects/:projectId/warranty — the warranty (null before acceptance) with days left and open claims. */
@Injectable()
export class GetProjectWarrantyUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: HandoverRepository, private readonly clock: Clock) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<ProjectWarrantyDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const w = await this.repo.warrantyForProject(ws, projectId);
        if (w === undefined) return ok({ warranty: null });
        const open = (await this.repo.claimsOfProjects(ws, [projectId], OPEN_STATUSES)).length;
        return ok({ warranty: warrantyDto(w, bangkokToday(this.clock.now()), open) });
    }
}

/** GET /projects/:projectId/warranty-claims?status= — newest reported first. */
@Injectable()
export class ListWarrantyClaimsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: HandoverRepository, private readonly views: HandoverViews) {}

    async execute(userId: UserId, projectId: ProjectId, query: WarrantyClaimListQuery): Promise<Result<WarrantyClaimListDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: READ, write: false });
        if (!grant.ok) return grant;
        const list = await this.repo.claimsByProject(grant.value.workspaceId, projectId, query.status);
        return ok({ items: await this.views.claims(grant.value, list) });
    }
}

// ── writes ──

/** POST /projects/:projectId/warranty-claims — opens a claim (`WC` number); `warranty.claim_opened` after commit. */
@Injectable()
export class CreateWarrantyClaimUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: HandoverRepository,
        private readonly views: HandoverViews,
        private readonly notices: HandoverNotices,
        private readonly numbering: DocumentNumbering,
        private readonly files: FileService,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: CreateWarrantyClaimRequest }): Promise<Result<WarrantyClaimDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: MANAGE, write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const warranty = await this.repo.warrantyForProject(ws, projectId);
        if (warranty === undefined || warranty.status === 'closed') {
            return err(DomainError.conflict('The project has no warranty to claim on', { reason: 'no_warranty' }));
        }
        const photos = await checkPhotos(this.files, userId, body.photos, []);
        if (!photos.ok) return photos;
        const created = await transact(this.uow, async (): Promise<Result<WarrantyClaimRecord, DomainError>> => {
            const now = this.clock.now();
            const reportedDate = body.reportedDate ?? bangkokToday(now);
            const id = this.ids.newId();
            const issued = await this.numbering.issue({
                workspaceId: ws, docType: 'warranty_claim', issueDate: reportedDate, subjectType: 'warranty_claim', subjectId: id, projectId,
                issuedBy: userId,
            });
            if (!issued.ok) return issued;
            const c: WarrantyClaimRecord = {
                id, workspaceId: ws, projectId, warrantyId: warranty.id, number: issued.value.number, reportedDate,
                reportedByName: body.reportedByName, channel: body.channel, description: body.description, location: body.location,
                photos: photos.value, severity: body.severity, status: 'open', assigneeUserId: null, assigneeSupplierId: null,
                dueDate: body.dueDate ?? null, resolutionNote: '', resolvedAt: null, closedAt: null, costAmount: 0, createdBy: userId,
                createdAt: now, updatedAt: now,
            };
            await this.repo.insertClaim(c);
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'warranty_claim', entityId: id, action: 'create',
                data: { number: c.number, severity: c.severity },
            });
            return ok(c);
        });
        if (!created.ok) return created;
        await this.notices.claimOpened(created.value, userId);
        return ok(await this.views.claim(grant.value, created.value));
    }
}

/** Shared by the claim writes: load + authorize, lock, `change`, save, audit, fresh DTO. */
@Injectable()
export class ClaimWriter {
    constructor(
        private readonly access: HandoverAccess,
        private readonly repo: HandoverRepository,
        private readonly views: HandoverViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async write(
        userId: UserId, claimId: string, action: string,
        change: (c: WarrantyClaimRecord, grant: ProjectGrant, now: Date) => Promise<Result<{ next: WarrantyClaimRecord; data: Record<string, unknown> }, DomainError>>,
    ): Promise<Result<WarrantyClaimDto, DomainError>> {
        const loaded = await this.access.claim(userId, claimId, true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const saved = await transact(this.uow, async (): Promise<Result<WarrantyClaimRecord, DomainError>> => {
            const c = await this.repo.lockClaim(grant.workspaceId, loaded.value.claim.id);
            if (c === undefined) return err(DomainError.notFound('WarrantyClaim'));
            const now = this.clock.now();
            const changed = await change(c, grant, now);
            if (!changed.ok) return changed;
            const next = { ...changed.value.next, updatedAt: now };
            await this.repo.saveClaim(next);
            await this.audit.record({
                workspaceId: grant.workspaceId, projectId: c.projectId, actor: userId, entityType: 'warranty_claim', entityId: c.id, action,
                data: changed.value.data,
            });
            return ok(next);
        });
        if (!saved.ok) return saved;
        return ok(await this.views.claim(grant, saved.value));
    }
}

/** PATCH /warranty-claims/:claimId — any subset while not closed / rejected. */
@Injectable()
export class PatchWarrantyClaimUseCase {
    constructor(private readonly writer: ClaimWriter, private readonly files: FileService) {}

    execute(input: { userId: UserId; claimId: string; body: PatchWarrantyClaimRequest }): Promise<Result<WarrantyClaimDto, DomainError>> {
        const { userId, body } = input;
        return this.writer.write(userId, input.claimId, 'update', async c => {
            const editable = requireStatus(c.status, CLAIM_EDITABLE);
            if (!editable.ok) return editable;
            let photos = c.photos;
            if (body.photos !== undefined) {
                const checked = await checkPhotos(this.files, userId, body.photos, c.photos);
                if (!checked.ok) return checked;
                photos = checked.value;
            }
            const next: WarrantyClaimRecord = {
                ...c,
                reportedDate: body.reportedDate ?? c.reportedDate,
                reportedByName: body.reportedByName ?? c.reportedByName,
                channel: body.channel ?? c.channel,
                description: body.description ?? c.description,
                location: body.location ?? c.location,
                photos,
                severity: body.severity ?? c.severity,
                dueDate: body.dueDate === undefined ? c.dueDate : body.dueDate,
                resolutionNote: body.resolutionNote ?? c.resolutionNote,
                costAmount: body.costAmount === undefined ? c.costAmount : round2(body.costAmount),
            };
            return ok({ next, data: { fields: Object.keys(body).filter(k => (body as Record<string, unknown>)[k] !== undefined) } });
        });
    }
}

/** POST /warranty-claims/:claimId/assign | start | resolve | close | reject. */
@Injectable()
export class WarrantyClaimActions {
    constructor(
        private readonly writer: ClaimWriter,
        private readonly directory: WorkspaceDirectory,
        private readonly suppliers: SupplierLookup,
        private readonly ledger: CostLedger,
    ) {}

    /** A member of the workspace and / or a supplier of the vendor master (404 otherwise); open → assigned. */
    assign(input: { userId: UserId; claimId: string; body: AssignWarrantyClaimRequest }): Promise<Result<WarrantyClaimDto, DomainError>> {
        const { body } = input;
        return this.writer.write(input.userId, input.claimId, 'assign', async (c, grant) => {
            // in_progress keeps its status when the work is handed to someone else.
            if (c.status !== 'in_progress') {
                const allowed = requireClaimTransition(c.status, 'assigned');
                if (!allowed.ok) return allowed;
            }
            const userId = body.assigneeUserId === undefined ? c.assigneeUserId : body.assigneeUserId === null ? null : asUserId(body.assigneeUserId.toLowerCase());
            const supplierId = body.assigneeSupplierId === undefined ? c.assigneeSupplierId : body.assigneeSupplierId?.toLowerCase() ?? null;
            if (userId === null && supplierId === null) {
                return err(DomainError.unprocessable('Assign the claim to a member or a supplier', { reason: 'assignee_required' }));
            }
            if (userId !== null && userId !== c.assigneeUserId) {
                const members = await this.directory.members(grant.workspaceId);
                if (!members.some(m => m.userId === userId)) return err(DomainError.notFound('Member'));
            }
            if (supplierId !== null && supplierId !== c.assigneeSupplierId) {
                if ((await this.suppliers.find(grant.workspaceId, supplierId)) === undefined) return err(DomainError.notFound('Supplier'));
            }
            const status = c.status === 'in_progress' ? c.status : 'assigned';
            return ok({
                next: { ...c, status, assigneeUserId: userId, assigneeSupplierId: supplierId, dueDate: body.dueDate === undefined ? c.dueDate : body.dueDate },
                data: { status: [c.status, status], assigneeUserId: userId, assigneeSupplierId: supplierId },
            });
        });
    }

    /** assigned (or resolved, not fixed after all) → in_progress. */
    start(input: { userId: UserId; claimId: string }): Promise<Result<WarrantyClaimDto, DomainError>> {
        return this.writer.write(input.userId, input.claimId, 'start', c => {
            const allowed = requireClaimTransition(c.status, 'in_progress');
            if (!allowed.ok) return Promise.resolve(allowed);
            return Promise.resolve(ok({ next: { ...c, status: 'in_progress' as const, resolvedAt: null }, data: { status: [c.status, 'in_progress'] } }));
        });
    }

    resolve(input: { userId: UserId; claimId: string; body: ResolveWarrantyClaimRequest }): Promise<Result<WarrantyClaimDto, DomainError>> {
        const { body } = input;
        return this.writer.write(input.userId, input.claimId, 'resolve', (c, _g, now) => {
            const allowed = requireClaimTransition(c.status, 'resolved');
            if (!allowed.ok) return Promise.resolve(allowed);
            return Promise.resolve(ok({
                next: {
                    ...c, status: 'resolved' as const, resolvedAt: now, resolutionNote: body.resolutionNote ?? c.resolutionNote,
                    costAmount: body.costAmount === undefined ? c.costAmount : round2(body.costAmount),
                },
                data: { status: [c.status, 'resolved'] },
            }));
        });
    }

    /** resolved → closed; a cost > 0 goes to the cost ledger (`actual`, `other`, no cost code) dated the closing day. */
    close(input: { userId: UserId; claimId: string; body: CloseWarrantyClaimRequest }): Promise<Result<WarrantyClaimDto, DomainError>> {
        const { userId, body } = input;
        return this.writer.write(userId, input.claimId, 'close', async (c, grant, now) => {
            const allowed = requireClaimTransition(c.status, 'closed');
            if (!allowed.ok) return allowed;
            const costAmount = body.costAmount === undefined ? c.costAmount : round2(body.costAmount);
            if (costAmount > 0) {
                const posted = await this.ledger.post(grant.workspaceId, [{
                    projectId: c.projectId, costCodeId: null, entryDate: bangkokToday(now), kind: 'actual', category: 'other', amount: costAmount,
                    sourceType: LEDGER_SOURCE, sourceId: c.id, note: c.number ?? '', by: userId,
                }]);
                if (!posted.ok) return posted;
            }
            return ok({
                next: { ...c, status: 'closed' as const, closedAt: now, costAmount, resolutionNote: body.resolutionNote ?? c.resolutionNote },
                data: { status: [c.status, 'closed'], costAmount },
            });
        });
    }

    /** open / assigned → rejected (outside the warranty's terms). */
    reject(input: { userId: UserId; claimId: string; body: RejectWarrantyClaimRequest }): Promise<Result<WarrantyClaimDto, DomainError>> {
        return this.writer.write(input.userId, input.claimId, 'reject', (c, _g, now) => {
            const allowed = requireClaimTransition(c.status, 'rejected');
            if (!allowed.ok) return Promise.resolve(allowed);
            return Promise.resolve(ok({
                next: { ...c, status: 'rejected' as const, closedAt: now, resolutionNote: input.body.resolutionNote ?? c.resolutionNote },
                data: { status: [c.status, 'rejected'] },
            }));
        });
    }
}
