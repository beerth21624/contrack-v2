// ─── Runs the sourcing sweep every 5 minutes (not under NODE_ENV=test: specs call the use case directly; not at all
// when the platform does not offer subcontracting) ───
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ModuleFlags } from '../../../../../shared/application/ports';
import { AppConfig } from '../../../../../shared/infrastructure/config/env';
import { MODULE } from '../../../shared/sc-access';
import { RunSourcingSweepUseCase } from '../../application/use-cases/run-sourcing-sweep.use-case';

export const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class SourcingSweepRunner implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger('SourcingSweep');
    private timer: NodeJS.Timeout | undefined;
    private running = false;

    constructor(private readonly sweep: RunSourcingSweepUseCase, private readonly config: AppConfig, private readonly flags: ModuleFlags) {}

    /** True when the timer was started (not under test, and only when the platform offers the module). */
    get started(): boolean {
        return this.timer !== undefined;
    }

    onApplicationBootstrap(): void {
        if (this.config.env.NODE_ENV === 'test') return;
        if (!this.flags.platformEnabled(MODULE)) {
            this.logger.log('subcontracting is not offered by the platform: sweep not started');
            return;
        }
        this.timer = setInterval(() => void this.tick(), SWEEP_INTERVAL_MS);
        this.timer.unref();
    }

    onApplicationShutdown(): void {
        if (this.timer !== undefined) clearInterval(this.timer);
        this.timer = undefined;
    }

    /** One pass; overlapping passes are skipped, failures are logged (the next pass retries). */
    async tick(): Promise<void> {
        if (this.running) return;
        this.running = true;
        try {
            const res = await this.sweep.execute();
            if (res.reminded + res.settled > 0) this.logger.log(`reminded ${res.reminded}, settled ${res.settled}`);
        } catch (e: unknown) {
            this.logger.error(e instanceof Error ? e.stack ?? e.message : String(e));
        } finally {
            this.running = false;
        }
    }
}
