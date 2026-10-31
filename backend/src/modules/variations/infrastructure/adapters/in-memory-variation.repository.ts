import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type VariationEvidenceRecord, type VariationLineRecord, VariationRepository, type VariationRecord,
} from '../../application/ports/variation.repository';

const clone = <T>(v: T): T => structuredClone(v);

/** Memory adapter (tests / trying without a database); mimics the unique keys of `vo_variations`. */
export class InMemoryVariationRepository extends VariationRepository {
    private readonly variations = new Map<string, VariationRecord>();
    private readonly lines = new Map<string, VariationLineRecord[]>();
    private readonly evidence = new Map<string, VariationEvidenceRecord>();

    find(variationId: string): Promise<VariationRecord | undefined> {
        const v = this.variations.get(variationId);
        return Promise.resolve(v === undefined ? undefined : clone(v));
    }

    lock(workspaceId: WorkspaceId, variationId: string): Promise<VariationRecord | undefined> {
        const v = this.variations.get(variationId);
        return Promise.resolve(v?.workspaceId === workspaceId ? clone(v) : undefined);
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<VariationRecord[]> {
        return this.listByProjects(workspaceId, [projectId]);
    }

    listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<VariationRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.variations.values()]
            .filter(v => v.workspaceId === workspaceId && ids.has(v.projectId))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.seqNo - a.seqNo)
            .map(clone));
    }

    maxSeq(workspaceId: WorkspaceId, contractId: string): Promise<number> {
        return Promise.resolve([...this.variations.values()]
            .filter(v => v.workspaceId === workspaceId && v.contractId === contractId)
            .reduce((max, v) => Math.max(max, v.seqNo), 0));
    }

    insert(v: VariationRecord): Promise<void> {
        const clash = [...this.variations.values()].some(o => o.id === v.id
            || (o.contractId === v.contractId && o.seqNo === v.seqNo)
            || (v.number !== null && o.workspaceId === v.workspaceId && o.number === v.number));
        if (clash) return Promise.reject(new Error(`duplicate variation ${v.id} (contract ${v.contractId} #${v.seqNo})`));
        this.variations.set(v.id, clone(v));
        return Promise.resolve();
    }

    save(v: VariationRecord): Promise<void> {
        const clash = v.number !== null
            && [...this.variations.values()].some(o => o.id !== v.id && o.workspaceId === v.workspaceId && o.number === v.number);
        if (clash) return Promise.reject(new Error(`duplicate variation number ${v.number}`));
        if (this.variations.get(v.id)?.workspaceId === v.workspaceId) this.variations.set(v.id, clone(v));
        return Promise.resolve();
    }

    linesOf(workspaceId: WorkspaceId, variationId: string): Promise<VariationLineRecord[]> {
        return Promise.resolve((this.lines.get(variationId) ?? [])
            .filter(l => l.workspaceId === workspaceId)
            .sort((a, b) => a.sort - b.sort)
            .map(clone));
    }

    replaceLines(workspaceId: WorkspaceId, variationId: string, lines: readonly VariationLineRecord[]): Promise<void> {
        if (this.variations.get(variationId)?.workspaceId === workspaceId) this.lines.set(variationId, lines.map(clone));
        return Promise.resolve();
    }

    counts(workspaceId: WorkspaceId, variationIds: readonly string[]): Promise<Map<string, { lines: number; evidence: number }>> {
        const out = new Map<string, { lines: number; evidence: number }>();
        for (const id of variationIds) {
            if (this.variations.get(id)?.workspaceId !== workspaceId) continue;
            out.set(id, {
                lines: (this.lines.get(id) ?? []).length,
                evidence: [...this.evidence.values()].filter(e => e.variationId === id).length,
            });
        }
        return Promise.resolve(out);
    }

    evidenceOf(workspaceId: WorkspaceId, variationId: string): Promise<VariationEvidenceRecord[]> {
        return Promise.resolve([...this.evidence.values()]
            .filter(e => e.workspaceId === workspaceId && e.variationId === variationId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(clone));
    }

    findEvidence(evidenceId: string): Promise<VariationEvidenceRecord | undefined> {
        const e = this.evidence.get(evidenceId);
        return Promise.resolve(e === undefined ? undefined : clone(e));
    }

    insertEvidence(e: VariationEvidenceRecord): Promise<void> {
        if (this.evidence.has(e.id)) return Promise.reject(new Error(`duplicate evidence ${e.id}`));
        this.evidence.set(e.id, clone(e));
        return Promise.resolve();
    }

    deleteEvidence(workspaceId: WorkspaceId, evidenceId: string): Promise<void> {
        if (this.evidence.get(evidenceId)?.workspaceId === workspaceId) this.evidence.delete(evidenceId);
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const v of [...this.variations.values()]) {
            if (v.workspaceId !== workspaceId || v.projectId !== projectId) continue;
            this.variations.delete(v.id);
            this.lines.delete(v.id);
            for (const e of [...this.evidence.values()]) if (e.variationId === v.id) this.evidence.delete(e.id);
        }
        return Promise.resolve();
    }
}
