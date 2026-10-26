// ─── SmsSender for tests and NODE_ENV=test apps: records every message (e2e tests read OTP codes from here) ───
import { SmsSender } from '../application/ports/sms-sender.port';

export interface RecordedSms {
    phone: string;
    text: string;
}

export class RecordingSmsSender extends SmsSender {
    readonly sent: RecordedSms[] = [];
    /** The next `send` calls throw this many times (to test retries). */
    failures = 0;

    send(phone: string, text: string): Promise<void> {
        if (this.failures > 0) {
            this.failures -= 1;
            return Promise.reject(new Error('SMS provider unavailable'));
        }
        this.sent.push({ phone, text });
        return Promise.resolve();
    }

    /** The last message sent to `phone`, if any. */
    lastTo(phone: string): RecordedSms | undefined {
        for (let i = this.sent.length - 1; i >= 0; i -= 1) {
            const sms = this.sent[i];
            if (sms?.phone === phone) return sms;
        }
        return undefined;
    }

    clear(): void {
        this.sent.length = 0;
    }
}
