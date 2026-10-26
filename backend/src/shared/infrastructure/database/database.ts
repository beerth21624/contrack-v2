// ─── Drizzle client, transactions joined through AsyncLocalStorage ───
import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { UnitOfWork } from '../../application/ports';
import { schema } from './schema';

export type Database = NodePgDatabase<typeof schema>;
/** A Drizzle handle: the root database or the current transaction (same query API). */
export type DbExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'execute' | 'query'>;

export function createPool(url: string): Pool {
    return new Pool({ connectionString: url, max: 10 });
}

export function createDatabase(pool: Pool): Database {
    return drizzle(pool, { schema });
}

/**
 * Injected into Drizzle repositories. `executor` is the transaction started by DrizzleUnitOfWork when there is
 * one, else the root database — so a repository never has to know whether it runs inside a transaction.
 */
export class DatabaseContext {
    private readonly storage = new AsyncLocalStorage<DbExecutor>();

    constructor(readonly db: Database, readonly pool: Pool) {}

    get executor(): DbExecutor {
        return this.storage.getStore() ?? this.db;
    }

    /** Runs work with `executor` bound to a new transaction (nested calls reuse the outer one). */
    async transaction<T>(work: () => Promise<T>): Promise<T> {
        if (this.storage.getStore()) return work();
        return this.db.transaction(tx => this.storage.run(tx, work));
    }
}

export class DrizzleUnitOfWork extends UnitOfWork {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    run<T>(work: () => Promise<T>): Promise<T> {
        return this.ctx.transaction(work);
    }
}

/** In-memory persistence: no transaction to open (stores are updated in order within one event-loop turn). */
export class InMemoryUnitOfWork extends UnitOfWork {
    run<T>(work: () => Promise<T>): Promise<T> {
        return work();
    }
}
