// ─── Test doubles for the realtime specs (not used by the application) ───
import type { ServerToClientEvents } from '@contrack/contract';
import { Broadcaster } from '../application/ports/broadcaster.port';
import { IntervalScheduler, type ScheduledTask } from '../application/ports/interval-scheduler.port';

export interface Emitted {
    room: string;
    event: keyof ServerToClientEvents;
    payload: unknown;
}

/** Records every emit instead of sending it. */
export class RecordingBroadcaster extends Broadcaster {
    readonly emitted: Emitted[] = [];

    emit<E extends keyof ServerToClientEvents>(room: string, event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
        this.emitted.push({ room, event, payload: args[0] });
    }

    of(event: keyof ServerToClientEvents): Emitted[] {
        return this.emitted.filter(e => e.event === event);
    }

    last(event: keyof ServerToClientEvents): Emitted | undefined {
        return this.of(event).at(-1);
    }

    clear(): void {
        this.emitted.length = 0;
    }
}

/** Runs the scheduled tasks only when the test calls tick(). */
export class ManualScheduler extends IntervalScheduler {
    private readonly tasks = new Set<() => void>();

    every(_ms: number, task: () => void): ScheduledTask {
        this.tasks.add(task);
        return { cancel: () => { this.tasks.delete(task); } };
    }

    get scheduled(): number {
        return this.tasks.size;
    }

    tick(): void {
        for (const task of this.tasks) task();
    }
}
