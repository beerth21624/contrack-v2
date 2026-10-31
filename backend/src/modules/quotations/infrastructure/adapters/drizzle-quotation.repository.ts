import type { QuotationLineKind, QuotationVersionStatus } from '@contrack/contract';
import type { DetailLevel, QuotationFormat } from '@contrack/domain/quotation';
import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import {
    qtQuotationLines, qtQuotationSections, qtQuotationVersions, qtQuotations,
} from '../../../../shared/infrastructure/database/schema-quotations';
import {
    type ExpiredVersionRef, QuotationRepository, type QuotationRecord, type QuotationVersionRecord, type QuotationVersionRows,
} from '../../application/ports/quotation.repository';

type QuotationRow = typeof qtQuotations.$inferSelect;
type VersionRow = typeof qtQuotationVersions.$inferSelect;

const toQuotation = (r: QuotationRow): QuotationRecord => ({
    id: r.id,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    customerId: r.customerId,
    title: r.title,
    number: r.number,
    currentVersionId: r.currentVersionId,
    acceptedVersionId: r.acceptedVersionId,
    createdBy: asUserId(r.createdBy),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
});

const toVersion = (r: VersionRow): QuotationVersionRecord => ({
    id: r.id,
    quotationId: r.quotationId,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    versionNo: r.versionNo,
    status: r.status as QuotationVersionStatus,
    boqVersionId: r.boqVersionId,
    format: r.format as QuotationFormat,
    detailLevel: r.detailLevel as DetailLevel,
    language: r.language,
    issueDate: r.issueDate,
    validUntil: r.validUntil,
    number: r.number,
    customerSnapshot: r.customerSnapshot,
    companySnapshot: r.companySnapshot,
    pricing: r.pricing,
    totals: r.totals,
    paymentTerms: r.paymentTerms,
    termsTh: r.termsTh,
    termsEn: r.termsEn,
    note: r.note,
    acceptedAt: r.acceptedAt,
    acceptedByName: r.acceptedByName,
    responseNote: r.responseNote,
    issuedBy: r.issuedBy === null ? null : asUserId(r.issuedBy),
    issuedAt: r.issuedAt,
    createdBy: asUserId(r.createdBy),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
});

/** Rows per insert statement (18 columns × 500 stays far below PostgreSQL's 65535 parameters). */
const CHUNK = 500;

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleQuotationRepository extends QuotationRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findQuotation(quotationId: string): Promise<QuotationRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(qtQuotations).where(eq(qtQuotations.id, quotationId)).limit(1);
        return row === undefined ? undefined : toQuotation(row);
    }

    async lockQuotation(workspaceId: WorkspaceId, quotationId: string): Promise<QuotationRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(qtQuotations)
            .where(and(eq(qtQuotations.workspaceId, workspaceId), eq(qtQuotations.id, quotationId))).limit(1).for('update');
        return row === undefined ? undefined : toQuotation(row);
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<QuotationRecord[]> {
        const rows = await this.ctx.executor.select().from(qtQuotations)
            .where(and(eq(qtQuotations.workspaceId, workspaceId), eq(qtQuotations.projectId, projectId)))
            .orderBy(desc(qtQuotations.createdAt));
        return rows.map(toQuotation);
    }

    async insertQuotation(q: QuotationRecord): Promise<void> {
        await this.ctx.executor.insert(qtQuotations).values({ ...q });
    }

    async saveQuotation(q: QuotationRecord): Promise<void> {
        const { id, workspaceId, ...rest } = q;
        await this.ctx.executor.update(qtQuotations).set(rest)
            .where(and(eq(qtQuotations.workspaceId, workspaceId), eq(qtQuotations.id, id)));
    }

    async findVersion(versionId: string): Promise<QuotationVersionRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(qtQuotationVersions).where(eq(qtQuotationVersions.id, versionId)).limit(1);
        return row === undefined ? undefined : toVersion(row);
    }

    async versionsOf(workspaceId: WorkspaceId, quotationIds: readonly string[]): Promise<QuotationVersionRecord[]> {
        if (quotationIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(qtQuotationVersions)
            .where(and(eq(qtQuotationVersions.workspaceId, workspaceId), inArray(qtQuotationVersions.quotationId, [...quotationIds])))
            .orderBy(asc(qtQuotationVersions.versionNo));
        return rows.map(toVersion);
    }

    async insertVersion(v: QuotationVersionRecord, rows: QuotationVersionRows): Promise<void> {
        await this.ctx.executor.insert(qtQuotationVersions).values({ ...v });
        await this.insertRows(v.workspaceId, v.id, rows);
    }

    async saveVersion(v: QuotationVersionRecord): Promise<void> {
        const { id, workspaceId, ...rest } = v;
        await this.ctx.executor.update(qtQuotationVersions).set(rest)
            .where(and(eq(qtQuotationVersions.workspaceId, workspaceId), eq(qtQuotationVersions.id, id)));
    }

    async replaceRows(workspaceId: WorkspaceId, versionId: string, rows: QuotationVersionRows): Promise<void> {
        await this.ctx.executor.delete(qtQuotationLines)
            .where(and(eq(qtQuotationLines.workspaceId, workspaceId), eq(qtQuotationLines.versionId, versionId)));
        await this.ctx.executor.delete(qtQuotationSections)
            .where(and(eq(qtQuotationSections.workspaceId, workspaceId), eq(qtQuotationSections.versionId, versionId)));
        await this.insertRows(workspaceId, versionId, rows);
    }

    async rows(workspaceId: WorkspaceId, versionId: string): Promise<QuotationVersionRows> {
        const sections = await this.ctx.executor.select().from(qtQuotationSections)
            .where(and(eq(qtQuotationSections.workspaceId, workspaceId), eq(qtQuotationSections.versionId, versionId)))
            .orderBy(asc(qtQuotationSections.sort), asc(qtQuotationSections.sectionNo));
        const lines = await this.ctx.executor.select().from(qtQuotationLines)
            .where(and(eq(qtQuotationLines.workspaceId, workspaceId), eq(qtQuotationLines.versionId, versionId)))
            .orderBy(asc(qtQuotationLines.sectionNo), asc(qtQuotationLines.sort));
        return {
            sections: sections.map(({ versionId: _v, workspaceId: _w, ...s }) => s),
            lines: lines.map(({ versionId: _v, workspaceId: _w, ...l }) => ({ ...l, kind: l.kind as QuotationLineKind })),
        };
    }

    async issuedValidBefore(today: string, limit: number): Promise<ExpiredVersionRef[]> {
        const rows = await this.ctx.executor.select({ id: qtQuotationVersions.id, workspaceId: qtQuotationVersions.workspaceId })
            .from(qtQuotationVersions)
            .where(and(eq(qtQuotationVersions.status, 'issued'), lt(qtQuotationVersions.validUntil, today)))
            .limit(limit);
        return rows.map(r => ({ id: r.id, workspaceId: asWorkspaceId(r.workspaceId) }));
    }

    async deleteByProject(): Promise<void> {
        // PostgreSQL drops the quotations with the project (tenant FK on delete cascade).
    }

    private async insertRows(workspaceId: WorkspaceId, versionId: string, rows: QuotationVersionRows): Promise<void> {
        if (rows.sections.length > 0) {
            await this.ctx.executor.insert(qtQuotationSections).values(rows.sections.map(s => ({ ...s, versionId, workspaceId })));
        }
        for (let i = 0; i < rows.lines.length; i += CHUNK) {
            await this.ctx.executor.insert(qtQuotationLines)
                .values(rows.lines.slice(i, i + CHUNK).map(l => ({ ...l, versionId, workspaceId })));
        }
    }
}
