import type {
    ContractVariationBilling, VariationEvidenceKind, VariationLineSource, VariationReason, VariationStatus,
} from '@contrack/contract';
import { and, asc, count, desc, eq, inArray, max } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { voEvidence, voLines, voVariations } from '../../../../shared/infrastructure/database/schema-variations';
import {
    type VariationEvidenceRecord, type VariationLineRecord, VariationRepository, type VariationRecord,
} from '../../application/ports/variation.repository';

type VariationRow = typeof voVariations.$inferSelect;
type LineRow = typeof voLines.$inferSelect;
type EvidenceRow = typeof voEvidence.$inferSelect;

const toVariation = (r: VariationRow): VariationRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    reason: r.reason as VariationReason,
    status: r.status as VariationStatus,
    billing: r.billing as ContractVariationBilling,
    createdBy: asUserId(r.createdBy),
});

const toLine = (r: LineRow): VariationLineRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    source: r.source as VariationLineSource,
});

const toEvidence = (r: EvidenceRow): VariationEvidenceRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    kind: r.kind as VariationEvidenceKind,
    authorUserId: asUserId(r.authorUserId),
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleVariationRepository extends VariationRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async find(variationId: string): Promise<VariationRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(voVariations).where(eq(voVariations.id, variationId)).limit(1);
        return row === undefined ? undefined : toVariation(row);
    }

    async lock(workspaceId: WorkspaceId, variationId: string): Promise<VariationRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(voVariations)
            .where(and(eq(voVariations.workspaceId, workspaceId), eq(voVariations.id, variationId))).limit(1).for('update');
        return row === undefined ? undefined : toVariation(row);
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<VariationRecord[]> {
        return this.listByProjects(workspaceId, [projectId]);
    }

    async listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<VariationRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(voVariations)
            .where(and(eq(voVariations.workspaceId, workspaceId), inArray(voVariations.projectId, [...projectIds])))
            .orderBy(desc(voVariations.createdAt), desc(voVariations.seqNo));
        return rows.map(toVariation);
    }

    async maxSeq(workspaceId: WorkspaceId, contractId: string): Promise<number> {
        const [row] = await this.ctx.executor.select({ m: max(voVariations.seqNo) }).from(voVariations)
            .where(and(eq(voVariations.workspaceId, workspaceId), eq(voVariations.contractId, contractId)));
        return row?.m ?? 0;
    }

    async insert(v: VariationRecord): Promise<void> {
        await this.ctx.executor.insert(voVariations).values({ ...v });
    }

    async save(v: VariationRecord): Promise<void> {
        const { id, workspaceId, createdAt: _c, ...rest } = v;
        await this.ctx.executor.update(voVariations).set(rest)
            .where(and(eq(voVariations.workspaceId, workspaceId), eq(voVariations.id, id)));
    }

    async linesOf(workspaceId: WorkspaceId, variationId: string): Promise<VariationLineRecord[]> {
        const rows = await this.ctx.executor.select().from(voLines)
            .where(and(eq(voLines.workspaceId, workspaceId), eq(voLines.variationId, variationId)))
            .orderBy(asc(voLines.sort));
        return rows.map(toLine);
    }

    async replaceLines(workspaceId: WorkspaceId, variationId: string, lines: readonly VariationLineRecord[]): Promise<void> {
        await this.ctx.executor.delete(voLines).where(and(eq(voLines.workspaceId, workspaceId), eq(voLines.variationId, variationId)));
        if (lines.length > 0) await this.ctx.executor.insert(voLines).values(lines.map(l => ({ ...l })));
    }

    async counts(workspaceId: WorkspaceId, variationIds: readonly string[]): Promise<Map<string, { lines: number; evidence: number }>> {
        const out = new Map<string, { lines: number; evidence: number }>();
        if (variationIds.length === 0) return out;
        for (const id of variationIds) out.set(id, { lines: 0, evidence: 0 });
        const lineRows = await this.ctx.executor.select({ id: voLines.variationId, n: count() }).from(voLines)
            .where(and(eq(voLines.workspaceId, workspaceId), inArray(voLines.variationId, [...variationIds])))
            .groupBy(voLines.variationId);
        for (const r of lineRows) {
            const c = out.get(r.id);
            if (c !== undefined) c.lines = r.n;
        }
        const evidenceRows = await this.ctx.executor.select({ id: voEvidence.variationId, n: count() }).from(voEvidence)
            .where(and(eq(voEvidence.workspaceId, workspaceId), inArray(voEvidence.variationId, [...variationIds])))
            .groupBy(voEvidence.variationId);
        for (const r of evidenceRows) {
            const c = out.get(r.id);
            if (c !== undefined) c.evidence = r.n;
        }
        return out;
    }

    async evidenceOf(workspaceId: WorkspaceId, variationId: string): Promise<VariationEvidenceRecord[]> {
        const rows = await this.ctx.executor.select().from(voEvidence)
            .where(and(eq(voEvidence.workspaceId, workspaceId), eq(voEvidence.variationId, variationId)))
            .orderBy(asc(voEvidence.createdAt));
        return rows.map(toEvidence);
    }

    async findEvidence(evidenceId: string): Promise<VariationEvidenceRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(voEvidence).where(eq(voEvidence.id, evidenceId)).limit(1);
        return row === undefined ? undefined : toEvidence(row);
    }

    async insertEvidence(e: VariationEvidenceRecord): Promise<void> {
        await this.ctx.executor.insert(voEvidence).values({ ...e });
    }

    async deleteEvidence(workspaceId: WorkspaceId, evidenceId: string): Promise<void> {
        await this.ctx.executor.delete(voEvidence).where(and(eq(voEvidence.workspaceId, workspaceId), eq(voEvidence.id, evidenceId)));
    }

    deleteByProject(): Promise<void> {
        return Promise.resolve();
    }
}
