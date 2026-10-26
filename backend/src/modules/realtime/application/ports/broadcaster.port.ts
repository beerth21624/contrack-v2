// ─── Room operations on the sockets of this instance: emit a server → client event, empty a room ───
import type { ServerToClientEvents } from '@contrack/contract';

export abstract class Broadcaster {
    abstract emit<E extends keyof ServerToClientEvents>(room: string, event: E, ...args: Parameters<ServerToClientEvents[E]>): void;
    /** Makes every socket of this instance leave the room (e.g. the project was deleted). */
    abstract clearRoom(room: string): void;
}
