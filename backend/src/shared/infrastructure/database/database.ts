// ─── Drizzle client, transactions joined through AsyncLocalStorage ───
import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { UnitOfWork } from '../../application/ports';
import { schema as coreSchema } from './schema';
import { boqControlTables } from './schema-boq-control';
import { contractsBillingTables } from './schema-contracts-billing';
import { erpCoreTables } from './schema-erp-core';
import { handoverTables } from './schema-handover';
import { identityPhoneTables } from './schema-identity-phone';
import { jobCostTables } from './schema-job-cost';
import { ledgerTables } from './schema-ledger';
import { payablesTables } from './schema-payables';
import { platformTables } from './schema-platform';
import { procurementTables } from './schema-procurement';
import { quotationTables } from './schema-quotations';
import { scBiddingTables } from './schema-sc-bidding';
import { scContractsTables } from './schema-sc-contracts';
import { scSharedTables } from './schema-sc-shared';
import { scSourcingTables } from './schema-sc-sourcing';
import { siteTables } from './schema-site';
import { variationTables } from './schema-variations';

/** Core tables (schema.ts) + one file per business work stream (no file imports another stream's file). */
export const schema = {
    ...coreSchema, ...identityPhoneTables, ...platformTables, ...scSharedTables, ...scSourcingTables, ...scBiddingTables,
    ...scContractsTables, ...erpCoreTables, ...boqControlTables, ...ledgerTables, ...quotationTables, ...contractsBillingTables,
    ...variationTables, ...procurementTables, ...siteTables, ...jobCostTables,
    ...payablesTables, ...handoverTables,
};

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
