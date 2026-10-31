import { and, eq, inArray, ne } from 'drizzle-orm';
import type { HubProjectFields } from '@contrack/contract';
import { type ProjectId, type WorkspaceId, asProjectId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { projects } from '../../../../shared/infrastructure/database/schema';
import { HubProjectRepository } from '../../application/ports/hub-project.repository';

/** Only the hub columns (plus the id) are selected and written. */
const hubColumns = {
    id: projects.id,
    code: projects.code,
    status: projects.status,
    projectType: projects.projectType,
    customerId: projects.customerId,
    siteAddress: projects.siteAddress,
    plannedStart: projects.plannedStart,
    plannedFinish: projects.plannedFinish,
    actualStart: projects.actualStart,
    actualFinish: projects.actualFinish,
    managerUserId: projects.managerUserId,
    settings: projects.settings,
    description: projects.description,
};

type HubRow = { id: string } & HubProjectFields;

const toFields = ({ id: _id, ...fields }: HubRow): HubProjectFields => ({ ...fields, settings: { ...fields.settings } });

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleHubProjectRepository extends HubProjectRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findMany(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, HubProjectFields>> {
        const out = new Map<ProjectId, HubProjectFields>();
        if (projectIds.length === 0) return out;
        const rows: HubRow[] = await this.ctx.executor.select(hubColumns).from(projects)
            .where(and(eq(projects.workspaceId, workspaceId), inArray(projects.id, [...projectIds])));
        for (const row of rows) out.set(asProjectId(row.id), toFields(row));
        return out;
    }

    async find(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HubProjectFields | undefined> {
        const [row] = await this.ctx.executor.select(hubColumns).from(projects)
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId))).limit(1);
        return row === undefined ? undefined : toFields(row);
    }

    async lockForUpdate(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HubProjectFields | undefined> {
        const [row] = await this.ctx.executor.select(hubColumns).from(projects)
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId))).for('update');
        return row === undefined ? undefined : toFields(row);
    }

    async save(workspaceId: WorkspaceId, projectId: ProjectId, f: HubProjectFields): Promise<void> {
        await this.ctx.executor.update(projects)
            .set({
                code: f.code, status: f.status, projectType: f.projectType, customerId: f.customerId, siteAddress: f.siteAddress,
                plannedStart: f.plannedStart, plannedFinish: f.plannedFinish, actualStart: f.actualStart, actualFinish: f.actualFinish,
                managerUserId: f.managerUserId, settings: f.settings, description: f.description,
            })
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)));
    }

    async codeTaken(workspaceId: WorkspaceId, code: string, exceptProjectId: ProjectId): Promise<boolean> {
        const rows = await this.ctx.executor.select({ id: projects.id }).from(projects)
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.code, code), ne(projects.id, exceptProjectId))).limit(1);
        return rows.length > 0;
    }

    deleteByProject(): Promise<void> {
        return Promise.resolve();
    }
}
