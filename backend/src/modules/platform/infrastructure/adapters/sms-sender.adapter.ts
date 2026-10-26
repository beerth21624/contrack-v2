// ─── SMS adapters: console (development: the server log shows the text, OTP codes included) and ThaiBulkSMS ───
import { Logger } from '@nestjs/common';
import { SmsSender } from '../../application/ports/sms-sender.port';

export class ConsoleSmsSender extends SmsSender {
    private readonly logger = new Logger('Sms');

    send(phone: string, text: string): Promise<void> {
        this.logger.log(`SMS to ${phone}: ${text}`);
        return Promise.resolve();
    }
}

export const THAIBULKSMS_URL = 'https://api-v2.thaibulksms.com/sms';

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) =>
    Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** ThaiBulkSMS wants Thai numbers as 0XXXXXXXXX; other countries without the '+'. */
export function toThaiBulkSmsMsisdn(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, '');
    if (digits.startsWith('+66')) return `0${digits.slice(3)}`;
    return digits.replace(/^\+/, '');
}

/** ThaiBulkSMS API v2: POST form (msisdn, message, sender) with basic auth `key:secret`. Throws on any non-2xx answer. */
export class ThaiBulkSmsSender extends SmsSender {
    constructor(
        private readonly apiKey: string,
        private readonly apiSecret: string,
        private readonly sender: string | undefined,
        private readonly fetchFn: FetchLike = (url, init) => fetch(url, init),
        private readonly timeoutMs = 10_000,
    ) {
        super();
    }

    async send(phone: string, text: string): Promise<void> {
        const form = new URLSearchParams({ msisdn: toThaiBulkSmsMsisdn(phone), message: text });
        if (this.sender !== undefined && this.sender !== '') form.set('sender', this.sender);
        const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
        const res = await this.fetchFn(THAIBULKSMS_URL, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: form.toString(),
            signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!res.ok) {
            const detail = (await res.text().catch(() => '')).slice(0, 200);
            throw new Error(`ThaiBulkSMS answered ${res.status}${detail === '' ? '' : `: ${detail}`}`);
        }
    }
}
