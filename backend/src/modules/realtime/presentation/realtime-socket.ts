// ─── Typed Socket.IO sockets / namespace of the realtime gateway ───
import type { DefaultEventsMap, Namespace, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@contrack/contract';
import type { ProjectId, UserId } from '../../../shared/domain/ids';

/** Set by the gateway: who the socket is and when its access to each joined project was last checked. */
export interface RealtimeSocketData {
    userId?: UserId;
    displayName?: string;
    /** ms since epoch of the last access check, per joined project. */
    checkedAt?: Map<ProjectId, number>;
}

export type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, RealtimeSocketData>;
export type RealtimeNamespace = Namespace<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, RealtimeSocketData>;
