// ─── Runs the registered daily sweeps (DailySweeps, core) every 6 hours, the first time 60 s after start ───
// Same pattern as RetentionDueSweep: no timers under NODE_ENV=test (tests call runOnce). Each sweep is isolated: one
// that throws is logged and the others still run. Sweeps dedupe their notices with SweepMarks (once per key per day).
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { Clock, DailySweeps } from '../../../../shared/application/ports';
import { AppConfig } from '../../../../shared/infrastructure/config/env';

const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_SWEEP_AFTER_MS = 60 * 1000;

@Injectable()
export class DailySweepsRunner implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger('DailySweeps');
    private timers: NodeJS.Timeout[] = [];
    private running: Promise<void> | undefined;

    constructor(private readonly sweeps: DailySweeps, private readonly clock: Clock, private readonly config: AppConfig) {}

    /** Whether the timers run (exposed for specs). */
    get started(): boolean {
        return this.timers.length > 0;
    }

    // After every module's onModuleInit, so every sweep is registered.
    onApplicationBootstrap(): void {
        if (this.config.env.NODE_ENV === 'test') return;
        const run = (): void => { void this.runOnce(); };
        const first = setTimeout(run, FIRST_SWEEP_AFTER_MS);
        const every = setInterval(run, SWEEP_EVERY_MS);
        first.unref();
        every.unref();
        this.timers = [first, every];
    }

    async onApplicationShutdown(): Promise<void> {
        for (const t of this.timers) clearTimeout(t);
        this.timers = [];
        await this.running;
    }

    /** Runs every sweep once (a call while a run is going waits for that run). */
    runOnce(): Promise<void> {
        this.running ??= this.runAll().finally(() => { this.running = undefined; });
        return this.running;
    }

    private async runAll(): Promise<void> {
        const now = this.clock.now();
        const ctx = { now, today: bangkokToday(now) };
        for (const [name, sweep] of this.sweeps.entries()) {
            try {
                await sweep(ctx);
            } catch (error: unknown) {
                this.logger.error(`sweep ${name} failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
            }
        }
    }
}
