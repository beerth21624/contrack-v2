// `npm run db:migrate`: applies the SQL migrations in ./drizzle to DATABASE_URL.
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase, createPool } from './database';

async function main(): Promise<void> {
    const url = process.env.DATABASE_URL;
    if (url === undefined || url === '') throw new Error('DATABASE_URL is not set');
    const pool = createPool(url);
    try {
        await migrate(createDatabase(pool), { migrationsFolder: path.resolve(__dirname, '../../../../drizzle') });
        console.log('migrations applied');
    } finally {
        await pool.end();
    }
}

main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
});
