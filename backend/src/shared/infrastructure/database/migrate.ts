// `npm run db:migrate` (or `node dist/backend/src/shared/infrastructure/database/migrate.js` in the Docker image):
// applies the SQL migrations in backend/drizzle to DATABASE_URL. MIGRATIONS_DIR overrides where they are read from.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase, createPool } from './database';

/** backend/drizzle from src/… (tsx) or from dist/backend/src/… (compiled), unless MIGRATIONS_DIR is set. */
function migrationsFolder(): string {
    const configured = process.env.MIGRATIONS_DIR;
    if (configured !== undefined && configured !== '') return path.resolve(configured);
    const candidates = [path.resolve(__dirname, '../../../../drizzle'), path.resolve(__dirname, '../../../../../../drizzle')];
    const found = candidates.find(dir => existsSync(path.join(dir, 'meta', '_journal.json')));
    if (found === undefined) throw new Error(`no migrations found (looked in ${candidates.join(', ')}); set MIGRATIONS_DIR`);
    return found;
}

async function main(): Promise<void> {
    const url = process.env.DATABASE_URL;
    if (url === undefined || url === '') throw new Error('DATABASE_URL is not set');
    const pool = createPool(url);
    try {
        await migrate(createDatabase(pool), { migrationsFolder: migrationsFolder() });
        console.log('migrations applied');
    } finally {
        await pool.end();
    }
}

main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
});
