import type { BoqVersionKind } from '@contrack/contract';
import { and, asc, eq } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asRevisionId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { projects } from '../../../../shared/infrastructure/database/schema';
import { boqVersionLines, boqVersionSections, boqVersions } from '../../../../shared/infrastructure/database/schema-boq-control';
import { BoqVersionRepository, type BoqVersionRecord, type BoqVersionRows } from '../../application/ports/boq-version.repository';

type VersionRow = typeof boqVersions.$inferSelect;

const toRecord = (r: VersionRow): BoqVersionRecord => ({
    id: r.id,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    revisionId: asRevisionId(r.revisionId),
    versionNo: r.versionNo,
    kind: r.kind,
    engineVersion: r.engineVersion,
    constructionTotal: r.constructionTotal,
    preConstructionTotal: r.preConstructionTotal,
    matTotal: r.matTotal,
    labTotal: r.labTotal,
    lineCount: r.lineCount,
    createdBy: asUserId(r.createdBy),
    createdAt: r.createdAt,
});

/** Rows per insert statement (18 columns × 500 stays far below PostgreSQL's 65535 parameters). */
const CHUNK = 500;

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleBoqVersionRepository extends BoqVersionRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async lockProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.select({ id: projects.id }).from(projects)
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId))).for('update');
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BoqVersionRecord[]> {
        const rows = await this.ctx.executor.select().from(boqVersions)
            .where(and(eq(boqVersions.workspaceId, workspaceId), eq(boqVersions.projectId, projectId)))
            .orderBy(asc(boqVersions.versionNo));
        return rows.map(toRecord);
    }

    async findById(versionId: string): Promise<BoqVersionRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(boqVersions).where(eq(boqVersions.id, versionId)).limit(1);
        return row === undefined ? undefined : toRecord(row);
    }

    async rows(workspaceId: WorkspaceId, versionId: string): Promise<BoqVersionRows> {
        const sections = await this.ctx.executor.select().from(boqVersionSections)
            .where(and(eq(boqVersionSections.workspaceId, workspaceId), eq(boqVersionSections.versionId, versionId)))
            .orderBy(asc(boqVersionSections.sectionNo));
        const lines = await this.ctx.executor.select().from(boqVersionLines)
            .where(and(eq(boqVersionLines.workspaceId, workspaceId), eq(boqVersionLines.versionId, versionId)))
            .orderBy(asc(boqVersionLines.sort));
        return {
            sections: sections.map(({ versionId: _v, workspaceId: _w, ...s }) => s),
            lines: lines.map(({ versionId: _v, workspaceId: _w, ...l }) => ({
                ...l,
                materialBasis: l.materialBasis === 'net' ? 'net' : 'gross',
                labourBasis: l.labourBasis === 'gross' ? 'gross' : 'net',
            })),
        };
    }

    async insert(version: BoqVersionRecord, rows: BoqVersionRows): Promise<void> {
        const { id: versionId, workspaceId } = version;
        await this.ctx.executor.insert(boqVersions).values({ ...version });
        if (rows.sections.length > 0) {
            await this.ctx.executor.insert(boqVersionSections).values(rows.sections.map(s => ({ ...s, versionId, workspaceId })));
        }
        for (let i = 0; i < rows.lines.length; i += CHUNK) {
            await this.ctx.executor.insert(boqVersionLines)
                .values(rows.lines.slice(i, i + CHUNK).map(l => ({ ...l, versionId, workspaceId })));
        }
    }

    async setKind(workspaceId: WorkspaceId, versionId: string, kind: BoqVersionKind): Promise<void> {
        await this.ctx.executor.update(boqVersions).set({ kind })
            .where(and(eq(boqVersions.workspaceId, workspaceId), eq(boqVersions.id, versionId)));
    }

    async deleteByProject(): Promise<void> {
        // PostgreSQL drops the versions with the project (tenant FK on delete cascade).
    }
}
