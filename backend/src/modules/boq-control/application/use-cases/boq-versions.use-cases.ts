import { Injectable, Logger } from '@nestjs/common';
import type { BoqVersionCompareDto, BoqVersionCompareQuery, BoqVersionDetailDto, BoqVersionDto } from '@contrack/contract';
import { diffBoqVersions } from '@contrack/domain/boq-control/diff';
import { type BoqVersionContent, boqVersionLines } from '@contrack/domain/boq-control/version-lines';
import { ENGINE_VERSION, type Project as BoqProject, computeProject } from '@contrack/domain/project';
import { ModuleAccess } from '../../../../shared/application/module-access';
import {
    IdGenerator, ModuleFlags, ProjectReader, type RevisionCreated, type RevisionInfo, RevisionLookup, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, RevisionId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { BoqVersionRepository, type BoqVersionRecord } from '../ports/boq-version.repository';

const MODULE = 'boq-control';

/** The BOQ of a project snapshot, as stored lines; undefined when the snapshot no longer computes. */
function contentOf(project: BoqProject): BoqVersionContent | undefined {
    try {
        return boqVersionLines(computeProject(project).boq);
    } catch {
        return undefined;
    }
}

const toDto = (v: BoqVersionRecord, revision: RevisionInfo | undefined): BoqVersionDto => ({
    id: v.id,
    projectId: v.projectId,
    revisionId: v.revisionId,
    label: revision?.label ?? '',
    note: revision?.note ?? null,
    versionNo: v.versionNo,
    kind: v.kind,
    engineVersion: v.engineVersion,
    constructionTotal: v.constructionTotal,
    preConstructionTotal: v.preConstructionTotal,
    matTotal: v.matTotal,
    labTotal: v.labTotal,
    lineCount: v.lineCount,
    createdBy: v.createdBy,
    createdAt: v.createdAt.toISOString(),
});

/**
 * Keeps `boq_versions` in step with `project_revisions`: one version per revision, numbered in revision order.
 * Every path (the revision hook and the lazy backfill when versions are read) first creates the versions missing for
 * older revisions, so version numbers always follow the revisions' creation order.
 */
@Injectable()
export class BoqVersionRecorder {
    private readonly logger = new Logger(BoqVersionRecorder.name);

    constructor(
        private readonly repo: BoqVersionRepository,
        private readonly revisions: RevisionLookup,
        private readonly flags: ModuleFlags,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
    ) {}

    /** RevisionHooks entry: runs inside CreateRevisionUseCase's transaction (the project row is already locked). */
    async onRevisionCreated(revision: RevisionCreated): Promise<void> {
        if (!(await this.flags.isEnabled(revision.workspaceId, MODULE))) return;
        await this.syncLocked(revision.workspaceId, revision.projectId, new Map([[revision.id, revision.snapshot]]));
    }

    /** Versions of the project (version_no ascending) and its revisions, backfilling the missing versions first. */
    async ensure(workspaceId: WorkspaceId, projectId: ProjectId): Promise<{ versions: BoqVersionRecord[]; revisions: RevisionInfo[] }> {
        const versions = await this.repo.listByProject(workspaceId, projectId);
        const revisions = await this.revisions.list(workspaceId, projectId);
        const have = new Set<string>(versions.map(v => v.revisionId));
        if (revisions.every(r => have.has(r.id))) return { versions, revisions };
        const synced = await this.uow.run(async () => {
            await this.repo.lockProject(workspaceId, projectId);
            return this.syncLocked(workspaceId, projectId, new Map());
        });
        return { versions: synced, revisions: await this.revisions.list(workspaceId, projectId) };
    }

    /** Same backfill inside the caller's transaction, which already holds the project row lock. */
    async syncInTransaction(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BoqVersionRecord[]> {
        return this.syncLocked(workspaceId, projectId, new Map());
    }

    private async syncLocked(
        workspaceId: WorkspaceId, projectId: ProjectId, known: Map<RevisionId, BoqProject>,
    ): Promise<BoqVersionRecord[]> {
        const versions = await this.repo.listByProject(workspaceId, projectId);
        const have = new Set<string>(versions.map(v => v.revisionId));
        let next = versions.reduce((max, v) => Math.max(max, v.versionNo), 0) + 1;
        for (const revision of await this.revisions.list(workspaceId, projectId)) {
            if (have.has(revision.id)) continue;
            const snapshot = known.get(revision.id) ?? await this.revisions.snapshot(workspaceId, projectId, revision.id);
            const content = snapshot === undefined ? undefined : contentOf(snapshot);
            if (content === undefined) {
                this.logger.warn(`revision ${revision.id} of project ${projectId} does not compute; no BOQ version made`);
                continue;
            }
            const record: BoqVersionRecord = {
                id: this.ids.newId(),
                workspaceId,
                projectId,
                revisionId: revision.id,
                versionNo: next,
                kind: 'snapshot',
                engineVersion: ENGINE_VERSION,
                constructionTotal: content.totals.constructionTotal,
                preConstructionTotal: content.totals.preConstructionTotal,
                matTotal: content.totals.matTotal,
                labTotal: content.totals.labTotal,
                lineCount: content.totals.lineCount,
                createdBy: revision.createdBy,
                createdAt: revision.createdAt,
            };
            await this.repo.insert(record, { sections: content.sections, lines: content.lines });
            versions.push(record);
            have.add(revision.id);
            next += 1;
        }
        return versions;
    }
}

/** GET /projects/:projectId/boq-versions — `projects.read`; newest first. */
@Injectable()
export class ListBoqVersionsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly recorder: BoqVersionRecorder) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<BoqVersionDto[], DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['projects.read'], write: false });
        if (!grant.ok) return grant;
        const { versions, revisions } = await this.recorder.ensure(grant.value.workspaceId, projectId);
        const byId = new Map<string, RevisionInfo>(revisions.map(r => [r.id, r]));
        return ok([...versions].sort((a, b) => b.versionNo - a.versionNo).map(v => toDto(v, byId.get(v.revisionId))));
    }
}

/** A version the caller may read (not_found when it is missing or the caller has no access to its project). */
@Injectable()
export class BoqVersionReader {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: BoqVersionRepository,
        private readonly revisions: RevisionLookup,
    ) {}

    async version(userId: UserId, versionId: string, projectId?: ProjectId): Promise<Result<BoqVersionRecord, DomainError>> {
        const version = await this.repo.findById(versionId);
        if (version === undefined || (projectId !== undefined && version.projectId !== projectId)) {
            // Same order as ModuleAccess for a project the caller cannot see: answer not_found only after access.
            if (projectId !== undefined) {
                const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['projects.read'], write: false });
                if (!grant.ok) return grant;
            }
            return err(DomainError.notFound('BoqVersion'));
        }
        const grant = await this.access.toProject(userId, version.projectId, MODULE, { permissions: ['projects.read'], write: false });
        if (!grant.ok) return grant;
        if (grant.value.workspaceId !== version.workspaceId) return err(DomainError.notFound('BoqVersion'));
        return ok(version);
    }

    async dto(version: BoqVersionRecord): Promise<BoqVersionDto> {
        const revisions = await this.revisions.list(version.workspaceId, version.projectId);
        return toDto(version, revisions.find(r => r.id === version.revisionId));
    }
}

/** GET /boq-versions/:versionId — `projects.read`; with sections and lines. */
@Injectable()
export class GetBoqVersionUseCase {
    constructor(private readonly reader: BoqVersionReader, private readonly repo: BoqVersionRepository) {}

    async execute(userId: UserId, versionId: string): Promise<Result<BoqVersionDetailDto, DomainError>> {
        const found = await this.reader.version(userId, versionId);
        if (!found.ok) return found;
        const rows = await this.repo.rows(found.value.workspaceId, found.value.id);
        return ok({ version: await this.reader.dto(found.value), sections: rows.sections, lines: rows.lines });
    }
}

/** GET /projects/:projectId/boq-versions/compare?from=&to= — `to` = a version of the same project or `live`. */
@Injectable()
export class CompareBoqVersionsUseCase {
    constructor(
        private readonly reader: BoqVersionReader,
        private readonly repo: BoqVersionRepository,
        private readonly projects: ProjectReader,
    ) {}

    async execute(userId: UserId, projectId: ProjectId, query: BoqVersionCompareQuery): Promise<Result<BoqVersionCompareDto, DomainError>> {
        const from = await this.reader.version(userId, query.from, projectId);
        if (!from.ok) return from;
        const before = await this.repo.rows(from.value.workspaceId, from.value.id);

        let to: BoqVersionDto | null = null;
        let after: { sections: BoqVersionContent['sections']; lines: BoqVersionContent['lines'] };
        if (query.to === 'live') {
            const read = await this.projects.read(projectId);
            if (read?.workspaceId !== from.value.workspaceId) return err(DomainError.notFound('Project'));
            const live = contentOf(read.project);
            if (live === undefined) {
                return err(DomainError.unprocessable('the project no longer computes', { reason: 'project_does_not_compute' }));
            }
            after = live;
        } else {
            const target = await this.reader.version(userId, query.to, projectId);
            if (!target.ok) return target;
            to = await this.reader.dto(target.value);
            after = await this.repo.rows(target.value.workspaceId, target.value.id);
        }
        const diff = diffBoqVersions(before, after);
        return ok({ from: await this.reader.dto(from.value), to, ...diff });
    }
}
