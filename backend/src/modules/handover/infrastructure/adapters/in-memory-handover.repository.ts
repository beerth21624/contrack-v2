import type { WarrantyClaimStatus } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type HandoverDocumentRecord, type HandoverRecord, HandoverRepository, type WarrantyClaimRecord, type WarrantyRecord,
} from '../../application/ports/handover.repository';

const clone = <T>(v: T): T => structuredClone(v);
const desc = (a: string, b: string): number => (a < b ? 1 : a > b ? -1 : 0);

/** Memory adapter (tests / trying without a database); mimics the unique project / number constraints and the cascades. */
export class InMemoryHandoverRepository extends HandoverRepository {
    private readonly handovers = new Map<string, HandoverRecord>();
    private readonly documents = new Map<string, HandoverDocumentRecord>();
    private readonly warranties = new Map<string, WarrantyRecord>();
    private readonly claims = new Map<string, WarrantyClaimRecord>();

    findHandover(handoverId: string): Promise<HandoverRecord | undefined> {
        const h = this.handovers.get(handoverId);
        return Promise.resolve(h === undefined ? undefined : clone(h));
    }

    handoverForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HandoverRecord | undefined> {
        const h = [...this.handovers.values()].find(x => x.workspaceId === workspaceId && x.projectId === projectId);
        return Promise.resolve(h === undefined ? undefined : clone(h));
    }

    lockHandover(workspaceId: WorkspaceId, handoverId: string): Promise<HandoverRecord | undefined> {
        const h = this.handovers.get(handoverId);
        return Promise.resolve(h?.workspaceId === workspaceId ? clone(h) : undefined);
    }

    insertHandover(h: HandoverRecord): Promise<void> {
        const clash = [...this.handovers.values()].some(o => o.id === h.id || o.projectId === h.projectId
            || (h.number !== null && o.workspaceId === h.workspaceId && o.number === h.number));
        if (clash) return Promise.reject(new Error(`duplicate handover of project ${h.projectId}`));
        this.handovers.set(h.id, clone(h));
        return Promise.resolve();
    }

    saveHandover(h: HandoverRecord): Promise<void> {
        if (this.handovers.get(h.id)?.workspaceId === h.workspaceId) this.handovers.set(h.id, clone(h));
        return Promise.resolve();
    }

    documentsOf(workspaceId: WorkspaceId, handoverId: string): Promise<HandoverDocumentRecord[]> {
        return Promise.resolve([...this.documents.values()]
            .filter(d => d.workspaceId === workspaceId && d.handoverId === handoverId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(clone));
    }

    insertDocument(d: HandoverDocumentRecord): Promise<void> {
        if (this.documents.has(d.id)) return Promise.reject(new Error(`duplicate handover document ${d.id}`));
        this.documents.set(d.id, clone(d));
        return Promise.resolve();
    }

    deleteDocuments(workspaceId: WorkspaceId, handoverId: string, documentIds: readonly string[]): Promise<void> {
        for (const id of documentIds) {
            const d = this.documents.get(id);
            if (d?.workspaceId === workspaceId && d.handoverId === handoverId) this.documents.delete(id);
        }
        return Promise.resolve();
    }

    warrantyForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<WarrantyRecord | undefined> {
        const w = [...this.warranties.values()].find(x => x.workspaceId === workspaceId && x.projectId === projectId);
        return Promise.resolve(w === undefined ? undefined : clone(w));
    }

    warrantiesForProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<WarrantyRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.warranties.values()].filter(w => w.workspaceId === workspaceId && ids.has(w.projectId)).map(clone));
    }

    insertWarranty(w: WarrantyRecord): Promise<void> {
        const clash = [...this.warranties.values()].some(o => o.id === w.id || o.projectId === w.projectId);
        if (clash) return Promise.reject(new Error(`duplicate warranty of project ${w.projectId}`));
        this.warranties.set(w.id, clone(w));
        return Promise.resolve();
    }

    saveWarranty(w: WarrantyRecord): Promise<void> {
        if (this.warranties.get(w.id)?.workspaceId === w.workspaceId) this.warranties.set(w.id, clone(w));
        return Promise.resolve();
    }

    activeWarrantiesEndingBy(endBy: string, limit: number): Promise<WarrantyRecord[]> {
        return Promise.resolve([...this.warranties.values()]
            .filter(w => w.status === 'active' && w.endDate <= endBy)
            .sort((a, b) => (a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0))
            .slice(0, limit)
            .map(clone));
    }

    findClaim(claimId: string): Promise<WarrantyClaimRecord | undefined> {
        const c = this.claims.get(claimId);
        return Promise.resolve(c === undefined ? undefined : clone(c));
    }

    lockClaim(workspaceId: WorkspaceId, claimId: string): Promise<WarrantyClaimRecord | undefined> {
        const c = this.claims.get(claimId);
        return Promise.resolve(c?.workspaceId === workspaceId ? clone(c) : undefined);
    }

    claimsByProject(workspaceId: WorkspaceId, projectId: ProjectId, status?: WarrantyClaimStatus): Promise<WarrantyClaimRecord[]> {
        return Promise.resolve([...this.claims.values()]
            .filter(c => c.workspaceId === workspaceId && c.projectId === projectId && (status === undefined || c.status === status))
            .sort((a, b) => desc(a.reportedDate, b.reportedDate) || b.createdAt.getTime() - a.createdAt.getTime())
            .map(clone));
    }

    claimsOfProjects(
        workspaceId: WorkspaceId, projectIds: readonly ProjectId[], statuses: readonly WarrantyClaimStatus[],
    ): Promise<WarrantyClaimRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.claims.values()]
            .filter(c => c.workspaceId === workspaceId && ids.has(c.projectId) && statuses.includes(c.status))
            .map(clone));
    }

    insertClaim(c: WarrantyClaimRecord): Promise<void> {
        const clash = [...this.claims.values()].some(o => o.id === c.id
            || (c.number !== null && o.workspaceId === c.workspaceId && o.number === c.number));
        if (clash) return Promise.reject(new Error(`duplicate warranty claim ${c.id}`));
        this.claims.set(c.id, clone(c));
        return Promise.resolve();
    }

    saveClaim(c: WarrantyClaimRecord): Promise<void> {
        if (this.claims.get(c.id)?.workspaceId === c.workspaceId) this.claims.set(c.id, clone(c));
        return Promise.resolve();
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        const handoverIds = new Set<string>();
        for (const [id, h] of this.handovers) {
            if (h.workspaceId === workspaceId && h.projectId === projectId) {
                handoverIds.add(id);
                this.handovers.delete(id);
            }
        }
        for (const [id, d] of this.documents) if (handoverIds.has(d.handoverId)) this.documents.delete(id);
        for (const [id, w] of this.warranties) if (w.workspaceId === workspaceId && w.projectId === projectId) this.warranties.delete(id);
        for (const [id, c] of this.claims) if (c.workspaceId === workspaceId && c.projectId === projectId) this.claims.delete(id);
        return Promise.resolve();
    }
}
