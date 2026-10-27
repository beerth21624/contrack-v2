import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import type { WorkforceTradeId } from '@contrack/contract';
import { asPersonId, asWorkspaceId, type PersonId, type WorkspaceId } from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { people } from '../../../../shared/infrastructure/database/schema';
import { PersonRepository } from '../../application/ports/person.repository';
import { Person } from '../../domain/entities/person.entity';
import { WorkforceName } from '../../domain/value-objects/workforce-name.value-object';

type PersonRow = typeof people.$inferSelect;

function toEntity(row: PersonRow): Person {
    const name = WorkforceName.create(row.name, 'person');
    if (!name.ok) throw new Error(`person ${row.id} has an invalid stored name`);
    return Person.rehydrate({
        id: asPersonId(row.id),
        workspaceId: asWorkspaceId(row.workspaceId),
        name: name.value,
        nickname: row.nickname,
        phone: row.phone,
        role: row.role,
        employment: row.employment,
        trades: row.trades as WorkforceTradeId[],
        dailyWage: row.dailyWage,
        note: row.note,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        archivedAt: row.archivedAt,
    });
}

function toRow(person: Person): PersonRow {
    const p = person.toProps();
    return {
        id: p.id,
        workspaceId: p.workspaceId,
        name: p.name.value,
        nickname: p.nickname,
        phone: p.phone,
        role: p.role,
        employment: p.employment,
        trades: p.trades,
        dailyWage: p.dailyWage,
        note: p.note,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        archivedAt: p.archivedAt,
    };
}

export class DrizzlePersonRepository extends PersonRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(person: Person): Promise<void> {
        await this.ctx.executor.insert(people).values(toRow(person));
    }

    async find(workspaceId: WorkspaceId, id: PersonId): Promise<Person | undefined> {
        const rows = await this.ctx.executor.select().from(people)
            .where(and(eq(people.workspaceId, workspaceId), eq(people.id, id)))
            .limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toEntity(row);
    }

    async findMany(workspaceId: WorkspaceId, ids: readonly PersonId[]): Promise<Person[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(people)
            .where(and(eq(people.workspaceId, workspaceId), inArray(people.id, [...new Set(ids)])));
        return rows.map(toEntity);
    }

    async listActive(workspaceId: WorkspaceId): Promise<Person[]> {
        const rows = await this.ctx.executor.select().from(people)
            .where(and(eq(people.workspaceId, workspaceId), isNull(people.archivedAt)))
            .orderBy(asc(people.createdAt), asc(people.id));
        return rows.map(toEntity);
    }

    async countActive(workspaceId: WorkspaceId): Promise<number> {
        const rows = await this.ctx.executor.select({ n: count() }).from(people)
            .where(and(eq(people.workspaceId, workspaceId), isNull(people.archivedAt)));
        return rows[0]?.n ?? 0;
    }

    async update(person: Person): Promise<void> {
        const { id, workspaceId, createdAt: _createdAt, ...fields } = toRow(person);
        await this.ctx.executor.update(people).set(fields)
            .where(and(eq(people.workspaceId, workspaceId), eq(people.id, id)));
    }
}
