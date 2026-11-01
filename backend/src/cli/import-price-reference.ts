// ─── `npm run db:import-prices [-- --file <path>] [--if-missing]`: imports the government green price catalogue (WP-21) ───
// Reads goverment_price.json (default ../goverment_price.json from backend/), skips the rows without a numeric price,
// and replaces the platform book of the same source + year inside one transaction (re-running never duplicates).
// --if-missing (used by the Docker entrypoint on every start): does nothing when that platform book already exists.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { createDatabase, createPool } from '../shared/infrastructure/database/database';
import { priceReferenceBooks, priceReferenceItems } from '../shared/infrastructure/database/schema-erp-core';

const SOURCE = 'government_green_2568';
const CHUNK = 500;

interface RawItem {
    mid?: number | string;
    year?: string;
    spec?: string;
    envirolment_proof?: string;
    model?: string;
    sub_spec_model?: string;
    brand?: string;
    category?: string;
    material?: string;
    unit_type?: string;
    price_baht?: string;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** "2,731.10" → 2731.1; "-" or empty → undefined. */
export function parsePrice(raw: unknown): number | undefined {
    const s = clean(raw).replace(/,/g, '');
    if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
}

function fileArg(): string {
    const i = process.argv.indexOf('--file');
    const given = i >= 0 ? process.argv[i + 1] : undefined;
    return path.resolve(given !== undefined && given !== '' ? given : '../goverment_price.json');
}

async function main(): Promise<void> {
    const url = process.env.DATABASE_URL;
    if (url === undefined || url === '') throw new Error('DATABASE_URL is not set');
    const file = fileArg();
    const json = JSON.parse(readFileSync(file, 'utf8')) as { result?: { items?: RawItem[] } };
    const raw = json.result?.items;
    if (!Array.isArray(raw)) throw new Error(`${file}: result.items[] not found`);

    const year = '2568';
    const bookId = randomUUID();
    let skipped = 0;
    const items: (typeof priceReferenceItems.$inferInsert)[] = [];
    for (const r of raw) {
        const price = parsePrice(r.price_baht);
        const material = clean(r.material);
        if (price === undefined || material === '') {
            skipped += 1;
            continue;
        }
        const spec = clean(r.spec);
        const brand = clean(r.brand);
        const model = [clean(r.model), clean(r.sub_spec_model)].filter(x => x !== '').join(' ');
        const category = clean(r.category);
        items.push({
            id: randomUUID(),
            bookId,
            mid: String(r.mid ?? ''),
            category,
            material,
            spec,
            brand,
            model,
            unit: clean(r.unit_type),
            greenLabel: clean(r.envirolment_proof) !== '',
            price,
            search: [material, spec, brand, model, category].join(' ').toLowerCase(),
        });
    }

    const pool = createPool(url);
    try {
        const db = createDatabase(pool);
        if (process.argv.includes('--if-missing')) {
            const existing = await db.select({ id: priceReferenceBooks.id }).from(priceReferenceBooks).where(and(
                eq(priceReferenceBooks.source, SOURCE), eq(priceReferenceBooks.year, year), isNull(priceReferenceBooks.workspaceId),
            )).limit(1);
            if (existing.length > 0) {
                console.log(`price book ${SOURCE} ${year} already imported, skipping`);
                return;
            }
        }
        await db.transaction(async tx => {
            await tx.delete(priceReferenceBooks).where(and(
                eq(priceReferenceBooks.source, SOURCE), eq(priceReferenceBooks.year, year), isNull(priceReferenceBooks.workspaceId),
            ));
            await tx.insert(priceReferenceBooks).values({
                id: bookId,
                workspaceId: null,
                source: SOURCE,
                year,
                titleTh: 'ราคากลางวัสดุก่อสร้างฉลากเขียว ปี 2568',
                titleEn: 'Government reference prices for green-label construction materials, 2025',
                itemCount: items.length,
            });
            for (let i = 0; i < items.length; i += CHUNK) await tx.insert(priceReferenceItems).values(items.slice(i, i + CHUNK));
        });
        console.log(`imported ${String(items.length)} items from ${file}; skipped ${String(skipped)} rows without a numeric price`);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main().catch((e: unknown) => {
        console.error(e);
        process.exit(1);
    });
}
