import type { Supplier } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { SupplierRepository, type SupplierListFilter, type SupplierRating } from '../../application/ports/supplier.repository';
import { matchesSupplierQuery } from '../../domain/supplier';

/** Memory adapter (tests / trying without a database); stores copies. */
export class InMemorySupplierRepository extends SupplierRepository {
    private readonly rows = new Map<string, Supplier>();
    private readonly ratings: SupplierRating[] = [];

    findById(supplierId: string): Promise<Supplier | undefined> {
        const row = this.rows.get(supplierId);
        return Promise.resolve(row === undefined ? undefined : structuredClone(row));
    }

    findMany(workspaceId: WorkspaceId, ids: readonly string[]): Promise<Supplier[]> {
        const out: Supplier[] = [];
        for (const id of ids) {
            const row = this.rows.get(id);
            if (row?.workspaceId === workspaceId) out.push(structuredClone(row));
        }
        return Promise.resolve(out);
    }

    list(workspaceId: WorkspaceId, f: SupplierListFilter): Promise<Supplier[]> {
        const rows = [...this.rows.values()]
            .filter(s => s.workspaceId === workspaceId && (s.archivedAt !== null) === f.archived)
            .filter(s => f.kind === undefined || s.kind === f.kind)
            .filter(s => f.trade === undefined || s.trades.includes(f.trade))
            .filter(s => f.q === undefined || f.q === '' || matchesSupplierQuery(s, f.q))
            .sort((a, b) => (a.nameTh || a.nameEn).localeCompare(b.nameTh || b.nameEn, 'th'))
            .slice(0, f.limit);
        return Promise.resolve(structuredClone(rows));
    }

    findActiveByTax(workspaceId: WorkspaceId, taxId: string, branchCode: string, exceptId?: string): Promise<Supplier | undefined> {
        const hit = [...this.rows.values()].find(s => s.workspaceId === workspaceId && s.archivedAt === null && s.taxId === taxId
            && s.branchCode === branchCode && s.id !== exceptId);
        return Promise.resolve(hit === undefined ? undefined : structuredClone(hit));
    }

    linkedScEntryIds(workspaceId: WorkspaceId): Promise<Set<string>> {
        const ids = [...this.rows.values()].filter(s => s.workspaceId === workspaceId)
            .flatMap(s => (s.scVendorListEntryId === null ? [] : [s.scVendorListEntryId]));
        return Promise.resolve(new Set(ids));
    }

    save(supplier: Supplier): Promise<void> {
        this.rows.set(supplier.id, structuredClone(supplier));
        return Promise.resolve();
    }

    addRating(rating: SupplierRating): Promise<void> {
        this.ratings.push(structuredClone(rating));
        return Promise.resolve();
    }

    scores(supplierId: string): Promise<number[]> {
        return Promise.resolve(this.ratings.filter(r => r.supplierId === supplierId).map(r => r.score));
    }

    listRatings(supplierId: string, limit: number): Promise<SupplierRating[]> {
        const rows = this.ratings.filter(r => r.supplierId === supplierId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
        return Promise.resolve(structuredClone(rows));
    }
}
