import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import type { PriceReferenceItemDto } from '@contrack/contract';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { priceReferenceBooks, priceReferenceItems } from '../../../../shared/infrastructure/database/schema-erp-core';
import { PriceReferenceRepository, type PriceReferenceSearch } from '../../application/ports/price-reference.repository';

/** Escapes LIKE wildcards so "50%" searches for the text. */
const likeEscape = (s: string): string => s.replace(/[\\%_]/g, c => `\\${c}`);

/** Postgres adapter: every word must appear in the `search` column; the newest book first, then by material. */
export class DrizzlePriceReferenceRepository extends PriceReferenceRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async search({ q, category, limit }: PriceReferenceSearch): Promise<PriceReferenceItemDto[]> {
        const conditions: SQL[] = q.split(/\s+/).filter(t => t !== '')
            .map(t => sql`${priceReferenceItems.search} like ${`%${likeEscape(t)}%`}`);
        if (category !== undefined) conditions.push(eq(priceReferenceItems.category, category));
        const rows = await this.ctx.executor
            .select({ item: priceReferenceItems, year: priceReferenceBooks.year })
            .from(priceReferenceItems)
            .innerJoin(priceReferenceBooks, eq(priceReferenceBooks.id, priceReferenceItems.bookId))
            .where(and(...conditions))
            .orderBy(sql`${priceReferenceBooks.year} desc`, asc(priceReferenceItems.material), asc(priceReferenceItems.price))
            .limit(limit);
        return rows.map(r => ({
            id: r.item.id,
            bookId: r.item.bookId,
            mid: r.item.mid,
            category: r.item.category,
            material: r.item.material,
            spec: r.item.spec,
            brand: r.item.brand,
            model: r.item.model,
            unit: r.item.unit,
            greenLabel: r.item.greenLabel,
            price: r.item.price,
            year: r.year,
        }));
    }
}
