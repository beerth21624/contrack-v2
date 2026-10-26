// ─── Bus inside one process: a single server instance, unit tests, e2e (several services may share one bus) ───
import { Logger } from '@nestjs/common';
import { type BusHandler, type BusMessage, RealtimeBus, type Unsubscribe } from '../../application/ports/realtime-bus.port';
import { errorMessage } from '../../application/services/error-message';

export class InMemoryRealtimeBus extends RealtimeBus {
    private readonly logger = new Logger(InMemoryRealtimeBus.name);
    private readonly handlers = new Set<BusHandler>();
    private closed = false;

    /** Delivers to every subscriber (each gets its own copy, as over a real transport) and waits for them. */
    async publish(message: BusMessage): Promise<void> {
        if (this.closed) return;
        await Promise.all([...this.handlers].map(async handler => {
            try {
                await handler(structuredClone(message));
            } catch (error) {
                this.logger.error(`A realtime bus subscriber failed on ${message.kind}: ${errorMessage(error)}`);
            }
        }));
    }

    subscribe(handler: BusHandler): Unsubscribe {
        // Wrapped so the same function can subscribe twice and be removed once per subscription.
        const subscription: BusHandler = message => handler(message);
        this.handlers.add(subscription);
        return () => {
            this.handlers.delete(subscription);
        };
    }

    close(): Promise<void> {
        this.closed = true;
        this.handlers.clear();
        return Promise.resolve();
    }
}
