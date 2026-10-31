// ─── NotificationChannels over the existing senders: SMS (SmsSender) and LINE (LineSender); no e-mail channel yet ───
import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import type { LineSender } from '../../application/ports/line-sender.port';
import { type NotificationChannel, NotificationChannels } from '../../application/ports/notification-channel.port';
import type { SmsSender } from '../../application/ports/sms-sender.port';

async function attempt(send: () => Promise<void>): Promise<Result<void, DomainError>> {
    try {
        await send();
        return okVoid();
    } catch (error: unknown) {
        return err(DomainError.unprocessable(error instanceof Error ? error.message : String(error)));
    }
}

export class SenderNotificationChannels extends NotificationChannels {
    private readonly channels: Map<NotificationChannel['id'], NotificationChannel>;

    constructor(sms: SmsSender, line: LineSender) {
        super();
        const smsChannel: NotificationChannel = {
            id: 'sms',
            enabled: true,
            send: (to, text) => attempt(() => sms.send(to, text)),
        };
        const lineChannel: NotificationChannel = {
            id: 'line',
            get enabled(): boolean { return line.enabled; },
            send: (to, text) => attempt(() => line.push(to, text)),
        };
        this.channels = new Map([['sms', smsChannel], ['line', lineChannel]]);
    }

    get(id: NotificationChannel['id']): NotificationChannel | undefined {
        return this.channels.get(id);
    }
}
