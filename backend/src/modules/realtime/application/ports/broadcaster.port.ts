// ─── Emits a server → client event to the sockets of this instance that are in a room ───
import type { ServerToClientEvents } from '@contrack/contract';

export abstract class Broadcaster {
    abstract emit<E extends keyof ServerToClientEvents>(room: string, event: E, ...args: Parameters<ServerToClientEvents[E]>): void;
}
