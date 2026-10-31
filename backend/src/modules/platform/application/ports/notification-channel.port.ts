// ─── Outside delivery channels of notifications (docs/erp/01-architecture.md §7 item 3): SMS, LINE, later e-mail ───
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { Result } from '../../../../shared/domain/result';

export interface NotificationChannel {
    readonly id: 'sms' | 'line' | 'email';
    /** False when the channel is not configured: nothing is queued for it. */
    readonly enabled: boolean;
    /** Sends one message now; an error is recorded on the delivery and retried. */
    send(toAddress: string, text: string): Promise<Result<void, DomainError>>;
}

/** The configured channels (undefined = no such channel, e.g. e-mail for now). */
export abstract class NotificationChannels {
    abstract get(id: NotificationChannel['id']): NotificationChannel | undefined;
}
