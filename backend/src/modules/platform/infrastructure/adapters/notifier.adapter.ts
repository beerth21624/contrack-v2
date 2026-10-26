// ─── Shared ports Notifier (queue messages) and AppLinks (absolute links into the web app) ───
import { Injectable, Logger } from '@nestjs/common';
import { AppLinks, type NotificationRequest, Notifier } from '../../../../shared/application/ports';
import { SendNotificationUseCase } from '../../application/use-cases/send-notification.use-case';
import { DeliveryWorker } from './delivery-worker';

/**
 * Writes the notifications and queues the outside deliveries, then wakes the delivery worker. Called after the
 * caller's transaction committed: a failure here is logged and never undoes (or fails) the business change.
 */
@Injectable()
export class UseCaseNotifier extends Notifier {
    private readonly logger = new Logger('Notifier');

    constructor(private readonly send: SendNotificationUseCase, private readonly worker: DeliveryWorker) {
        super();
    }

    async notify(request: NotificationRequest): Promise<void> {
        try {
            const result = await this.send.execute(request);
            if (result.ok && result.value.deliveries > 0) this.worker.kick();
        } catch (error: unknown) {
            this.logger.error(`${request.template} not sent: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
        }
    }
}

/** `PUBLIC_APP_URL + path`; an absolute URL is returned as it is. */
export class ConfigAppLinks extends AppLinks {
    private readonly base: string;

    constructor(publicAppUrl: string) {
        super();
        this.base = publicAppUrl.replace(/\/+$/, '');
    }

    url(path: string): string {
        if (/^https?:\/\//i.test(path)) return path;
        return `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
    }
}
