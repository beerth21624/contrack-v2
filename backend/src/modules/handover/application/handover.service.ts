// ─── Shared parts of handover: transactions, access by id, DTOs, notices, what the module plugs into core registries ───
import { Injectable, Logger } from '@nestjs/common';
import {
    type HandoverDto, type ProjectRollup, WARRANTY_CLAIM_OPEN_STATUSES, WARRANTY_NOTICE_DAYS, type WarrantyClaimDto, type WarrantyDto,
} from '@contrack/contract';
import { addDays, bangkokToday, daysBetween } from '@contrack/domain/dates/business-date';
import { type ProjectGrant, ModuleAccess } from '../../../shared/application/module-access';
import {
    Clock, FileService, ModuleFlags, Notifier, type PortalContext, type PortalTaskItem, ProjectCatalog, SupplierLookup, type SweepContext,
    SweepMarks, UnitOfWork, UserDirectory, WorkspaceDirectory,
} from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, isUuid } from '../../../shared/domain/ids';
import { type Permission, can } from '../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../shared/domain/result';
import { CLAIM_EDITABLE, CLAIM_TRANSITIONS, HANDOVER_EDITABLE, HANDOVER_TRANSITIONS } from '../domain/handover-state';
import {
    type HandoverDocumentRecord, type HandoverRecord, HandoverRepository, type WarrantyClaimRecord, type WarrantyRecord,
} from './ports/handover.repository';

export const MODULE = 'handover';
export const WARRANTY_SWEEP = 'handover.warranty';
/** Cost ledger `source_type` of a closed claim's cost. */
export const LEDGER_SOURCE = 'warranty_claim';
export const READ: Permission[] = ['handover.read'];
export const MANAGE: Permission[] = ['handover.manage'];
const OPEN = new Set<string>(WARRANTY_CLAIM_OPEN_STATUSES);

/** Thrown inside a transaction so an `err` rolls it back (the UnitOfWork commits on a normal return). */
class Rollback extends Error {
    constructor(readonly error: DomainError) {
        super(error.message);
    }
}

/** Runs `work` in one transaction; an `err` result rolls everything back and is returned. Joins an open transaction. */
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

export const handoverHref = (projectId: string): string => `/p/${projectId}/handover`;
export const warrantyHref = (projectId: string): string => `/p/${projectId}/handover?tab=warranty`;

/** Loads a handover / claim by id and authorizes the caller on its project (a stranger or unknown id → not_found). */
@Injectable()
export class HandoverAccess {
    constructor(private readonly access: ModuleAccess, private readonly repo: HandoverRepository) {}

    async handover(
        userId: UserId, handoverId: string, write: boolean,
    ): Promise<Result<{ grant: ProjectGrant; handover: HandoverRecord }, DomainError>> {
        if (!isUuid(handoverId)) return err(DomainError.notFound('Handover'));
        const handover = await this.repo.findHandover(handoverId.toLowerCase());
        if (handover === undefined) return err(DomainError.notFound('Handover'));
        const grant = await this.access.toProject(userId, handover.projectId, MODULE, { permissions: write ? MANAGE : READ, write });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Handover')) : grant;
        if (grant.value.workspaceId !== handover.workspaceId) return err(DomainError.notFound('Handover'));
        return ok({ grant: grant.value, handover });
    }

    async claim(
        userId: UserId, claimId: string, write: boolean,
    ): Promise<Result<{ grant: ProjectGrant; claim: WarrantyClaimRecord }, DomainError>> {
        if (!isUuid(claimId)) return err(DomainError.notFound('WarrantyClaim'));
        const claim = await this.repo.findClaim(claimId.toLowerCase());
        if (claim === undefined) return err(DomainError.notFound('WarrantyClaim'));
        const grant = await this.access.toProject(userId, claim.projectId, MODULE, { permissions: write ? MANAGE : READ, write });
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('WarrantyClaim')) : grant;
        if (grant.value.workspaceId !== claim.workspaceId) return err(DomainError.notFound('WarrantyClaim'));
        return ok({ grant: grant.value, claim });
    }
}

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;
const manages = (grant: ProjectGrant): boolean => can(grant.role, 'handover.manage') && !grant.archived;

export function warrantyDto(w: WarrantyRecord, today: string, openClaimCount: number): WarrantyDto {
    return {
        id: w.id, projectId: w.projectId, contractId: w.contractId, startDate: w.startDate, endDate: w.endDate, status: w.status,
        daysLeft: daysBetween(today, w.endDate), openClaimCount,
    };
}

@Injectable()
export class HandoverViews {
    constructor(
        private readonly repo: HandoverRepository,
        private readonly files: FileService,
        private readonly users: UserDirectory,
        private readonly suppliers: SupplierLookup,
    ) {}

    async handover(grant: ProjectGrant, h: HandoverRecord, docs?: readonly HandoverDocumentRecord[]): Promise<HandoverDto> {
        const documents = docs ?? await this.repo.documentsOf(h.workspaceId, h.id);
        const files = new Map((documents.length === 0 ? [] : await this.files.describe(documents.map(d => d.fileId))).map(f => [f.id, f]));
        const m = manages(grant);
        const next = HANDOVER_TRANSITIONS[h.status];
        return {
            id: h.id, projectId: h.projectId, contractId: h.contractId, number: h.number, status: h.status, scheduledDate: h.scheduledDate,
            inspectionDate: h.inspectionDate, handoverDate: h.handoverDate, attendees: structuredClone(h.attendees),
            checklist: structuredClone(h.checklist), defectsNote: h.defectsNote, acceptedByName: h.acceptedByName, language: h.language,
            documents: documents.map(d => ({
                id: d.id, kind: d.kind, fileId: d.fileId, file: files.get(d.fileId) ?? null, title: d.title, createdAt: d.createdAt.toISOString(),
            })),
            createdBy: h.createdBy, createdAt: h.createdAt.toISOString(), updatedAt: h.updatedAt.toISOString(),
            canEdit: m && HANDOVER_EDITABLE.includes(h.status),
            canSchedule: m && next.includes('scheduled'),
            canInspect: m && next.includes('inspected'),
            canAccept: m && next.includes('accepted'),
            canReject: m && next.includes('rejected'),
            canAddDocuments: m,
        };
    }

    async claims(grant: ProjectGrant, list: readonly WarrantyClaimRecord[]): Promise<WarrantyClaimDto[]> {
        const ws = grant.workspaceId;
        const userIds = [...new Set(list.flatMap(c => (c.assigneeUserId === null ? [] : [c.assigneeUserId])))];
        const supplierIds = [...new Set(list.flatMap(c => (c.assigneeSupplierId === null ? [] : [c.assigneeSupplierId])))];
        const fileIds = [...new Set(list.flatMap(c => c.photos.map(p => p.fileId)))];
        const [users, suppliers, files] = await Promise.all([
            userIds.length === 0 ? new Map<UserId, { displayName: string }>() : this.users.findMany(userIds),
            supplierIds.length === 0 ? [] : this.suppliers.findMany(ws, supplierIds),
            fileIds.length === 0 ? [] : this.files.describe(fileIds),
        ]);
        const supplierNames = new Map(suppliers.map(s => [s.id, s.nameTh || s.nameEn]));
        const fileById = new Map(files.map(f => [f.id, f]));
        const m = manages(grant);
        return list.map(c => {
            const next = CLAIM_TRANSITIONS[c.status];
            const names = [
                c.assigneeUserId === null ? '' : users.get(c.assigneeUserId)?.displayName ?? '',
                c.assigneeSupplierId === null ? '' : supplierNames.get(c.assigneeSupplierId) ?? '',
            ].filter(s => s !== '');
            const actions: WarrantyClaimDto['actions'] = [];
            if (m) {
                if (next.includes('assigned')) actions.push('assign');
                if (next.includes('in_progress')) actions.push('start');
                if (next.includes('resolved')) actions.push('resolve');
                if (next.includes('closed')) actions.push('close');
                if (next.includes('rejected')) actions.push('reject');
            }
            return {
                id: c.id, projectId: c.projectId, warrantyId: c.warrantyId, number: c.number, reportedDate: c.reportedDate,
                reportedByName: c.reportedByName, channel: c.channel, description: c.description, location: c.location,
                photos: c.photos.map(p => ({ ...p, file: fileById.get(p.fileId) ?? null })), severity: c.severity, status: c.status,
                assigneeUserId: c.assigneeUserId, assigneeSupplierId: c.assigneeSupplierId, assigneeName: names.join(' / '), dueDate: c.dueDate,
                resolutionNote: c.resolutionNote, resolvedAt: iso(c.resolvedAt), closedAt: iso(c.closedAt), costAmount: c.costAmount,
                createdBy: c.createdBy, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
                canEdit: m && CLAIM_EDITABLE.includes(c.status), actions,
            };
        });
    }

    async claim(grant: ProjectGrant, c: WarrantyClaimRecord): Promise<WarrantyClaimDto> {
        const [dto] = await this.claims(grant, [c]);
        if (dto === undefined) throw new Error('claim view');
        return dto;
    }
}

/** Notices of the module (after the transaction committed; never throw). */
@Injectable()
export class HandoverNotices {
    private readonly logger = new Logger(HandoverNotices.name);

    constructor(
        private readonly directory: WorkspaceDirectory,
        private readonly catalog: ProjectCatalog,
        private readonly notifier: Notifier,
    ) {}

    async managers(workspaceId: WorkspaceId, except: UserId | null): Promise<UserId[]> {
        return (await this.directory.members(workspaceId)).filter(m => can(m.role, 'handover.manage') && m.userId !== except).map(m => m.userId);
    }

    async projectName(workspaceId: WorkspaceId, projectId: ProjectId): Promise<string> {
        return (await this.catalog.find(workspaceId, projectId))?.name ?? '';
    }

    /** `warranty.claim_opened` to the members who manage handovers (the reporter excluded), plus the assignee. */
    async claimOpened(c: WarrantyClaimRecord, by: UserId): Promise<void> {
        try {
            const toUserIds = await this.managers(c.workspaceId, by);
            if (toUserIds.length === 0) return;
            await this.notifier.notify({
                template: 'warranty.claim_opened', toUserIds,
                payload: {
                    projectName: await this.projectName(c.workspaceId, c.projectId),
                    title: [c.number ?? '', c.description.slice(0, 120)].filter(s => s !== '').join(' '),
                    href: warrantyHref(c.projectId),
                },
            });
        } catch (e) {
            this.logger.error(`warranty claim notice not sent: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}

/** HubRollups, PortalSources and the daily warranty sweep (wired in HandoverModule.onModuleInit). */
@Injectable()
export class HandoverHandlers {
    private readonly logger = new Logger(HandoverHandlers.name);

    constructor(
        private readonly repo: HandoverRepository,
        private readonly flags: ModuleFlags,
        private readonly marks: SweepMarks,
        private readonly notices: HandoverNotices,
        private readonly notifier: Notifier,
        private readonly clock: Clock,
    ) {}

    /** alerts: `warranty_claim_open` (claims being worked on), `warranty_expiring` (active, ends within 30 days). */
    async rollup(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, Partial<ProjectRollup>>> {
        const out = new Map<ProjectId, Partial<ProjectRollup>>();
        if (projectIds.length === 0 || !(await this.flags.isEnabled(workspaceId, MODULE))) return out;
        const alerts = new Map<ProjectId, Set<string>>();
        const add = (id: ProjectId, alert: string): void => {
            const s = alerts.get(id) ?? new Set<string>();
            s.add(alert);
            alerts.set(id, s);
        };
        for (const c of await this.repo.claimsOfProjects(workspaceId, projectIds, WARRANTY_CLAIM_OPEN_STATUSES)) add(c.projectId, 'warranty_claim_open');
        const soon = addDays(bangkokToday(this.clock.now()), WARRANTY_NOTICE_DAYS);
        for (const w of await this.repo.warrantiesForProjects(workspaceId, projectIds)) {
            if (w.status === 'active' && w.endDate <= soon) add(w.projectId, 'warranty_expiring');
        }
        for (const [id, s] of alerts) out.set(id, { alerts: [...s] });
        return out;
    }

    /** One task per claim still being worked on (open / assigned / in progress). */
    async portalClaims(ctx: PortalContext): Promise<PortalTaskItem[]> {
        if (!(await this.flags.isEnabled(ctx.workspaceId, MODULE))) return [];
        const claims = await this.repo.claimsOfProjects(ctx.workspaceId, [...ctx.projects.keys()], WARRANTY_CLAIM_OPEN_STATUSES);
        return claims.filter(c => OPEN.has(c.status)).map(c => ({
            kind: 'warranty_claim_open' as const,
            params: { number: c.number ?? '', description: c.description.slice(0, 80) },
            href: warrantyHref(c.projectId),
            dueDate: c.dueDate,
            amount: null,
            projectId: c.projectId,
        }));
    }

    /**
     * `warranty.expiring` once per warranty, 30 days (or less) before its end date, to the members who manage handovers;
     * a warranty past its end date becomes `expired`. (Retention release and guarantee expiry notices come from the
     * billing and contracts sweeps, D-354.)
     */
    async warrantySweep(ctx: SweepContext): Promise<void> {
        if (!this.flags.platformEnabled(MODULE)) return;
        const active = new Map<WorkspaceId, boolean>();
        for (const w of await this.repo.activeWarrantiesEndingBy(addDays(ctx.today, WARRANTY_NOTICE_DAYS), 2000)) {
            try {
                let on = active.get(w.workspaceId);
                if (on === undefined) {
                    on = await this.flags.isEnabled(w.workspaceId, MODULE);
                    active.set(w.workspaceId, on);
                }
                if (!on) continue;
                if (w.endDate < ctx.today) {
                    await this.repo.saveWarranty({ ...w, status: 'expired', updatedAt: ctx.now });
                    continue;
                }
                // The end date as the mark's date: one notice per warranty (and again only if the date changes).
                if (!(await this.marks.markOnce(WARRANTY_SWEEP, w.id, w.endDate))) continue;
                const toUserIds = await this.notices.managers(w.workspaceId, null);
                if (toUserIds.length === 0) continue;
                await this.notifier.notify({
                    template: 'warranty.expiring', toUserIds,
                    payload: {
                        projectName: await this.notices.projectName(w.workspaceId, w.projectId), date: w.endDate, href: warrantyHref(w.projectId),
                    },
                });
            } catch (e) {
                this.logger.error(`${WARRANTY_SWEEP} ${w.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
}
