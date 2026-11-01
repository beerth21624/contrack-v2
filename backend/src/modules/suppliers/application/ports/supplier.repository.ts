import type { SupplierKind, SupplierRatingSource, TradeId } from '@contrack/contract';
import type { Supplier } from '../../../../shared/application/ports';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

export interface SupplierListFilter {
    q?: string;
    kind?: SupplierKind;
    trade?: TradeId;
    archived: boolean;
    limit: number;
}

/** One `sup_ratings` row. */
export interface SupplierRating {
    id: string;
    supplierId: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId | null;
    sourceType: SupplierRatingSource;
    sourceId: string | null;
    score: number;
    note: string;
    createdBy: UserId | null;
    createdAt: Date;
}

/** The supplier register. Every method filters by `workspaceId` except `findById` (the route carries only the id). */
export abstract class SupplierRepository {
    abstract findById(supplierId: string): Promise<Supplier | undefined>;
    abstract findMany(workspaceId: WorkspaceId, supplierIds: readonly string[]): Promise<Supplier[]>;
    /** By Thai/English name; `q` matches names, tax id, contact, phone, email and LINE id (case-insensitive). */
    abstract list(workspaceId: WorkspaceId, filter: SupplierListFilter): Promise<Supplier[]>;
    /** The active supplier with this tax id + branch (not `exceptId`). */
    abstract findActiveByTax(workspaceId: WorkspaceId, taxId: string, branchCode: string, exceptId?: string): Promise<Supplier | undefined>;
    /** Vendor-list entry ids already linked to a supplier of the workspace (archived ones too). */
    abstract linkedScEntryIds(workspaceId: WorkspaceId): Promise<Set<string>>;
    /** The supplier linked to a vendor-list entry (archived ones too), oldest first when several. */
    abstract findByScEntry(workspaceId: WorkspaceId, vendorListEntryId: string): Promise<Supplier | undefined>;
    abstract save(supplier: Supplier): Promise<void>;
    abstract addRating(rating: SupplierRating): Promise<void>;
    /** Every score of the supplier (for the average). */
    abstract scores(supplierId: string): Promise<number[]>;
    /** Newest first. */
    abstract listRatings(supplierId: string, limit: number): Promise<SupplierRating[]>;
}
