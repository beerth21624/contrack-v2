import { and, asc, count, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import type { CostLedgerEntry, CostLedgerTotals, FinEvent, FinEventFilter } from '../../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { costLedgerEntries, finEvents } from '../../../../shared/infrastructure/database/schema-ledger';
import { CostLedgerRepository, FinEventRepository } from '../../application/ports/ledger.repository';
import type { FinEventType } from '@contrack/contract';
import { round2 } from '@contrack/domain/money';

const toEntry = (r: typeof costLedgerEntries.$inferSelect): CostLedgerEntry => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    createdBy: asUserId(r.createdBy),
});

/** Rows per insert statement (17 columns × 500 stays far below PostgreSQL's 65535 parameters). */
const CHUNK = 500;

const sumOf = (kind: 'commit' | 'commit_release' | 'actual') =>
    sql<string>`coalesce(sum(case when ${costLedgerEntries.kind} = ${kind} then ${costLedgerEntries.amount} else 0 end), 0)::text`;

const totalsOf = (r: { committed: string; released: string; actual: string }): CostLedgerTotals => {
    const committed = round2(Number(r.committed));
    const released = round2(Number(r.released));
    return { committed, released, committedOpen: round2(committed + released), actual: round2(Number(r.actual)) };
};

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleCostLedgerRepository extends CostLedgerRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insertMany(entries: readonly CostLedgerEntry[]): Promise<void> {
        for (let i = 0; i < entries.length; i += CHUNK) {
            await this.ctx.executor.insert(costLedgerEntries).values(entries.slice(i, i + CHUNK).map(e => ({ ...e })));
        }
    }

    async findForUpdate(workspaceId: WorkspaceId, id: string): Promise<CostLedgerEntry | undefined> {
        const [row] = await this.ctx.executor.select().from(costLedgerEntries)
            .where(and(eq(costLedgerEntries.workspaceId, workspaceId), eq(costLedgerEntries.id, id)))
            .for('update');
        return row === undefined ? undefined : toEntry(row);
    }

    async reversedIds(workspaceId: WorkspaceId, ids: readonly string[]): Promise<Set<string>> {
        if (ids.length === 0) return new Set();
        const rows = await this.ctx.executor.select({ reversesId: costLedgerEntries.reversesId }).from(costLedgerEntries)
            .where(and(eq(costLedgerEntries.workspaceId, workspaceId), inArray(costLedgerEntries.reversesId, [...ids])));
        return new Set(rows.flatMap(r => (r.reversesId === null ? [] : [r.reversesId])));
    }

    async lockCommitments(_workspaceId: WorkspaceId, refs: readonly string[]): Promise<void> {
        // Sorted: two writers always take the locks in the same order (no deadlock).
        for (const ref of [...new Set(refs)].sort()) {
            await this.ctx.executor.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`ledger:${ref}`}, 0))`);
        }
    }

    async openByCommitment(
        workspaceId: WorkspaceId, refs: readonly string[],
    ): Promise<{ commitmentRef: string; costCodeId: string | null; open: number }[]> {
        if (refs.length === 0) return [];
        const rows = await this.ctx.executor
            .select({
                commitmentRef: costLedgerEntries.commitmentRef,
                costCodeId: costLedgerEntries.costCodeId,
                open: sql<string>`coalesce(sum(${costLedgerEntries.amount}), 0)::text`,
            })
            .from(costLedgerEntries)
            .where(and(
                eq(costLedgerEntries.workspaceId, workspaceId),
                inArray(costLedgerEntries.commitmentRef, [...refs]),
                inArray(costLedgerEntries.kind, ['commit', 'commit_release']),
            ))
            .groupBy(costLedgerEntries.commitmentRef, costLedgerEntries.costCodeId);
        return rows.flatMap(r => (r.commitmentRef === null ? [] : [{ commitmentRef: r.commitmentRef, costCodeId: r.costCodeId, open: round2(Number(r.open)) }]));
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId, costCodeId?: string): Promise<CostLedgerEntry[]> {
        const rows = await this.ctx.executor.select().from(costLedgerEntries)
            .where(and(
                eq(costLedgerEntries.workspaceId, workspaceId),
                eq(costLedgerEntries.projectId, projectId),
                costCodeId === undefined ? undefined : eq(costLedgerEntries.costCodeId, costCodeId),
            ))
            .orderBy(asc(costLedgerEntries.entryDate), asc(costLedgerEntries.createdAt), asc(costLedgerEntries.id));
        return rows.map(toEntry);
    }

    async bySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string, forUpdate = false): Promise<CostLedgerEntry[]> {
        const query = this.ctx.executor.select().from(costLedgerEntries)
            .where(and(
                eq(costLedgerEntries.workspaceId, workspaceId), eq(costLedgerEntries.sourceType, sourceType), eq(costLedgerEntries.sourceId, sourceId),
            ))
            .orderBy(asc(costLedgerEntries.entryDate), asc(costLedgerEntries.createdAt), asc(costLedgerEntries.id));
        const rows = forUpdate ? await query.for('update') : await query;
        return rows.map(toEntry);
    }

    async totalsByCostCode(workspaceId: WorkspaceId, projectId: ProjectId): Promise<(CostLedgerTotals & { costCodeId: string | null })[]> {
        const rows = await this.ctx.executor
            .select({ costCodeId: costLedgerEntries.costCodeId, committed: sumOf('commit'), released: sumOf('commit_release'), actual: sumOf('actual') })
            .from(costLedgerEntries)
            .where(and(eq(costLedgerEntries.workspaceId, workspaceId), eq(costLedgerEntries.projectId, projectId)))
            .groupBy(costLedgerEntries.costCodeId);
        return rows.map(r => ({ costCodeId: r.costCodeId, ...totalsOf(r) }));
    }

    async totalsByProject(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, CostLedgerTotals>> {
        if (projectIds.length === 0) return new Map();
        const rows = await this.ctx.executor
            .select({ projectId: costLedgerEntries.projectId, committed: sumOf('commit'), released: sumOf('commit_release'), actual: sumOf('actual') })
            .from(costLedgerEntries)
            .where(and(eq(costLedgerEntries.workspaceId, workspaceId), inArray(costLedgerEntries.projectId, [...projectIds])))
            .groupBy(costLedgerEntries.projectId);
        return new Map(rows.map(r => [asProjectId(r.projectId), totalsOf(r)]));
    }

    async countByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<number> {
        const [row] = await this.ctx.executor.select({ n: count() }).from(costLedgerEntries)
            .where(and(eq(costLedgerEntries.workspaceId, workspaceId), eq(costLedgerEntries.projectId, projectId)));
        return row?.n ?? 0;
    }

    async deleteByProject(): Promise<void> {
        // PostgreSQL drops the ledger rows with the project (tenant FK on delete cascade).
    }
}

const toEvent = (r: typeof finEvents.$inferSelect): FinEvent => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: r.projectId === null ? null : asProjectId(r.projectId),
    eventType: r.eventType as FinEventType,
    createdBy: asUserId(r.createdBy),
});

export class DrizzleFinEventRepository extends FinEventRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(event: FinEvent): Promise<void> {
        await this.ctx.executor.insert(finEvents).values({ ...event });
    }

    async findForUpdate(workspaceId: WorkspaceId, id: string): Promise<FinEvent | undefined> {
        const [row] = await this.ctx.executor.select().from(finEvents)
            .where(and(eq(finEvents.workspaceId, workspaceId), eq(finEvents.id, id)))
            .for('update');
        return row === undefined ? undefined : toEvent(row);
    }

    async isReversed(workspaceId: WorkspaceId, id: string): Promise<boolean> {
        const [row] = await this.ctx.executor.select({ id: finEvents.id }).from(finEvents)
            .where(and(eq(finEvents.workspaceId, workspaceId), eq(finEvents.reversesId, id)))
            .limit(1);
        return row !== undefined;
    }

    async list(workspaceId: WorkspaceId, filter: FinEventFilter): Promise<FinEvent[]> {
        const rows = await this.ctx.executor.select().from(finEvents)
            .where(and(
                eq(finEvents.workspaceId, workspaceId),
                filter.from === undefined ? undefined : gte(finEvents.eventDate, filter.from),
                filter.to === undefined ? undefined : lte(finEvents.eventDate, filter.to),
                filter.types === undefined || filter.types.length === 0 ? undefined : inArray(finEvents.eventType, [...filter.types]),
                filter.projectId === undefined ? undefined : and(isNotNull(finEvents.projectId), eq(finEvents.projectId, filter.projectId)),
            ))
            .orderBy(asc(finEvents.eventDate), asc(finEvents.createdAt), asc(finEvents.id));
        return rows.map(toEvent);
    }

    async bySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string): Promise<FinEvent[]> {
        const rows = await this.ctx.executor.select().from(finEvents)
            .where(and(eq(finEvents.workspaceId, workspaceId), eq(finEvents.sourceType, sourceType), eq(finEvents.sourceId, sourceId)))
            .orderBy(asc(finEvents.eventDate), asc(finEvents.createdAt), asc(finEvents.id));
        return rows.map(toEvent);
    }

    async countByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<number> {
        const [row] = await this.ctx.executor.select({ n: count() }).from(finEvents)
            .where(and(eq(finEvents.workspaceId, workspaceId), eq(finEvents.projectId, projectId)));
        return row?.n ?? 0;
    }
}
