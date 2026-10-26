import { and, desc, eq, lt } from 'drizzle-orm';
import { ACTIVITY_ACTIONS, type ActivityAction } from '@contrack/contract';
import { isDocKey } from '@contrack/domain/sync';
import { asProjectId, asUserId, asWorkspaceId, type ProjectId, type WorkspaceId } from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { activityLog } from '../../../../shared/infrastructure/database/schema';
import { ActivityRepository, type ActivityPage } from '../../application/ports/activity.repository';
import { ActivityEntry, type NewActivity } from '../../domain/entities/activity-entry.entity';

type ActivityRow = typeof activityLog.$inferSelect;

const isAction = (v: string): v is ActivityAction => (ACTIVITY_ACTIONS as readonly string[]).includes(v);

function toEntity(row: ActivityRow): ActivityEntry {
    if (!isAction(row.action)) throw new Error(`activity ${row.id.toString()} has unknown action "${row.action}"`);
    const docKey = row.docKey;
    if (docKey !== null && !isDocKey(docKey)) throw new Error(`activity ${row.id.toString()} has unknown doc key`);
    return ActivityEntry.rehydrate({
        id: row.id,
        workspaceId: asWorkspaceId(row.workspaceId),
        projectId: asProjectId(row.projectId),
        userId: asUserId(row.userId),
        action: row.action,
        docKey,
        at: row.at,
    });
}

export class DrizzleActivityRepository extends ActivityRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async append(entry: NewActivity): Promise<ActivityEntry> {
        const rows = await this.ctx.executor.insert(activityLog)
            .values({
                workspaceId: entry.workspaceId,
                projectId: entry.projectId,
                userId: entry.userId,
                action: entry.action,
                docKey: entry.docKey,
                at: entry.at,
            })
            .returning();
        const row = rows[0];
        if (row === undefined) throw new Error('activity insert returned no row');
        return toEntity(row);
    }

    async list(workspaceId: WorkspaceId, projectId: ProjectId, page: ActivityPage): Promise<ActivityEntry[]> {
        const conditions = [eq(activityLog.workspaceId, workspaceId), eq(activityLog.projectId, projectId)];
        if (page.before !== undefined) conditions.push(lt(activityLog.id, page.before));
        const rows = await this.ctx.executor.select().from(activityLog)
            .where(and(...conditions))
            .orderBy(desc(activityLog.id))
            .limit(Math.max(0, page.limit));
        return rows.map(toEntity);
    }

    async deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.delete(activityLog)
            .where(and(eq(activityLog.workspaceId, workspaceId), eq(activityLog.projectId, projectId)));
    }
}
