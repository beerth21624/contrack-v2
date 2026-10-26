// ─── Background sender of the notification outbox (SMS / LINE): every 15 s and right after a notification is queued ───
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { AppConfig } from '../../../../shared/infrastructure/config/env';
import { DELIVERY_BATCH_SIZE, DeliverQueuedUseCase } from '../../application/use-cases/deliver-queued.use-case';

export const DELIVERY_INTERVAL_MS = 15_000;
/** Batches per run at most (a backlog drains over several runs). */
const MAX_BATCHES_PER_RUN = 10;

@Injectable()
export class DeliveryWorker implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger('DeliveryWorker');
    private timer: NodeJS.Timeout | undefined;
    private running: Promise<void> | undefined;
    private again = false;
    private stopped = false;

    constructor(private readonly deliver: DeliverQueuedUseCase, private readonly config: AppConfig) {}

    /** Off under NODE_ENV=test: tests call `runOnce()` themselves. */
    private get automatic(): boolean {
        return this.config.env.NODE_ENV !== 'test';
    }

    onApplicationBootstrap(): void {
        if (!this.automatic) return;
        this.timer = setInterval(() => { this.kick(); }, DELIVERY_INTERVAL_MS);
        this.timer.unref();
    }

    async onApplicationShutdown(): Promise<void> {
        this.stopped = true;
        if (this.timer !== undefined) clearInterval(this.timer);
        await this.running;
    }

    /** Asks for a run soon (no-op under NODE_ENV=test). */
    kick(): void {
        if (!this.automatic || this.stopped) return;
        setImmediate(() => { void this.runOnce(); });
    }

    /** Sends what is queued now; a call while a run is going schedules one more run after it. */
    runOnce(): Promise<void> {
        if (this.running !== undefined) {
            this.again = true;
            return this.running;
        }
        this.running = this.drain().finally(() => {
            this.running = undefined;
            if (this.again && !this.stopped) {
                this.again = false;
                void this.runOnce();
            }
        });
        return this.running;
    }

    private async drain(): Promise<void> {
        try {
            for (let i = 0; i < MAX_BATCHES_PER_RUN && !this.stopped; i += 1) {
                const result = await this.deliver.execute(DELIVERY_BATCH_SIZE);
                if (!result.ok) return;
                const { sent, retrying, failed } = result.value;
                if (sent + retrying + failed < DELIVERY_BATCH_SIZE) return;
            }
        } catch (error: unknown) {
            this.logger.error(`delivery run failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
        }
    }
}
