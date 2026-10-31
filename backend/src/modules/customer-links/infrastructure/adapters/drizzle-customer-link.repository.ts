import { and, desc, eq, sql } from 'drizzle-orm';
import type { CustomerLinkSubject } from '@contrack/contract';
import { type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { customerLinks } from '../../../../shared/infrastructure/database/schema-erp-core';
import { CustomerLinkRepository } from '../../application/ports/customer-link.repository';
import type { CustomerLink } from '../../domain/customer-link';

type Row = typeof customerLinks.$inferSelect;

const toLink = (row: Row): CustomerLink => ({
    id: row.id,
    workspaceId: asWorkspaceId(row.workspaceId),
    projectId: asProjectId(row.projectId),
    tokenHash: row.tokenHash,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    createdBy: row.createdBy === null ? null : asUserId(row.createdBy),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    lastViewedAt: row.lastViewedAt,
    viewCount: row.viewCount,
    respondedAt: row.respondedAt,
    response: row.response === null ? null : { ...row.response, at: new Date(row.response.at) },
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleCustomerLinkRepository extends CustomerLinkRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findById(linkId: string): Promise<CustomerLink | undefined> {
        const [row] = await this.ctx.executor.select().from(customerLinks).where(eq(customerLinks.id, linkId)).limit(1);
        return row === undefined ? undefined : toLink(row);
    }

    async findByTokenHash(tokenHash: string): Promise<CustomerLink | undefined> {
        const [row] = await this.ctx.executor.select().from(customerLinks).where(eq(customerLinks.tokenHash, tokenHash)).limit(1);
        return row === undefined ? undefined : toLink(row);
    }

    async lockByTokenHash(tokenHash: string): Promise<CustomerLink | undefined> {
        const [row] = await this.ctx.executor.select().from(customerLinks).where(eq(customerLinks.tokenHash, tokenHash)).limit(1).for('update');
        return row === undefined ? undefined : toLink(row);
    }

    async listForSubject(workspaceId: WorkspaceId, subjectType: CustomerLinkSubject, subjectId: string): Promise<CustomerLink[]> {
        const rows = await this.ctx.executor.select().from(customerLinks)
            .where(and(eq(customerLinks.workspaceId, workspaceId), eq(customerLinks.subjectType, subjectType), eq(customerLinks.subjectId, subjectId)))
            .orderBy(desc(customerLinks.createdAt));
        return rows.map(toLink);
    }

    async save(link: CustomerLink): Promise<void> {
        const values = {
            id: link.id,
            workspaceId: link.workspaceId,
            projectId: link.projectId,
            tokenHash: link.tokenHash,
            subjectType: link.subjectType,
            subjectId: link.subjectId,
            createdBy: link.createdBy,
            createdAt: link.createdAt,
            expiresAt: link.expiresAt,
            revokedAt: link.revokedAt,
            lastViewedAt: link.lastViewedAt,
            viewCount: link.viewCount,
            respondedAt: link.respondedAt,
            response: link.response === null ? null : { ...link.response, at: link.response.at.toISOString() },
        };
        await this.ctx.executor.insert(customerLinks).values(values).onConflictDoUpdate({
            target: customerLinks.id,
            set: { expiresAt: values.expiresAt, revokedAt: values.revokedAt, respondedAt: values.respondedAt, response: values.response },
        });
    }

    async recordView(linkId: string, at: Date): Promise<void> {
        await this.ctx.executor.update(customerLinks)
            .set({ viewCount: sql`${customerLinks.viewCount} + 1`, lastViewedAt: at })
            .where(eq(customerLinks.id, linkId));
    }
}
