// ─── Broadcaster over the gateway's Socket.IO namespace ───
// A separate provider (not the gateway itself) so the services can depend on it while the gateway depends on the
// services: the gateway attaches its namespace in afterInit. Emits before that (no socket yet) are dropped.
import { Injectable } from '@nestjs/common';
import type { ServerToClientEvents } from '@contrack/contract';
import { Broadcaster } from '../application/ports/broadcaster.port';
import type { RealtimeNamespace } from './realtime-socket';

@Injectable()
export class SocketIoBroadcaster extends Broadcaster {
    private namespace: RealtimeNamespace | undefined;

    attach(namespace: RealtimeNamespace): void {
        this.namespace = namespace;
    }

    emit<E extends keyof ServerToClientEvents>(room: string, event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
        this.namespace?.to(room).emit(event, ...args);
    }
}
