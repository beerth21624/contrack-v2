// ─── Integration-test support: a real PostgreSQL when one is reachable, otherwise the suite is skipped ───
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { DatabaseContext, createDatabase, createPool } from '../../src/shared/infrastructure/database/database';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://contrack:contrack@localhost:5432/contrack_test';

let reachable: boolean | undefined;

/** True when TEST_DATABASE_URL accepts a connection within 2 s (checked once per process). */
export async function databaseReachable(): Promise<boolean> {
    if (reachable !== undefined) return reachable;
    const client = new Client({ connectionString: TEST_DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
        await client.connect();
        await client.end();
        reachable = true;
    } catch {
        reachable = false;
    }
    return reachable;
}

/**
 * `describeIfDatabase('drizzle users', ctx => { … })`: runs the suite against a migrated, emptied database,
 * or registers it as skipped when PostgreSQL is not reachable (so CI without Docker stays green and honest).
 */
export function describeIfDatabase(name: string, body: (db: () => DatabaseContext) => void): void {
    let ctx: DatabaseContext | undefined;
    // Probed by test/support/int-global-setup.js (jest-int.config.js); unknown → decided per test (skipIfNoDatabase).
    const define = process.env.CONTRACK_TEST_DATABASE === 'unreachable' ? describe.skip : describe;
    define(name, () => {
        beforeAll(async () => {
            if (!(await databaseReachable())) return;
            const pool = createPool(TEST_DATABASE_URL);
            ctx = new DatabaseContext(createDatabase(pool), pool);
            await migrate(ctx.db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
        });
        beforeEach(async () => {
            if (ctx === undefined) return;
            await ctx.db.execute(sql`truncate table project_supervisors, crew_assignments, crew_members, crews, people,
                project_task_lags, rate_cards, activity_log, level_assignments, project_revisions, project_docs,
                projects, invitations, memberships, workspaces, refresh_tokens, users restart identity cascade`);
        });
        afterAll(async () => {
            await ctx?.pool.end();
        });
        const get = (): DatabaseContext => {
            if (ctx === undefined) throw new Error('database not available');
            return ctx;
        };
        // Each test calls skipIfNoDatabase() first; jest has no async describe-level skip.
        body(get);
    });
}

/** First line of every integration test: `if (await skipIfNoDatabase()) return;` */
export async function skipIfNoDatabase(): Promise<boolean> {
    const ok = await databaseReachable();
    if (!ok) console.warn(`[integration] skipped: no PostgreSQL at ${TEST_DATABASE_URL}`);
    return !ok;
}
