// ─── Realtime (collaboration level 2): live project events, presence, bus between server instances ───
// Depends only on shared ports (AccessTokenVerifier, WorkspaceAccess, ProjectDirectory, ProjectDocLookup,
// UserDirectory, Clock) which the other modules provide globally — never imports ProjectsModule (no cycle).
import { randomUUID } from 'node:crypto';
import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { RealtimePublisher } from '../../shared/application/ports';
import { Broadcaster } from './application/ports/broadcaster.port';
import { IntervalScheduler } from './application/ports/interval-scheduler.port';
import { RealtimeBus } from './application/ports/realtime-bus.port';
import { RealtimeInstance } from './application/ports/realtime-instance.port';
import { PresenceService } from './application/services/presence.service';
import { ProjectViewAccess } from './application/services/project-view-access.service';
import { RealtimeService } from './application/services/realtime.service';
import { NodeIntervalScheduler } from './infrastructure/adapters/node-interval-scheduler.adapter';
import { realtimeBusProvider } from './infrastructure/realtime-bus.provider';
import { RealtimeGateway } from './presentation/realtime.gateway';
import { SocketIoBroadcaster } from './presentation/socket-io.broadcaster';

@Global()
@Module({
    providers: [
        { provide: RealtimeInstance, useFactory: () => new RealtimeInstance(randomUUID()) },
        realtimeBusProvider,
        { provide: IntervalScheduler, useClass: NodeIntervalScheduler },
        SocketIoBroadcaster,
        { provide: Broadcaster, useExisting: SocketIoBroadcaster },
        RealtimeService,
        { provide: RealtimePublisher, useExisting: RealtimeService },
        PresenceService,
        ProjectViewAccess,
        RealtimeGateway,
    ],
    exports: [RealtimePublisher],
})
export class RealtimeModule implements OnApplicationShutdown {
    constructor(private readonly bus: RealtimeBus) {}

    async onApplicationShutdown(): Promise<void> {
        await this.bus.close();
    }
}
