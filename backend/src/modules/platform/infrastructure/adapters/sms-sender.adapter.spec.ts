import { Logger } from '@nestjs/common';
import { RecordingSmsSender } from '../../testing/recording-sms-sender';
import { ConsoleSmsSender, type FetchLike, THAIBULKSMS_URL, ThaiBulkSmsSender, toThaiBulkSmsMsisdn } from './sms-sender.adapter';

describe('SMS senders', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('ConsoleSmsSender', () => {
        it('prints the phone and the text to the server log', async () => {
            const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
            await new ConsoleSmsSender().send('+66812345678', 'รหัส OTP ของคุณคือ 123456');
            expect(log).toHaveBeenCalledWith('SMS to +66812345678: รหัส OTP ของคุณคือ 123456');
        });
    });

    describe('ThaiBulkSmsSender', () => {
        function fakeFetch(status = 201, answer = '{}'): { fn: FetchLike; calls: Parameters<FetchLike>[] } {
            const calls: Parameters<FetchLike>[] = [];
            const fn: FetchLike = (url, init) => {
                calls.push([url, init]);
                return Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(answer) });
            };
            return { fn, calls };
        }

        it('posts msisdn, message and sender as a form with basic auth key:secret', async () => {
            const { fn, calls } = fakeFetch();
            await new ThaiBulkSmsSender('key', 'secret', 'ConTrack', fn).send('+66812345678', 'สวัสดี');
            expect(calls).toHaveLength(1);
            const [url, init] = calls[0]!;
            expect(url).toBe(THAIBULKSMS_URL);
            expect(init.method).toBe('POST');
            expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('key:secret').toString('base64')}`);
            expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
            const form = new URLSearchParams(init.body);
            expect(form.get('msisdn')).toBe('0812345678');
            expect(form.get('message')).toBe('สวัสดี');
            expect(form.get('sender')).toBe('ConTrack');
        });

        it('leaves the sender out when none is configured', async () => {
            const { fn, calls } = fakeFetch();
            await new ThaiBulkSmsSender('key', 'secret', undefined, fn).send('+66812345678', 'x');
            expect(new URLSearchParams(calls[0]![1].body).has('sender')).toBe(false);
        });

        it('throws with the status and answer when the provider refuses', async () => {
            const { fn } = fakeFetch(401, '{"error":{"name":"UNAUTHORIZED"}}');
            await expect(new ThaiBulkSmsSender('key', 'bad', undefined, fn).send('+66812345678', 'x')).rejects.toThrow(/401.*UNAUTHORIZED/);
        });

        it('turns E.164 into the provider\'s number format', () => {
            expect(toThaiBulkSmsMsisdn('+66812345678')).toBe('0812345678');
            expect(toThaiBulkSmsMsisdn('+66 81-234-5678')).toBe('0812345678');
            expect(toThaiBulkSmsMsisdn('+6591234567')).toBe('6591234567');
            expect(toThaiBulkSmsMsisdn('0812345678')).toBe('0812345678');
        });
    });

    describe('RecordingSmsSender', () => {
        it('records messages, can fail on purpose, finds the last one to a phone', async () => {
            const sms = new RecordingSmsSender();
            await sms.send('+1', 'a');
            await sms.send('+2', 'b');
            await sms.send('+1', 'c');
            expect(sms.lastTo('+1')?.text).toBe('c');
            expect(sms.lastTo('+3')).toBeUndefined();
            sms.failures = 1;
            await expect(sms.send('+1', 'd')).rejects.toThrow();
            expect(sms.sent).toHaveLength(3);
            sms.clear();
            expect(sms.sent).toEqual([]);
        });
    });
});
