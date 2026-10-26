// ─── Bus between several server instances: PostgreSQL LISTEN / NOTIFY on one channel ───
// A dedicated connection LISTENs (reconnected with backoff when it drops); publishing goes through the shared pool.
// Messages missed while the listener is down are lost: presence heals with the next heartbeat, documents with the
// client's next fetch / version check.
import { Logger } from '@nestjs/common';
import { Client, type Notification, type Pool } from 'pg';
import { type BusHandler, type BusMessage, RealtimeBus, type Unsubscribe } from '../../application/ports/realtime-bus.port';
import { errorMessage } from '../../application/services/error-message';
import { NOTIFY_CHANNEL, decodeNotifyPayload, encodeNotifyPayload } from './notify-payload';

export interface PostgresRealtimeBusOptions {
    connectionString: string;
    /** Pool used for `select pg_notify(...)`. */
    pool: Pick<Pool, 'query'>;
    /** First reconnect delay; doubles up to `maxBackoffMs`. */
    minBackoffMs?: number;
    maxBackoffMs?: number;
    /** Replaces the LISTEN client (tests). */
    createClient?: () => Client;
}

export class PostgresRealtimeBus extends RealtimeBus {
    private readonly logger = new Logger(PostgresRealtimeBus.name);
    private readonly handlers = new Set<BusHandler>();
    private readonly minBackoffMs: number;
    private readonly maxBackoffMs: number;
    private client: Client | undefined;
    private reconnectTimer: NodeJS.Timeout | undefined;
    private failures = 0;
    private closed = false;

    constructor(private readonly options: PostgresRealtimeBusOptions) {
        super();
        this.minBackoffMs = options.minBackoffMs ?? 500;
        this.maxBackoffMs = options.maxBackoffMs ?? 30_000;
    }

    /** Opens the LISTEN connection. A failure is logged and retried in the background (start-up is not blocked). */
    async start(): Promise<void> {
        await this.connect();
    }

    async publish(message: BusMessage): Promise<void> {
        if (this.closed) return;
        const payload = encodeNotifyPayload(message);
        if (payload === undefined) {
            this.logger.warn(`Dropped ${message.kind}: too large for a NOTIFY payload`);
            return;
        }
        await this.options.pool.query('select pg_notify($1, $2)', [NOTIFY_CHANNEL, payload]);
    }

    subscribe(handler: BusHandler): Unsubscribe {
        const subscription: BusHandler = message => handler(message);
        this.handlers.add(subscription);
        return () => {
            this.handlers.delete(subscription);
        };
    }

    async close(): Promise<void> {
        this.closed = true;
        this.handlers.clear();
        if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
        const client = this.client;
        this.client = undefined;
        if (client !== undefined) await client.end().catch(() => undefined);
    }

    private async connect(): Promise<void> {
        if (this.closed) return;
        const client = this.options.createClient?.() ?? new Client({ connectionString: this.options.connectionString });
        client.on('notification', notification => {
            this.onNotification(notification);
        });
        client.on('error', error => {
            this.onDrop(client, `error: ${error.message}`);
        });
        client.on('end', () => {
            this.onDrop(client, 'connection ended');
        });
        try {
            await client.connect();
            await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
        } catch (error) {
            this.logger.error(`Realtime bus could not listen: ${errorMessage(error)}`);
            await client.end().catch(() => undefined);
            this.scheduleReconnect();
            return;
        }
        if (this.isClosed()) { // closed while connecting
            await client.end().catch(() => undefined);
            return;
        }
        if (this.failures > 0) this.logger.log('Realtime bus listening again');
        this.failures = 0;
        this.client = client;
    }

    private isClosed(): boolean {
        return this.closed;
    }

    private onDrop(client: Client, reason: string): void {
        if (this.closed || this.client !== client) return; // not the live listener (failed connect, or already replaced)
        this.client = undefined;
        this.logger.warn(`Realtime bus lost its LISTEN connection (${reason}); reconnecting`);
        void client.end().catch(() => undefined);
        this.scheduleReconnect();
    }

    private scheduleReconnect(): void {
        if (this.closed || this.reconnectTimer !== undefined) return;
        const delay = Math.min(this.maxBackoffMs, this.minBackoffMs * 2 ** this.failures);
        this.failures += 1;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            void this.connect();
        }, delay);
        this.reconnectTimer.unref();
    }

    private onNotification(notification: Notification): void {
        if (notification.channel !== NOTIFY_CHANNEL || notification.payload === undefined) return;
        const message = decodeNotifyPayload(notification.payload);
        if (message === undefined) {
            this.logger.warn('Ignored an invalid realtime bus payload');
            return;
        }
        for (const handler of this.handlers) {
            void Promise.resolve()
                .then(() => handler(message))
                .catch((error: unknown) => {
                    this.logger.error(`A realtime bus subscriber failed on ${message.kind}: ${errorMessage(error)}`);
                });
        }
    }
}
