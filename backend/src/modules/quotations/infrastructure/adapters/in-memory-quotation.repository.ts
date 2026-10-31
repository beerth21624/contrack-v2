import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type ExpiredVersionRef, QuotationRepository, type QuotationRecord, type QuotationVersionRecord, type QuotationVersionRows,
} from '../../application/ports/quotation.repository';

const clone = <T>(v: T): T => structuredClone(v);

/** Memory adapter (tests / trying without a database); mimics the unique keys of `qt_quotation_versions`. */
export class InMemoryQuotationRepository extends QuotationRepository {
    private readonly quotations = new Map<string, QuotationRecord>();
    private readonly versions = new Map<string, QuotationVersionRecord>();
    private readonly content = new Map<string, QuotationVersionRows>();

    findQuotation(quotationId: string): Promise<QuotationRecord | undefined> {
        const q = this.quotations.get(quotationId);
        return Promise.resolve(q === undefined ? undefined : clone(q));
    }

    lockQuotation(workspaceId: WorkspaceId, quotationId: string): Promise<QuotationRecord | undefined> {
        const q = this.quotations.get(quotationId);
        return Promise.resolve(q?.workspaceId === workspaceId ? clone(q) : undefined);
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<QuotationRecord[]> {
        return Promise.resolve([...this.quotations.values()]
            .filter(q => q.workspaceId === workspaceId && q.projectId === projectId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map(clone));
    }

    insertQuotation(q: QuotationRecord): Promise<void> {
        if (this.quotations.has(q.id)) return Promise.reject(new Error(`duplicate quotation ${q.id}`));
        this.quotations.set(q.id, clone(q));
        return Promise.resolve();
    }

    saveQuotation(q: QuotationRecord): Promise<void> {
        if (this.quotations.get(q.id)?.workspaceId === q.workspaceId) this.quotations.set(q.id, clone(q));
        return Promise.resolve();
    }

    findVersion(versionId: string): Promise<QuotationVersionRecord | undefined> {
        const v = this.versions.get(versionId);
        return Promise.resolve(v === undefined ? undefined : clone(v));
    }

    versionsOf(workspaceId: WorkspaceId, quotationIds: readonly string[]): Promise<QuotationVersionRecord[]> {
        const ids = new Set(quotationIds);
        return Promise.resolve([...this.versions.values()]
            .filter(v => v.workspaceId === workspaceId && ids.has(v.quotationId))
            .sort((a, b) => a.versionNo - b.versionNo)
            .map(clone));
    }

    insertVersion(v: QuotationVersionRecord, rows: QuotationVersionRows): Promise<void> {
        const open = (s: QuotationVersionRecord['status']): boolean => s === 'draft' || s === 'pending_approval';
        const clash = [...this.versions.values()].some(o => o.id === v.id
            || (o.quotationId === v.quotationId && (o.versionNo === v.versionNo || (open(o.status) && open(v.status)))));
        if (clash) return Promise.reject(new Error(`duplicate quotation version ${v.id} (quotation ${v.quotationId}, no ${v.versionNo})`));
        this.versions.set(v.id, clone(v));
        this.content.set(v.id, clone(rows));
        return Promise.resolve();
    }

    saveVersion(v: QuotationVersionRecord): Promise<void> {
        if (this.versions.get(v.id)?.workspaceId === v.workspaceId) this.versions.set(v.id, clone(v));
        return Promise.resolve();
    }

    replaceRows(workspaceId: WorkspaceId, versionId: string, rows: QuotationVersionRows): Promise<void> {
        if (this.versions.get(versionId)?.workspaceId === workspaceId) this.content.set(versionId, clone(rows));
        return Promise.resolve();
    }

    rows(workspaceId: WorkspaceId, versionId: string): Promise<QuotationVersionRows> {
        const rows = this.content.get(versionId);
        if (this.versions.get(versionId)?.workspaceId !== workspaceId || rows === undefined) return Promise.resolve({ sections: [], lines: [] });
        const out = clone(rows);
        out.sections.sort((a, b) => a.sort - b.sort || a.sectionNo - b.sectionNo);
        out.lines.sort((a, b) => a.sectionNo - b.sectionNo || a.sort - b.sort);
        return Promise.resolve(out);
    }

    issuedValidBefore(today: string, limit: number): Promise<ExpiredVersionRef[]> {
        return Promise.resolve([...this.versions.values()]
            .filter(v => v.status === 'issued' && v.validUntil !== null && v.validUntil < today)
            .slice(0, limit)
            .map(v => ({ id: v.id, workspaceId: v.workspaceId })));
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const v of [...this.versions.values()]) {
            if (v.workspaceId === workspaceId && v.projectId === projectId) {
                this.versions.delete(v.id);
                this.content.delete(v.id);
            }
        }
        for (const q of [...this.quotations.values()]) {
            if (q.workspaceId === workspaceId && q.projectId === projectId) this.quotations.delete(q.id);
        }
        return Promise.resolve();
    }
}
