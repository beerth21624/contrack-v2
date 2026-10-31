import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import type { Customer } from '../../../../shared/application/ports';
import { type WorkspaceId, asUserId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { customers } from '../../../../shared/infrastructure/database/schema-erp-core';
import { CustomerRepository, type CustomerListFilter } from '../../application/ports/customer.repository';

type Row = typeof customers.$inferSelect;

const toCustomer = (row: Row): Customer => ({
    id: row.id,
    workspaceId: row.workspaceId as WorkspaceId,
    kind: row.kind,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
    taxId: row.taxId,
    branchCode: row.branchCode,
    addressTh: row.addressTh,
    addressEn: row.addressEn,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    lineId: row.lineId,
    defaultWhtRate: row.defaultWhtRate,
    defaultDocLanguage: row.defaultDocLanguage,
    paymentTermDays: row.paymentTermDays,
    note: row.note,
    archivedAt: row.archivedAt,
    createdBy: row.createdBy === null ? null : asUserId(row.createdBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});

const escapeLike = (s: string): string => s.replace(/[\\%_]/g, m => `\\${m}`);

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleCustomerRepository extends CustomerRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findById(customerId: string): Promise<Customer | undefined> {
        const [row] = await this.ctx.executor.select().from(customers).where(eq(customers.id, customerId)).limit(1);
        return row === undefined ? undefined : toCustomer(row);
    }

    async findMany(workspaceId: WorkspaceId, ids: readonly string[]): Promise<Customer[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(customers)
            .where(and(eq(customers.workspaceId, workspaceId), inArray(customers.id, [...ids])));
        return rows.map(toCustomer);
    }

    async list(workspaceId: WorkspaceId, f: CustomerListFilter): Promise<Customer[]> {
        const conds = [eq(customers.workspaceId, workspaceId), f.archived ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt)];
        if (f.kind !== undefined) conds.push(eq(customers.kind, f.kind));
        if (f.q !== undefined && f.q.trim() !== '') {
            const like = `%${escapeLike(f.q.trim())}%`;
            const match = or(
                sql`${customers.nameTh} ilike ${like}`, sql`${customers.nameEn} ilike ${like}`, sql`${customers.taxId} ilike ${like}`,
                sql`${customers.contactName} ilike ${like}`, sql`${customers.phone} ilike ${like}`, sql`${customers.email} ilike ${like}`,
                sql`${customers.lineId} ilike ${like}`,
            );
            if (match !== undefined) conds.push(match);
        }
        const rows = await this.ctx.executor.select().from(customers).where(and(...conds))
            .orderBy(asc(sql`coalesce(nullif(${customers.nameTh}, ''), ${customers.nameEn})`), asc(customers.id)).limit(f.limit);
        return rows.map(toCustomer);
    }

    async findActiveByTax(workspaceId: WorkspaceId, taxId: string, branchCode: string, exceptId?: string): Promise<Customer | undefined> {
        const conds = [eq(customers.workspaceId, workspaceId), eq(customers.taxId, taxId), eq(customers.branchCode, branchCode), isNull(customers.archivedAt)];
        if (exceptId !== undefined) conds.push(ne(customers.id, exceptId));
        const [row] = await this.ctx.executor.select().from(customers).where(and(...conds)).limit(1);
        return row === undefined ? undefined : toCustomer(row);
    }

    async save(c: Customer): Promise<void> {
        const { id, workspaceId, createdAt, createdBy, ...rest } = c;
        await this.ctx.executor.insert(customers)
            .values({ id, workspaceId, createdAt, createdBy, ...rest })
            .onConflictDoUpdate({ target: customers.id, set: rest });
    }
}
