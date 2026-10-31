import { Injectable } from '@nestjs/common';
import {
    EMPTY_PROJECT_ROLLUP, type HubProjectDetailDto, type HubProjectDto, type HubProjectFields, type HubProjectListQuery,
    type HubProjectStatus, type HubSummaryDto, PROJECT_STATUSES, type ProjectDto, type ProjectRollup, type ProjectType,
    type UpdateHubProjectRequest,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { defaultProjectTypeFor, resolveSettings } from '@contrack/domain/erp/profiles';
import { round2, sumMoney } from '@contrack/domain/money';
import { ModuleAccess } from '../../../../shared/application/module-access';
import {
    AuditLog, Clock, CompanyProfiles, CustomerLookup, DocumentNumbering, HubRollups, ModuleFlags, ProjectCatalog, UnitOfWork,
    UserDirectory, WorkspaceDirectory,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, asProjectId, asUserId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { checkUserTransition, nextStatusesFor } from '../../domain/hub-state';
import { HubProjectRepository } from '../ports/hub-project.repository';

const customerName = (c: { nameTh: string; nameEn: string }): string => (c.nameTh !== '' ? c.nameTh : c.nameEn);

const duplicateCode = (): DomainError =>
    DomainError.conflict('Another project of the workspace has this code', { reason: 'duplicate_project_code' });

/** Thrown inside `uow.run` to roll the transaction back and answer with `error` (a returned err would commit). */
class Rollback extends Error {
    constructor(readonly error: DomainError) {
        super(error.message);
    }
}

/**
 * Builds hub rows for many projects of one workspace with a constant number of reads: the hub columns (1 query), the
 * customers (1 query), and one call per active roll-up source (each batched over every project).
 */
@Injectable()
export class HubProjectViews {
    constructor(
        private readonly repo: HubProjectRepository,
        private readonly customers: CustomerLookup,
        private readonly rollups: HubRollups,
        private readonly flags: ModuleFlags,
    ) {}

    hubFields(workspaceId: WorkspaceId, projects: readonly ProjectDto[]): Promise<Map<ProjectId, HubProjectFields>> {
        return this.repo.findMany(workspaceId, projects.map(p => asProjectId(p.id)));
    }

    async customerNames(workspaceId: WorkspaceId, hub: Iterable<HubProjectFields>): Promise<Map<string, string>> {
        const ids = [...new Set([...hub].map(h => h.customerId).filter((id): id is string => id !== null))];
        const found = await this.customers.findMany(workspaceId, ids);
        return new Map(found.map(c => [c.id, customerName(c)]));
    }

    async rollupsOf(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, ProjectRollup>> {
        const out = new Map<ProjectId, ProjectRollup>(projectIds.map(id => [id, { ...EMPTY_PROJECT_ROLLUP, alerts: [] }]));
        if (projectIds.length === 0) return out;
        for (const { module, source } of this.rollups.sources()) {
            if (!(await this.flags.isEnabled(workspaceId, module))) continue;
            const figures = await source(workspaceId, projectIds);
            for (const [id, partial] of figures) {
                const row = out.get(id);
                if (row === undefined) continue;
                const { alerts, ...rest } = partial;
                for (const [key, value] of Object.entries(rest) as [string, unknown][]) {
                    if (value !== undefined) (row as unknown as Record<string, unknown>)[key] = value;
                }
                if (alerts !== undefined) row.alerts.push(...alerts);
            }
        }
        return out;
    }

    /** Rows in the order of `projects`; `hub` / `names` may be passed when the caller already read them. */
    async rows(
        workspaceId: WorkspaceId, projects: readonly ProjectDto[],
        hub?: Map<ProjectId, HubProjectFields>, names?: Map<string, string>,
    ): Promise<HubProjectDto[]> {
        const fields = hub ?? await this.hubFields(workspaceId, projects);
        const customerNames = names ?? await this.customerNames(workspaceId, fields.values());
        const rollups = await this.rollupsOf(workspaceId, projects.map(p => asProjectId(p.id)));
        return projects.map(project => {
            const id = asProjectId(project.id);
            const h = fields.get(id);
            if (h === undefined) throw new Error(`project ${project.id} has no hub row`);
            const rollup = rollups.get(id) ?? { ...EMPTY_PROJECT_ROLLUP, alerts: [] };
            return { project, hub: h, customerName: h.customerId === null ? null : customerNames.get(h.customerId) ?? null, rollup };
        });
    }
}

/** GET /workspaces/:workspaceId/hub/projects — `projects.read`. Filters run in memory over the workspace's projects. */
@Injectable()
export class ListHubProjectsUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly catalog: ProjectCatalog,
        private readonly views: HubProjectViews,
        private readonly company: CompanyProfiles,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: HubProjectListQuery): Promise<Result<HubProjectDto[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, 'project-hub', 'projects.read');
        if (!grant.ok) return grant;
        const projects = await this.catalog.list(workspaceId, { archived: query.archived });
        const hub = await this.views.hubFields(workspaceId, projects);
        const names = await this.views.customerNames(workspaceId, hub.values());
        let defaultType: ProjectType | undefined;
        if (query.type !== undefined) {
            const profile = await this.company.get(workspaceId);
            defaultType = profile.defaultProjectType ?? defaultProjectTypeFor(profile.businessProfiles);
        }
        const q = query.q?.toLowerCase() ?? '';
        const statuses = query.status !== undefined && query.status.length > 0 ? new Set(query.status) : undefined;
        const kept = projects.filter(p => {
            const h = hub.get(asProjectId(p.id));
            if (h === undefined) return false;
            if (statuses !== undefined && !statuses.has(h.status)) return false;
            if (query.customerId !== undefined && h.customerId !== query.customerId.toLowerCase()) return false;
            if (query.type !== undefined && (h.projectType ?? defaultType) !== query.type) return false;
            if (q !== '') {
                const text = [p.name, h.code ?? '', h.siteAddress, h.customerId === null ? '' : names.get(h.customerId) ?? ''].join('\n').toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });
        return ok(await this.views.rows(workspaceId, kept, hub, names));
    }
}

/** GET /workspaces/:workspaceId/hub/summary — `projects.read`; active (not archived) projects. */
@Injectable()
export class HubSummaryUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly catalog: ProjectCatalog,
        private readonly views: HubProjectViews,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId): Promise<Result<HubSummaryDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, 'project-hub', 'projects.read');
        if (!grant.ok) return grant;
        const projects = await this.catalog.list(workspaceId, { archived: false });
        const hub = await this.views.hubFields(workspaceId, projects);
        const rollups = [...(await this.views.rollupsOf(workspaceId, projects.map(p => asProjectId(p.id)))).values()];
        const byStatus = Object.fromEntries(PROJECT_STATUSES.map(s => [s, 0])) as Record<HubProjectStatus, number>;
        for (const h of hub.values()) byStatus[h.status] += 1;
        const total = (values: (number | null)[]): number | null => {
            const present = values.filter((v): v is number => v !== null);
            return present.length === 0 ? null : sumMoney(present);
        };
        return ok({
            total: projects.length,
            byStatus,
            contractValue: total(rollups.map(r => r.contractValue)),
            outstandingReceivable: total(rollups.map(r => (r.billedToDate === null ? null : round2(Math.max(0, r.billedToDate - (r.receivedToDate ?? 0)))))),
            overdueReceivable: total(rollups.map(r => r.overdueReceivable)),
            generatedAt: this.clock.now().toISOString(),
        });
    }
}

/** GET /projects/:projectId/hub — `projects.read`. */
@Injectable()
export class GetHubProjectUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly catalog: ProjectCatalog,
        private readonly views: HubProjectViews,
        private readonly company: CompanyProfiles,
        private readonly users: UserDirectory,
    ) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<HubProjectDetailDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, 'project-hub', { permissions: ['projects.read'], write: false });
        if (!grant.ok) return grant;
        const { workspaceId, role, archived } = grant.value;
        const project = await this.catalog.find(workspaceId, projectId);
        if (project === undefined) return err(DomainError.notFound('Project'));
        const [row] = await this.views.rows(workspaceId, [project]);
        if (row === undefined) return err(DomainError.notFound('Project'));
        const profile = await this.company.get(workspaceId);
        const effectiveProjectType = row.hub.projectType ?? profile.defaultProjectType ?? defaultProjectTypeFor(profile.businessProfiles);
        let managerName: string | null = null;
        if (row.hub.managerUserId !== null) {
            const manager = asUserId(row.hub.managerUserId);
            managerName = (await this.users.findMany([manager])).get(manager)?.displayName ?? null;
        }
        const canEdit = can(role, 'projects.edit') && !archived;
        return ok({
            ...row,
            effectiveProjectType,
            effectiveSettings: resolveSettings(effectiveProjectType, profile.defaults, row.hub.settings),
            managerName,
            canEdit,
            nextStatuses: canEdit ? nextStatusesFor(row.hub.status, role) : [],
        });
    }
}

/** Field names whose value changed (for the audit trail). */
function changedFields(before: HubProjectFields, after: HubProjectFields): string[] {
    return (Object.keys(after) as (keyof HubProjectFields)[])
        .filter(k => k !== 'status' && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

/**
 * PATCH /projects/:projectId/hub — `projects.edit` (archived → 409 `project_archived`). `customerId` of another workspace
 * → 404; a manager who is not a member → 400; a status off the transition table → 409 `invalid_transition`
 * (`closed → warranty` owner only → 403); a code another project has → 409 `duplicate_project_code`.
 */
@Injectable()
export class UpdateHubProjectUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: HubProjectRepository,
        private readonly customers: CustomerLookup,
        private readonly members: WorkspaceDirectory,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly detail: GetHubProjectUseCase,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: UpdateHubProjectRequest }): Promise<Result<HubProjectDetailDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, 'project-hub', { permissions: ['projects.edit'], write: true });
        if (!grant.ok) return grant;
        const { workspaceId, role } = grant.value;
        const customerId = body.customerId === undefined || body.customerId === null ? body.customerId : body.customerId.toLowerCase();
        if (customerId !== undefined && customerId !== null && (await this.customers.find(workspaceId, customerId)) === undefined) {
            return err(DomainError.notFound('Customer'));
        }
        const managerUserId = body.managerUserId === undefined || body.managerUserId === null ? body.managerUserId : body.managerUserId.toLowerCase();
        if (managerUserId !== undefined && managerUserId !== null && !(await this.members.memberIds(workspaceId)).includes(asUserId(managerUserId))) {
            return err(DomainError.validation('The project manager must be a member of the workspace'));
        }
        const saved = await this.uow.run(async (): Promise<Result<void, DomainError>> => {
            const before = await this.repo.lockForUpdate(workspaceId, projectId);
            if (before === undefined) return err(DomainError.notFound('Project'));
            const { settings, settingsReset, ...rest } = body;
            const after: HubProjectFields = { ...before, settings: { ...before.settings } };
            for (const [key, value] of Object.entries(rest) as [string, unknown][]) {
                if (value !== undefined) (after as unknown as Record<string, unknown>)[key] = value;
            }
            if (customerId !== undefined) after.customerId = customerId;
            if (managerUserId !== undefined) after.managerUserId = managerUserId;
            if (settings !== undefined) Object.assign(after.settings, settings);
            if (settingsReset !== undefined && settingsReset.length > 0) {
                const reset = new Set<string>(settingsReset);
                after.settings = Object.fromEntries(Object.entries(after.settings).filter(([k]) => !reset.has(k)));
            }
            if (after.plannedStart !== null && after.plannedFinish !== null && after.plannedFinish < after.plannedStart) {
                return err(DomainError.validation('The planned finish is before the planned start'));
            }
            if (after.actualStart !== null && after.actualFinish !== null && after.actualFinish < after.actualStart) {
                return err(DomainError.validation('The actual finish is before the actual start'));
            }
            if (after.status !== before.status) {
                const allowed = checkUserTransition(before.status, after.status, role);
                if (!allowed.ok) return allowed;
            }
            if (after.code !== null && after.code !== before.code && (await this.repo.codeTaken(workspaceId, after.code, projectId))) {
                return err(duplicateCode());
            }
            const changed = changedFields(before, after);
            if (changed.length === 0 && after.status === before.status) return ok(undefined);
            await this.repo.save(workspaceId, projectId, after);
            if (after.status !== before.status) {
                await this.audit.record({
                    workspaceId, projectId, actor: userId, entityType: 'project', entityId: projectId, action: 'status_change',
                    data: { status: [before.status, after.status] },
                });
            }
            if (changed.length > 0) {
                await this.audit.record({
                    workspaceId, projectId, actor: userId, entityType: 'project', entityId: projectId, action: 'hub_update', data: { changed },
                });
            }
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        return this.detail.execute(userId, projectId);
    }
}

/**
 * POST /projects/:projectId/hub/code — `projects.edit`. Issues the next `project` number (DocumentNumbering, dated today
 * in Bangkok) as the code; the project already has a code → 409 `project_code_exists`.
 */
@Injectable()
export class AssignHubProjectCodeUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: HubProjectRepository,
        private readonly numbering: DocumentNumbering,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly detail: GetHubProjectUseCase,
    ) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<HubProjectDetailDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, 'project-hub', { permissions: ['projects.edit'], write: true });
        if (!grant.ok) return grant;
        const { workspaceId } = grant.value;
        try {
            const saved = await this.uow.run(async (): Promise<Result<void, DomainError>> => {
                const before = await this.repo.lockForUpdate(workspaceId, projectId);
                if (before === undefined) return err(DomainError.notFound('Project'));
                if (before.code !== null) {
                    return err(DomainError.conflict('The project already has a code', { reason: 'project_code_exists', code: before.code }));
                }
                const issued = await this.numbering.issue({
                    workspaceId, docType: 'project', issueDate: bangkokToday(this.clock.now()), subjectType: 'project',
                    subjectId: projectId, projectId, issuedBy: userId,
                });
                if (!issued.ok) return issued;
                // A code typed by hand may already hold the number: roll the number back rather than leave a gap.
                if (await this.repo.codeTaken(workspaceId, issued.value.number, projectId)) throw new Rollback(duplicateCode());
                await this.repo.save(workspaceId, projectId, { ...before, code: issued.value.number });
                await this.audit.record({
                    workspaceId, projectId, actor: userId, entityType: 'project', entityId: projectId, action: 'hub_update',
                    data: { changed: ['code'], code: issued.value.number },
                });
                return ok(undefined);
            });
            if (!saved.ok) return saved;
        } catch (e) {
            if (e instanceof Rollback) return err(e.error);
            throw e;
        }
        return this.detail.execute(userId, projectId);
    }
}
