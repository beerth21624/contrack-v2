import { and, count, desc, eq, max, notInArray, sql } from 'drizzle-orm';
import { DOC_TYPES, type DocType } from '@contrack/contract';
import { type ProjectId, type UserId, type WorkspaceId, asUserId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { docNumberCounters, docNumberSeries, issuedDocuments } from '../../../../shared/infrastructure/database/schema-erp-core';
import { type IssuedDocumentRecord, NumberingRepository, type SavedSeries } from '../../application/ports/numbering.repository';

type SeriesRow = typeof docNumberSeries.$inferSelect;
type IssuedRow = typeof issuedDocuments.$inferSelect;

const KNOWN = new Set<string>(DOC_TYPES);

/** Rows of document types this code no longer knows are ignored (never deleted). */
const toSeries = (row: SeriesRow): SavedSeries | undefined => (KNOWN.has(row.docType)
    ? {
        docType: row.docType as DocType,
        prefix: row.prefix,
        pattern: row.pattern,
        reset: row.reset,
        yearStyle: row.yearStyle,
        updatedBy: row.updatedBy === null ? null : asUserId(row.updatedBy),
        updatedAt: row.updatedAt,
    }
    : undefined);

const toIssued = (row: IssuedRow): IssuedDocumentRecord => ({
    id: row.id,
    workspaceId: row.workspaceId as WorkspaceId,
    docType: row.docType as DocType,
    number: row.number,
    periodKey: row.periodKey,
    seq: row.seq,
    issueDate: row.issueDate,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    projectId: row.projectId as ProjectId | null,
    issuedBy: asUserId(row.issuedBy),
    issuedAt: row.issuedAt,
    status: row.status,
    voidedBy: row.voidedBy === null ? null : asUserId(row.voidedBy),
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Every query filters by `workspace_id`. */
export class DrizzleNumberingRepository extends NumberingRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findSeries(workspaceId: WorkspaceId, docType: DocType): Promise<SavedSeries | undefined> {
        const [row] = await this.ctx.executor.select().from(docNumberSeries)
            .where(and(eq(docNumberSeries.workspaceId, workspaceId), eq(docNumberSeries.docType, docType)))
            .limit(1);
        return row === undefined ? undefined : toSeries(row);
    }

    async listSeries(workspaceId: WorkspaceId): Promise<SavedSeries[]> {
        const rows = await this.ctx.executor.select().from(docNumberSeries).where(eq(docNumberSeries.workspaceId, workspaceId));
        return rows.map(toSeries).filter((s): s is SavedSeries => s !== undefined);
    }

    async saveSeries(workspaceId: WorkspaceId, series: SavedSeries): Promise<void> {
        const values = {
            prefix: series.prefix,
            pattern: series.pattern,
            reset: series.reset,
            yearStyle: series.yearStyle,
            updatedBy: series.updatedBy,
            updatedAt: series.updatedAt,
        };
        await this.ctx.executor.insert(docNumberSeries)
            .values({ workspaceId, docType: series.docType, ...values })
            .onConflictDoUpdate({ target: [docNumberSeries.workspaceId, docNumberSeries.docType], set: values });
    }

    exclusive<T>(workspaceId: WorkspaceId, docType: DocType, periodKey: string, work: (lastSeq: number) => Promise<T>): Promise<T> {
        return this.ctx.transaction(async () => {
            // The upsert creates the counter (0) or touches it: either way the row stays locked until COMMIT /
            // ROLLBACK, so a concurrent issue of the same counter waits here and then sees the new last seq.
            const rows = await this.ctx.executor.insert(docNumberCounters)
                .values({ workspaceId, docType, periodKey, lastSeq: 0 })
                .onConflictDoUpdate({
                    target: [docNumberCounters.workspaceId, docNumberCounters.docType, docNumberCounters.periodKey],
                    set: { updatedAt: sql`now()` },
                })
                .returning({ lastSeq: docNumberCounters.lastSeq });
            const lastSeq = rows[0]?.lastSeq;
            if (lastSeq === undefined) throw new Error('doc_number_counters upsert returned no row');
            return work(lastSeq);
        });
    }

    async setLastSeq(workspaceId: WorkspaceId, docType: DocType, periodKey: string, seq: number): Promise<void> {
        await this.ctx.executor.update(docNumberCounters)
            .set({ lastSeq: seq, updatedAt: new Date() })
            .where(and(
                eq(docNumberCounters.workspaceId, workspaceId),
                eq(docNumberCounters.docType, docType),
                eq(docNumberCounters.periodKey, periodKey),
            ));
    }

    async peekLastSeq(workspaceId: WorkspaceId, docType: DocType, periodKey: string): Promise<number> {
        const [row] = await this.ctx.executor.select({ lastSeq: docNumberCounters.lastSeq }).from(docNumberCounters)
            .where(and(
                eq(docNumberCounters.workspaceId, workspaceId),
                eq(docNumberCounters.docType, docType),
                eq(docNumberCounters.periodKey, periodKey),
            ))
            .limit(1);
        return row?.lastSeq ?? 0;
    }

    async latestIssueDate(workspaceId: WorkspaceId, docType: DocType, periodKey: string): Promise<string | undefined> {
        const [row] = await this.ctx.executor.select({ latest: max(issuedDocuments.issueDate) }).from(issuedDocuments)
            .where(and(
                eq(issuedDocuments.workspaceId, workspaceId),
                eq(issuedDocuments.docType, docType),
                eq(issuedDocuments.periodKey, periodKey),
            ));
        return row?.latest ?? undefined;
    }

    async countInPeriod(workspaceId: WorkspaceId, docType: DocType, periodKey: string): Promise<number> {
        const [row] = await this.ctx.executor.select({ n: count() }).from(issuedDocuments)
            .where(and(
                eq(issuedDocuments.workspaceId, workspaceId),
                eq(issuedDocuments.docType, docType),
                eq(issuedDocuments.periodKey, periodKey),
            ));
        return row?.n ?? 0;
    }

    async numberExists(workspaceId: WorkspaceId, docType: DocType, number: string): Promise<boolean> {
        const [row] = await this.ctx.executor.select({ id: issuedDocuments.id }).from(issuedDocuments)
            .where(and(
                eq(issuedDocuments.workspaceId, workspaceId),
                eq(issuedDocuments.docType, docType),
                eq(issuedDocuments.number, number),
            ))
            .limit(1);
        return row !== undefined;
    }

    async findBySubject(workspaceId: WorkspaceId, docType: DocType, subjectId: string): Promise<IssuedDocumentRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(issuedDocuments)
            .where(and(
                eq(issuedDocuments.workspaceId, workspaceId),
                eq(issuedDocuments.docType, docType),
                eq(issuedDocuments.subjectId, subjectId),
            ))
            .limit(1);
        return row === undefined ? undefined : toIssued(row);
    }

    async insertIssued(r: IssuedDocumentRecord): Promise<void> {
        await this.ctx.executor.insert(issuedDocuments).values({
            id: r.id,
            workspaceId: r.workspaceId,
            docType: r.docType,
            number: r.number,
            periodKey: r.periodKey,
            seq: r.seq,
            issueDate: r.issueDate,
            subjectType: r.subjectType,
            subjectId: r.subjectId,
            projectId: r.projectId,
            issuedBy: r.issuedBy,
            issuedAt: r.issuedAt,
            status: r.status,
            voidedBy: r.voidedBy,
            voidedAt: r.voidedAt,
            voidReason: r.voidReason,
        });
    }

    async markVoided(workspaceId: WorkspaceId, id: string, by: UserId, at: Date, reason: string): Promise<void> {
        await this.ctx.executor.update(issuedDocuments)
            .set({ status: 'voided', voidedBy: by, voidedAt: at, voidReason: reason })
            .where(and(eq(issuedDocuments.workspaceId, workspaceId), eq(issuedDocuments.id, id)));
    }

    async searchNumbers(workspaceId: WorkspaceId, q: string, limit: number): Promise<IssuedDocumentRecord[]> {
        const like = `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
        const rows = await this.ctx.executor.select().from(issuedDocuments)
            .where(and(eq(issuedDocuments.workspaceId, workspaceId), sql`${issuedDocuments.number} ilike ${like}`))
            .orderBy(desc(issuedDocuments.issuedAt))
            .limit(limit);
        return rows.filter(r => KNOWN.has(r.docType)).map(toIssued);
    }

    async countBlocking(workspaceId: WorkspaceId, projectId: ProjectId | null, exemptTypes: readonly DocType[]): Promise<number> {
        const conditions = [eq(issuedDocuments.workspaceId, workspaceId)];
        if (projectId !== null) conditions.push(eq(issuedDocuments.projectId, projectId));
        if (exemptTypes.length > 0) conditions.push(notInArray(issuedDocuments.docType, [...exemptTypes]));
        const [row] = await this.ctx.executor.select({ n: count() }).from(issuedDocuments).where(and(...conditions));
        return row?.n ?? 0;
    }
}
