// ─── Global infrastructure: config, clock, ids, database, unit of work ───
import { Global, Module, type DynamicModule, type OnApplicationShutdown, type OnModuleInit, type Provider, Inject, Optional } from '@nestjs/common';
import {
    ApprovalHandlers, Clock, CustomerLinkHandlers, DailySweeps, HubRollups, IdGenerator, ModuleWorkRegistry, ProjectDeletionGuards, ProjectDependents, UnitOfWork,
    WorkspaceDeletionGuards,
} from '../application/ports';
import { AppConfig, type Env } from './config/env';
import { DatabaseContext, DrizzleUnitOfWork, InMemoryUnitOfWork, createDatabase, createPool } from './database/database';
import { RandomIdGenerator, SystemClock } from './system';

/**
 * Refuses to start on a database that cannot store Thai text (e.g. a cluster initialised as WIN1252 on Windows):
 * every write with Thai would fail, or worse be stored mangled.
 */
class DatabaseEncodingGuard implements OnModuleInit {
    constructor(@Inject(DatabaseContext) private readonly ctx: DatabaseContext) {}

    async onModuleInit(): Promise<void> {
        const result = await this.ctx.pool.query<{ server_encoding: string }>('show server_encoding');
        const encoding = result.rows[0]?.server_encoding ?? 'unknown';
        if (encoding.toUpperCase() !== 'UTF8') {
            throw new Error(`The database uses encoding ${encoding}; ConTrack needs UTF8 (create the database with ENCODING 'UTF8').`);
        }
    }
}

class DatabaseShutdown implements OnApplicationShutdown {
    constructor(@Optional() @Inject(DatabaseContext) private readonly ctx: DatabaseContext | null) {}

    async onApplicationShutdown(): Promise<void> {
        await this.ctx?.pool.end();
    }
}

export interface CoreOptions {
    env: Env;
    /** Replace the clock / id generator (tests). */
    clock?: Clock;
    ids?: IdGenerator;
}

@Global()
@Module({})
export class CoreModule {
    static forRoot(options: CoreOptions): DynamicModule {
        const config = new AppConfig(options.env);
        const providers: Provider[] = [
            { provide: AppConfig, useValue: config },
            { provide: Clock, useValue: options.clock ?? new SystemClock() },
            { provide: IdGenerator, useValue: options.ids ?? new RandomIdGenerator() },
            { provide: ProjectDependents, useValue: new ProjectDependents() },
            { provide: ModuleWorkRegistry, useValue: new ModuleWorkRegistry() },
            { provide: ApprovalHandlers, useValue: new ApprovalHandlers() },
            { provide: DailySweeps, useValue: new DailySweeps() },
            { provide: ProjectDeletionGuards, useValue: new ProjectDeletionGuards() },
            { provide: WorkspaceDeletionGuards, useValue: new WorkspaceDeletionGuards() },
            { provide: CustomerLinkHandlers, useValue: new CustomerLinkHandlers() },
            { provide: HubRollups, useValue: new HubRollups() },
        ];
        if (config.persistence === 'postgres') {
            const url = options.env.DATABASE_URL;
            if (url === undefined) throw new Error('DATABASE_URL is required when PERSISTENCE=postgres');
            const pool = createPool(url);
            const ctx = new DatabaseContext(createDatabase(pool), pool);
            providers.push(
                { provide: DatabaseContext, useValue: ctx },
                { provide: UnitOfWork, useValue: new DrizzleUnitOfWork(ctx) },
                DatabaseShutdown,
                DatabaseEncodingGuard,
            );
        } else {
            providers.push({ provide: UnitOfWork, useValue: new InMemoryUnitOfWork() });
        }
        return {
            module: CoreModule,
            providers,
            exports: [
                AppConfig, Clock, IdGenerator, UnitOfWork, ProjectDependents, ModuleWorkRegistry, ApprovalHandlers, DailySweeps,
                ProjectDeletionGuards, WorkspaceDeletionGuards, CustomerLinkHandlers, HubRollups,
                ...(config.persistence === 'postgres' ? [DatabaseContext] : []),
            ],
        };
    }
}

/**
 * Picks the adapter of a port by PERSISTENCE: `memory` for tests / trying without a database, `postgres` for real.
 * Usage in a module: `persistence(UserRepository, () => new InMemoryUserRepository(), ctx => new DrizzleUserRepository(ctx))`.
 * Extra dependencies of the adapters can be listed in `inject` and arrive after the database context.
 */
export function persistence<T>(
    port: abstract new (...args: never[]) => T,
    memory: (...deps: never[]) => T,
    postgres: (ctx: DatabaseContext, ...deps: never[]) => T,
    inject: (abstract new (...args: never[]) => unknown)[] = [],
): Provider {
    return {
        provide: port,
        inject: [AppConfig, { token: DatabaseContext, optional: true }, ...inject],
        useFactory: (config: AppConfig, ctx: DatabaseContext | undefined, ...deps: never[]) => {
            if (config.persistence === 'memory') return memory(...deps);
            if (ctx === undefined) throw new Error(`${port.name}: no database configured`);
            return postgres(ctx, ...deps);
        },
    };
}
