// ─── Repeating timer (the presence sweeper); tests drive it by hand ───

export interface ScheduledTask {
    cancel(): void;
}

export abstract class IntervalScheduler {
    abstract every(ms: number, task: () => void): ScheduledTask;
}
