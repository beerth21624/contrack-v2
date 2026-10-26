// ─── NotificationDelivery: one queued message on an outside channel (SMS, LINE, e-mail) ───
import type { DeliveryId, NotificationId } from '../platform-ids';

export type DeliveryChannel = 'sms' | 'line' | 'email';
export type DeliveryStatus = 'queued' | 'sent' | 'failed';

/** Tries per delivery before it is given up (status failed). */
export const MAX_DELIVERY_ATTEMPTS = 3;

/** Absolute links (http/https, any host) in a message. */
const LINK = /\bhttps?:\/\/\S+/gi;

/**
 * The text with every link replaced by `[link]`: what is kept of a message once it left (sent or given up). Links
 * carry invitation tokens that sign a stranger into a tender; the outbox is no place to keep them.
 */
export function redactLinks(text: string): string {
    return text.replace(LINK, '[link]');
}

export interface NotificationDeliveryProps {
    id: DeliveryId;
    notificationId: NotificationId | null;
    channel: DeliveryChannel;
    /** Phone (E.164) for SMS, LINE user id, e-mail address. */
    toAddress: string;
    body: string;
    status: DeliveryStatus;
    attempts: number;
    lastError: string | null;
    createdAt: Date;
    sentAt: Date | null;
}

export class NotificationDelivery {
    private constructor(private props: NotificationDeliveryProps) {}

    static queue(input: { id: DeliveryId; notificationId: NotificationId | null; channel: DeliveryChannel; toAddress: string; body: string; now: Date }): NotificationDelivery {
        return new NotificationDelivery({
            id: input.id,
            notificationId: input.notificationId,
            channel: input.channel,
            toAddress: input.toAddress,
            body: input.body,
            status: 'queued',
            attempts: 0,
            lastError: null,
            createdAt: new Date(input.now.getTime()),
            sentAt: null,
        });
    }

    static rehydrate(props: NotificationDeliveryProps): NotificationDelivery {
        return new NotificationDelivery({ ...props });
    }

    get id(): DeliveryId {
        return this.props.id;
    }

    get channel(): DeliveryChannel {
        return this.props.channel;
    }

    get toAddress(): string {
        return this.props.toAddress;
    }

    get body(): string {
        return this.props.body;
    }

    get status(): DeliveryStatus {
        return this.props.status;
    }

    get attempts(): number {
        return this.props.attempts;
    }

    get lastError(): string | null {
        return this.props.lastError;
    }

    /** Sent: the stored body keeps no link (invitation links are bearer secrets). */
    markSent(now: Date): void {
        this.props = {
            ...this.props,
            status: 'sent',
            attempts: this.props.attempts + 1,
            lastError: null,
            sentAt: new Date(now.getTime()),
            body: redactLinks(this.props.body),
        };
    }

    /** Stays queued for another try until MAX_DELIVERY_ATTEMPTS, then failed (and its stored body loses its links). */
    markAttemptFailed(error: string): void {
        const attempts = this.props.attempts + 1;
        const failed = attempts >= MAX_DELIVERY_ATTEMPTS;
        this.props = {
            ...this.props,
            attempts,
            lastError: redactLinks(error).slice(0, 500),
            status: failed ? 'failed' : 'queued',
            body: failed ? redactLinks(this.props.body) : this.props.body,
        };
    }

    toProps(): NotificationDeliveryProps {
        return {
            ...this.props,
            createdAt: new Date(this.props.createdAt.getTime()),
            sentAt: this.props.sentAt === null ? null : new Date(this.props.sentAt.getTime()),
        };
    }
}
