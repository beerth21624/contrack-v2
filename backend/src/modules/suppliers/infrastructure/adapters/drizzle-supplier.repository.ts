import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import type { Supplier } from '../../../../shared/application/ports';
import { type WorkspaceId, asProjectId, asUserId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { supRatings, supSuppliers } from '../../../../shared/infrastructure/database/schema-procurement';
import { SupplierRepository, type SupplierListFilter, type SupplierRating } from '../../application/ports/supplier.repository';

type Row = typeof supSuppliers.$inferSelect;
type RatingRow = typeof supRatings.$inferSelect;

const toSupplier = (row: Row): Supplier => ({
    id: row.id,
    workspaceId: row.workspaceId as WorkspaceId,
    kind: row.kind,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
    taxId: row.taxId,
    branchCode: row.branchCode,
    isJuristic: row.isJuristic,
    vatRegistered: row.vatRegistered,
    addressTh: row.addressTh,
    addressEn: row.addressEn,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    lineId: row.lineId,
    creditTermDays: row.creditTermDays,
    defaultWhtPreset: row.defaultWhtPreset,
    bankAccounts: row.bankAccounts,
    trades: row.trades,
    scVendorListEntryId: row.scVendorListEntryId,
    vendorWorkspaceId: row.vendorWorkspaceId === null ? null : (row.vendorWorkspaceId as WorkspaceId),
    rating: row.rating,
    ratingCount: row.ratingCount,
    note: row.note,
    archivedAt: row.archivedAt,
    createdBy: row.createdBy === null ? null : asUserId(row.createdBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});

const toRating = (row: RatingRow): SupplierRating => ({
    id: row.id,
    supplierId: row.supplierId,
    workspaceId: row.workspaceId as WorkspaceId,
    projectId: row.projectId === null ? null : asProjectId(row.projectId),
    sourceType: row.sourceType as SupplierRating['sourceType'],
    sourceId: row.sourceId,
    score: row.score,
    note: row.note,
    createdBy: row.createdBy === null ? null : asUserId(row.createdBy),
    createdAt: row.createdAt,
});

const escapeLike = (s: string): string => s.replace(/[\\%_]/g, m => `\\${m}`);

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleSupplierRepository extends SupplierRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findById(supplierId: string): Promise<Supplier | undefined> {
        const [row] = await this.ctx.executor.select().from(supSuppliers).where(eq(supSuppliers.id, supplierId)).limit(1);
        return row === undefined ? undefined : toSupplier(row);
    }

    async findMany(workspaceId: WorkspaceId, ids: readonly string[]): Promise<Supplier[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(supSuppliers)
            .where(and(eq(supSuppliers.workspaceId, workspaceId), inArray(supSuppliers.id, [...ids])));
        return rows.map(toSupplier);
    }

    async list(workspaceId: WorkspaceId, f: SupplierListFilter): Promise<Supplier[]> {
        const s = supSuppliers;
        const conds = [eq(s.workspaceId, workspaceId), f.archived ? isNotNull(s.archivedAt) : isNull(s.archivedAt)];
        if (f.kind !== undefined) conds.push(eq(s.kind, f.kind));
        if (f.trade !== undefined) conds.push(sql`${s.trades} @> ${JSON.stringify([f.trade])}::jsonb`);
        if (f.q !== undefined && f.q.trim() !== '') {
            const like = `%${escapeLike(f.q.trim())}%`;
            const match = or(
                sql`${s.nameTh} ilike ${like}`, sql`${s.nameEn} ilike ${like}`, sql`${s.taxId} ilike ${like}`,
                sql`${s.contactName} ilike ${like}`, sql`${s.phone} ilike ${like}`, sql`${s.email} ilike ${like}`,
                sql`${s.lineId} ilike ${like}`,
            );
            if (match !== undefined) conds.push(match);
        }
        const rows = await this.ctx.executor.select().from(s).where(and(...conds))
            .orderBy(asc(sql`coalesce(nullif(${s.nameTh}, ''), ${s.nameEn})`), asc(s.id)).limit(f.limit);
        return rows.map(toSupplier);
    }

    async findActiveByTax(workspaceId: WorkspaceId, taxId: string, branchCode: string, exceptId?: string): Promise<Supplier | undefined> {
        const s = supSuppliers;
        const conds = [eq(s.workspaceId, workspaceId), eq(s.taxId, taxId), eq(s.branchCode, branchCode), isNull(s.archivedAt)];
        if (exceptId !== undefined) conds.push(ne(s.id, exceptId));
        const [row] = await this.ctx.executor.select().from(s).where(and(...conds)).limit(1);
        return row === undefined ? undefined : toSupplier(row);
    }

    async findByScEntry(workspaceId: WorkspaceId, vendorListEntryId: string): Promise<Supplier | undefined> {
        const [row] = await this.ctx.executor.select().from(supSuppliers)
            .where(and(eq(supSuppliers.workspaceId, workspaceId), eq(supSuppliers.scVendorListEntryId, vendorListEntryId)))
            .orderBy(asc(supSuppliers.createdAt)).limit(1);
        return row === undefined ? undefined : toSupplier(row);
    }

    async linkedScEntryIds(workspaceId: WorkspaceId): Promise<Set<string>> {
        const rows = await this.ctx.executor.select({ id: supSuppliers.scVendorListEntryId }).from(supSuppliers)
            .where(and(eq(supSuppliers.workspaceId, workspaceId), isNotNull(supSuppliers.scVendorListEntryId)));
        return new Set(rows.map(r => r.id).filter((id): id is string => id !== null));
    }

    async save(supplier: Supplier): Promise<void> {
        const { id, workspaceId, createdAt, createdBy, ...rest } = supplier;
        await this.ctx.executor.insert(supSuppliers)
            .values({ id, workspaceId, createdAt, createdBy, ...rest })
            .onConflictDoUpdate({ target: supSuppliers.id, set: rest });
    }

    async addRating(r: SupplierRating): Promise<void> {
        await this.ctx.executor.insert(supRatings).values(r);
    }

    async scores(supplierId: string): Promise<number[]> {
        const rows = await this.ctx.executor.select({ score: supRatings.score }).from(supRatings).where(eq(supRatings.supplierId, supplierId));
        return rows.map(r => r.score);
    }

    async listRatings(supplierId: string, limit: number): Promise<SupplierRating[]> {
        const rows = await this.ctx.executor.select().from(supRatings).where(eq(supRatings.supplierId, supplierId))
            .orderBy(desc(supRatings.createdAt), desc(supRatings.id)).limit(limit);
        return rows.map(toRating);
    }
}
