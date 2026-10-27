import { and, asc, count, eq, exists, inArray, isNull, or, sql } from 'drizzle-orm';
import type { WorkforceTradeId } from '@contrack/contract';
import {
    asCrewId, asPersonId, asRateCardId, asWorkspaceId, type CrewId, type PersonId, type WorkspaceId,
} from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { crewMembers, crews } from '../../../../shared/infrastructure/database/schema';
import { CrewRepository } from '../../application/ports/crew.repository';
import { Crew } from '../../domain/entities/crew.entity';
import { WorkforceName } from '../../domain/value-objects/workforce-name.value-object';

type CrewRow = typeof crews.$inferSelect;

function toEntity(row: CrewRow, memberIds: PersonId[]): Crew {
    const name = WorkforceName.create(row.name, 'crew');
    if (!name.ok) throw new Error(`crew ${row.id} has an invalid stored name`);
    return Crew.rehydrate({
        id: asCrewId(row.id),
        workspaceId: asWorkspaceId(row.workspaceId),
        name: name.value,
        trade: row.trade as WorkforceTradeId,
        leaderId: row.leaderId === null ? null : asPersonId(row.leaderId),
        memberIds,
        skilledCount: row.skilledCount,
        labourerCount: row.labourerCount,
        rateCardId: row.rateCardId === null ? null : asRateCardId(row.rateCardId),
        dailyCostOverride: row.dailyCostOverride,
        note: row.note,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        archivedAt: row.archivedAt,
    });
}

function toRow(crew: Crew): CrewRow {
    const c = crew.toProps();
    return {
        id: c.id,
        workspaceId: c.workspaceId,
        name: c.name.value,
        trade: c.trade,
        leaderId: c.leaderId,
        skilledCount: c.skilledCount,
        labourerCount: c.labourerCount,
        rateCardId: c.rateCardId,
        dailyCostOverride: c.dailyCostOverride,
        note: c.note,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        archivedAt: c.archivedAt,
    };
}

export class DrizzleCrewRepository extends CrewRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(crew: Crew): Promise<void> {
        await this.ctx.transaction(async () => {
            await this.ctx.executor.insert(crews).values(toRow(crew));
            await this.writeMembers(crew);
        });
    }

    async find(workspaceId: WorkspaceId, id: CrewId): Promise<Crew | undefined> {
        const rows = await this.ctx.executor.select().from(crews)
            .where(and(eq(crews.workspaceId, workspaceId), eq(crews.id, id)))
            .limit(1);
        return (await this.withMembers(workspaceId, rows))[0];
    }

    async listActive(workspaceId: WorkspaceId): Promise<Crew[]> {
        const rows = await this.ctx.executor.select().from(crews)
            .where(and(eq(crews.workspaceId, workspaceId), isNull(crews.archivedAt)))
            .orderBy(asc(crews.createdAt), asc(crews.id));
        return this.withMembers(workspaceId, rows);
    }

    async countActive(workspaceId: WorkspaceId): Promise<number> {
        const rows = await this.ctx.executor.select({ n: count() }).from(crews)
            .where(and(eq(crews.workspaceId, workspaceId), isNull(crews.archivedAt)));
        return rows[0]?.n ?? 0;
    }

    async findActiveByName(workspaceId: WorkspaceId, name: WorkforceName): Promise<Crew | undefined> {
        const rows = await this.ctx.executor.select().from(crews)
            .where(and(
                eq(crews.workspaceId, workspaceId),
                isNull(crews.archivedAt),
                // The expression of the crews_name_key unique index.
                sql`lower(${crews.name}) = lower(${name.value})`,
            ))
            .limit(1);
        return (await this.withMembers(workspaceId, rows))[0];
    }

    async listInvolving(workspaceId: WorkspaceId, personId: PersonId): Promise<Crew[]> {
        const member = this.ctx.executor.select({ one: sql`1` }).from(crewMembers)
            .where(and(eq(crewMembers.workspaceId, workspaceId), eq(crewMembers.crewId, crews.id), eq(crewMembers.personId, personId)));
        const rows = await this.ctx.executor.select().from(crews)
            .where(and(eq(crews.workspaceId, workspaceId), or(eq(crews.leaderId, personId), exists(member))))
            .orderBy(asc(crews.createdAt), asc(crews.id));
        return this.withMembers(workspaceId, rows);
    }

    async update(crew: Crew): Promise<void> {
        const { id, workspaceId, createdAt: _createdAt, ...fields } = toRow(crew);
        await this.ctx.transaction(async () => {
            const updated = await this.ctx.executor.update(crews).set(fields)
                .where(and(eq(crews.workspaceId, workspaceId), eq(crews.id, id)))
                .returning({ id: crews.id });
            if (updated.length === 0) return;
            await this.ctx.executor.delete(crewMembers)
                .where(and(eq(crewMembers.workspaceId, workspaceId), eq(crewMembers.crewId, id)));
            await this.writeMembers(crew);
        });
    }

    private async writeMembers(crew: Crew): Promise<void> {
        const members = crew.memberIds;
        if (members.length === 0) return;
        await this.ctx.executor.insert(crewMembers).values(members.map((personId, position) => ({
            crewId: crew.id, personId, workspaceId: crew.workspaceId, position,
        })));
    }

    private async withMembers(workspaceId: WorkspaceId, rows: CrewRow[]): Promise<Crew[]> {
        if (rows.length === 0) return [];
        const members = await this.ctx.executor.select().from(crewMembers)
            .where(and(eq(crewMembers.workspaceId, workspaceId), inArray(crewMembers.crewId, rows.map(r => r.id))))
            .orderBy(asc(crewMembers.crewId), asc(crewMembers.position));
        const byCrew = new Map<string, PersonId[]>();
        for (const m of members) {
            const list = byCrew.get(m.crewId) ?? [];
            list.push(asPersonId(m.personId));
            byCrew.set(m.crewId, list);
        }
        return rows.map(r => toEntity(r, byCrew.get(r.id) ?? []));
    }
}
