import { and, asc, eq, notInArray, sql } from 'drizzle-orm';
import { type ProjectId, type UserId, type WorkspaceId, asProjectId } from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { projectTaskLags } from '../../../../shared/infrastructure/database/schema';
import { type ProjectTaskLagRows, ProjectTaskLagRepository } from '../../application/ports/project-task-lag.repository';
import type { TaskLag } from '../../domain/value-objects/task-lag.value-object';

/** Numeric task order ("1.9" before "1.10"); the check constraint guarantees the "<major>.<minor>" shape. */
const taskOrder = [
    asc(sql`split_part(${projectTaskLags.taskId}, '.', 1)::int`),
    asc(sql`split_part(${projectTaskLags.taskId}, '.', 2)::int`),
];

export class DrizzleProjectTaskLagRepository extends ProjectTaskLagRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async list(workspaceId: WorkspaceId, projectId: ProjectId): Promise<TaskLag[]> {
        return this.ctx.executor
            .select({ taskId: projectTaskLags.taskId, days: projectTaskLags.days, note: projectTaskLags.note })
            .from(projectTaskLags)
            .where(and(eq(projectTaskLags.workspaceId, workspaceId), eq(projectTaskLags.projectId, projectId)))
            .orderBy(...taskOrder);
    }

    async listByWorkspace(workspaceId: WorkspaceId): Promise<ProjectTaskLagRows[]> {
        const rows = await this.ctx.executor
            .select({ projectId: projectTaskLags.projectId, taskId: projectTaskLags.taskId, days: projectTaskLags.days, note: projectTaskLags.note })
            .from(projectTaskLags)
            .where(eq(projectTaskLags.workspaceId, workspaceId))
            .orderBy(asc(projectTaskLags.projectId), ...taskOrder);
        const out: ProjectTaskLagRows[] = [];
        for (const { projectId, ...lag } of rows) {
            const last = out.at(-1);
            if (last?.projectId === projectId) last.lags.push(lag);
            else out.push({ projectId: asProjectId(projectId), lags: [lag] });
        }
        return out;
    }

    async replace(workspaceId: WorkspaceId, projectId: ProjectId, lags: readonly TaskLag[], updatedBy: UserId, at: Date): Promise<void> {
        await this.ctx.transaction(async () => {
            const scope = and(eq(projectTaskLags.workspaceId, workspaceId), eq(projectTaskLags.projectId, projectId));
            const keep = lags.map(l => l.taskId);
            await this.ctx.executor.delete(projectTaskLags)
                .where(keep.length === 0 ? scope : and(scope, notInArray(projectTaskLags.taskId, keep)));
            if (lags.length === 0) return;
            await this.ctx.executor.insert(projectTaskLags)
                .values(lags.map(l => ({ projectId, workspaceId, taskId: l.taskId, days: l.days, note: l.note, updatedBy, updatedAt: at })))
                .onConflictDoUpdate({
                    target: [projectTaskLags.projectId, projectTaskLags.taskId],
                    set: {
                        days: sql`excluded.days`, note: sql`excluded.note`,
                        updatedBy: sql`excluded.updated_by`, updatedAt: sql`excluded.updated_at`,
                    },
                    // An unchanged row keeps who changed it last, and when.
                    setWhere: sql`(${projectTaskLags.days}, ${projectTaskLags.note}) is distinct from (excluded.days, excluded.note)`,
                });
        });
    }

    async deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.delete(projectTaskLags)
            .where(and(eq(projectTaskLags.workspaceId, workspaceId), eq(projectTaskLags.projectId, projectId)));
    }
}
