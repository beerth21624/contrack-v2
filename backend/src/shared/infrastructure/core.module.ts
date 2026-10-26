// ─── Global infrastructure: config, clock, ids, database, unit of work ───
import { Global, Module, type DynamicModule, type OnApplicationShutdown, type Provider, Inject, Optional } from '@nestjs/common';
import { Clock, IdGenerator, UnitOfWork } from '../application/ports';
import { AppConfig, type Env } from './config/env';
import { DatabaseContext, DrizzleUnitOfWork, InMemoryUnitOfWork, createDatabase, createPool } from './database/database';
import { RandomIdGenerator, SystemClock } from './system';

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
            );
        } else {
            providers.push({ provide: UnitOfWork, useValue: new InMemoryUnitOfWork() });
        }
        return {
            module: CoreModule,
            providers,
            exports: [AppConfig, Clock, IdGenerator, UnitOfWork, ...(config.persistence === 'postgres' ? [DatabaseContext] : [])],
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
