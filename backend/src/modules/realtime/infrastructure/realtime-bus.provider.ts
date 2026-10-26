// ─── Picks the realtime bus by REALTIME_BUS: memory (one instance) or postgres (LISTEN/NOTIFY, several instances) ───
import type { Provider } from '@nestjs/common';
import { AppConfig } from '../../../shared/infrastructure/config/env';
import { DatabaseContext } from '../../../shared/infrastructure/database/database';
import { RealtimeBus } from '../application/ports/realtime-bus.port';
import { InMemoryRealtimeBus } from './adapters/in-memory-realtime-bus.adapter';
import { PostgresRealtimeBus } from './adapters/postgres-realtime-bus.adapter';

export async function createRealtimeBus(config: AppConfig, ctx: DatabaseContext | undefined): Promise<RealtimeBus> {
    if (config.env.REALTIME_BUS === 'memory') return new InMemoryRealtimeBus();
    const connectionString = config.env.DATABASE_URL;
    if (ctx === undefined || connectionString === undefined) {
        throw new Error('REALTIME_BUS=postgres needs PERSISTENCE=postgres and DATABASE_URL');
    }
    const bus = new PostgresRealtimeBus({ connectionString, pool: ctx.pool });
    await bus.start();
    return bus;
}

export const realtimeBusProvider: Provider = {
    provide: RealtimeBus,
    inject: [AppConfig, { token: DatabaseContext, optional: true }],
    useFactory: createRealtimeBus,
};
