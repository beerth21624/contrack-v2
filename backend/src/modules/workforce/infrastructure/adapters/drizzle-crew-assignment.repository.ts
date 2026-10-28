import { type SQL, and, asc, count, eq, gte, inArray, lte } from 'drizzle-orm';
import {
    asCrewAssignmentId, asCrewId, asProjectId, asUserId, asWorkspaceId, type CrewAssignmentId, type CrewId, type ProjectId,
    type WorkspaceId,
} from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { crewAssignments } from '../../../../shared/infrastructure/database/schema';
import { type CrewAssignmentFilter, CrewAssignmentRepository } from '../../application/ports/crew-assignment.repository';
import { CrewAssignment } from '../../domain/entities/crew-assignment.entity';

type AssignmentRow = typeof crewAssignments.$inferSelect;

function toEntity(row: AssignmentRow): CrewAssignment {
    return CrewAssignment.rehydrate({
        id: asCrewAssignmentId(row.id),
        workspaceId: asWorkspaceId(row.workspaceId),
        projectId: asProjectId(row.projectId),
        taskId: row.taskId,
        crewId: asCrewId(row.crewId),
        start: row.startDate,
        end: row.endDate,
        note: row.note,
        createdBy: asUserId(row.createdBy),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    });
}

function toRow(assignment: CrewAssignment): AssignmentRow {
    const a = assignment.toProps();
    return {
        id: a.id,
        workspaceId: a.workspaceId,
        projectId: a.projectId,
        crewId: a.crewId,
        taskId: a.taskId,
        startDate: a.start,
        endDate: a.end,
        note: a.note,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
    };
}

export class DrizzleCrewAssignmentRepository extends CrewAssignmentRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(assignment: CrewAssignment): Promise<void> {
        await this.ctx.executor.insert(crewAssignments).values(toRow(assignment));
    }

    async find(workspaceId: WorkspaceId, id: CrewAssignmentId): Promise<CrewAssignment | undefined> {
        const rows = await this.ctx.executor.select().from(crewAssignments)
            .where(and(eq(crewAssignments.workspaceId, workspaceId), eq(crewAssignments.id, id)))
            .limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async list(workspaceId: WorkspaceId, filter: CrewAssignmentFilter): Promise<CrewAssignment[]> {
        const where: SQL[] = [eq(crewAssignments.workspaceId, workspaceId)];
        if (filter.projectId !== undefined) where.push(eq(crewAssignments.projectId, filter.projectId));
        if (filter.crewId !== undefined) where.push(eq(crewAssignments.crewId, filter.crewId));
        // Overlap of [start, end] with [from, to]: ends on/after `from` and starts on/before `to`.
        if (filter.from !== undefined) where.push(gte(crewAssignments.endDate, filter.from));
        if (filter.to !== undefined) where.push(lte(crewAssignments.startDate, filter.to));
        const rows = await this.ctx.executor.select().from(crewAssignments)
            .where(and(...where))
            .orderBy(asc(crewAssignments.startDate), asc(crewAssignments.endDate), asc(crewAssignments.createdAt), asc(crewAssignments.id));
        return rows.map(toEntity);
    }

    async countEndingOnOrAfter(workspaceId: WorkspaceId, crewIds: readonly CrewId[], day: string): Promise<number> {
        if (crewIds.length === 0) return 0;
        const rows = await this.ctx.executor.select({ n: count() }).from(crewAssignments)
            .where(and(
                eq(crewAssignments.workspaceId, workspaceId),
                inArray(crewAssignments.crewId, [...new Set(crewIds)]),
                gte(crewAssignments.endDate, day),
            ));
        return rows[0]?.n ?? 0;
    }

    async update(assignment: CrewAssignment): Promise<void> {
        const row = toRow(assignment);
        await this.ctx.executor.update(crewAssignments)
            .set({ crewId: row.crewId, startDate: row.startDate, endDate: row.endDate, note: row.note, updatedAt: row.updatedAt })
            .where(and(eq(crewAssignments.workspaceId, row.workspaceId), eq(crewAssignments.id, row.id)));
    }

    async delete(workspaceId: WorkspaceId, id: CrewAssignmentId): Promise<void> {
        await this.ctx.executor.delete(crewAssignments)
            .where(and(eq(crewAssignments.workspaceId, workspaceId), eq(crewAssignments.id, id)));
    }

    async deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.delete(crewAssignments)
            .where(and(eq(crewAssignments.workspaceId, workspaceId), eq(crewAssignments.projectId, projectId)));
    }
}
