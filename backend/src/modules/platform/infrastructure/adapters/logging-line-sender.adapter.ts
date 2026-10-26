// ─── LINE delivery (stub): enabled when LINE_CHANNEL_ACCESS_TOKEN is set; logs instead of calling the Messaging API ───
import { Logger } from '@nestjs/common';
import { LineSender } from '../../application/ports/line-sender.port';

/**
 * TODO(LINE): push through https://api.line.me/v2/bot/message/push with the channel token once users can link their
 * LINE account (RecipientDirectory then returns their LINE user id; until then no LINE deliveries are queued).
 */
export class LoggingLineSender extends LineSender {
    private readonly logger = new Logger('Line');

    constructor(private readonly channelToken: string | undefined) {
        super();
    }

    get enabled(): boolean {
        return this.channelToken !== undefined && this.channelToken !== '';
    }

    push(lineUserId: string, text: string): Promise<void> {
        this.logger.log(`LINE to ${lineUserId}: ${text}`);
        return Promise.resolve();
    }
}
