import { and, asc, eq } from 'drizzle-orm';
import { asProjectId, asUserId, asWorkspaceId, type ProjectId, type UserId, type WorkspaceId } from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { levelAssignments } from '../../../../shared/infrastructure/database/schema';
import { AssignmentRepository } from '../../application/ports/assignment.repository';
import { LevelAssignment } from '../../domain/entities/level-assignment.entity';

type AssignmentRow = typeof levelAssignments.$inferSelect;

function toEntity(row: AssignmentRow): LevelAssignment {
    return LevelAssignment.rehydrate({
        projectId: asProjectId(row.projectId),
        workspaceId: asWorkspaceId(row.workspaceId),
        levelId: row.levelId,
        userId: asUserId(row.userId),
        assignedBy: asUserId(row.assignedBy),
        assignedAt: row.assignedAt,
    });
}

export class DrizzleAssignmentRepository extends AssignmentRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<LevelAssignment[]> {
        const rows = await this.ctx.executor.select().from(levelAssignments)
            .where(and(eq(levelAssignments.workspaceId, workspaceId), eq(levelAssignments.projectId, projectId)))
            .orderBy(asc(levelAssignments.levelId));
        return rows.map(toEntity);
    }

    async find(workspaceId: WorkspaceId, projectId: ProjectId, levelId: string): Promise<LevelAssignment | undefined> {
        const rows = await this.ctx.executor.select().from(levelAssignments)
            .where(and(
                eq(levelAssignments.workspaceId, workspaceId),
                eq(levelAssignments.projectId, projectId),
                eq(levelAssignments.levelId, levelId),
            ))
            .limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async save(assignment: LevelAssignment): Promise<void> {
        const a = assignment.toProps();
        await this.ctx.executor.insert(levelAssignments)
            .values({
                projectId: a.projectId,
                workspaceId: a.workspaceId,
                levelId: a.levelId,
                userId: a.userId,
                assignedBy: a.assignedBy,
                assignedAt: a.assignedAt,
            })
            .onConflictDoUpdate({
                target: [levelAssignments.projectId, levelAssignments.levelId],
                set: { userId: a.userId, assignedBy: a.assignedBy, assignedAt: a.assignedAt },
                // Never move a row across tenants.
                setWhere: eq(levelAssignments.workspaceId, a.workspaceId),
            });
    }

    async remove(workspaceId: WorkspaceId, projectId: ProjectId, levelId: string): Promise<void> {
        await this.ctx.executor.delete(levelAssignments)
            .where(and(
                eq(levelAssignments.workspaceId, workspaceId),
                eq(levelAssignments.projectId, projectId),
                eq(levelAssignments.levelId, levelId),
            ));
    }

    async removeByUser(workspaceId: WorkspaceId, userId: UserId): Promise<LevelAssignment[]> {
        const rows = await this.ctx.executor.delete(levelAssignments)
            .where(and(eq(levelAssignments.workspaceId, workspaceId), eq(levelAssignments.userId, userId)))
            .returning();
        return rows.map(toEntity);
    }

    async deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.delete(levelAssignments)
            .where(and(eq(levelAssignments.workspaceId, workspaceId), eq(levelAssignments.projectId, projectId)));
    }
}
