import { Logger } from '@nestjs/common';
import { AppConfig, testEnv } from '../../../../shared/infrastructure/config/env';
import { DeliverQueuedUseCase } from '../../application/use-cases/deliver-queued.use-case';
import { SendNotificationUseCase } from '../../application/use-cases/send-notification.use-case';
import { PlatformTestKit, RecordingLineSender } from '../../testing/platform-test-kit';
import { DeliveryWorker } from './delivery-worker';
import { LoggingLineSender } from './logging-line-sender.adapter';
import { ConfigAppLinks, UseCaseNotifier } from './notifier.adapter';

describe('UseCaseNotifier + DeliveryWorker', () => {
    let kit: PlatformTestKit;
    let worker: DeliveryWorker;
    let notifier: UseCaseNotifier;
    let send: SendNotificationUseCase;

    beforeEach(() => {
        kit = new PlatformTestKit();
        const line = new RecordingLineSender(false);
        send = new SendNotificationUseCase(kit.recipients, kit.notifications, kit.deliveries, line, kit.appLinks, kit.uow, kit.clock, kit.ids);
        worker = new DeliveryWorker(new DeliverQueuedUseCase(kit.deliveries, kit.sms, line, kit.clock), new AppConfig(testEnv()));
        notifier = new UseCaseNotifier(send, worker);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('queues, and the worker run sends (no automatic runs under NODE_ENV=test)', async () => {
        await notifier.notify({ template: 'sc.invitation', toPhone: '+66812345678', payload: { buyerName: 'ก', title: 'ข', deadline: 'ค', url: 'https://a/s/t' } });
        worker.onApplicationBootstrap();
        worker.kick();
        await new Promise(resolve => setImmediate(resolve));
        expect(kit.sms.sent).toEqual([]);
        await worker.runOnce();
        expect(kit.sms.sent).toHaveLength(1);
        expect(kit.sms.sent[0]?.text.endsWith('https://a/s/t')).toBe(true);
        await worker.onApplicationShutdown();
    });

    it('a failure is logged, never thrown at the caller', async () => {
        jest.spyOn(send, 'execute').mockRejectedValue(new Error('db down'));
        const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        await expect(notifier.notify({ template: 'sc.message', toUserIds: [], payload: {} })).resolves.toBeUndefined();
        expect(error).toHaveBeenCalledWith(expect.stringContaining('sc.message not sent'));
    });

    it('overlapping runs are folded into one more run', async () => {
        const a = worker.runOnce();
        const b = worker.runOnce();
        await Promise.all([a, b]);
        await worker.runOnce();
        expect(kit.sms.sent).toEqual([]);
    });
});

describe('ConfigAppLinks', () => {
    it('joins PUBLIC_APP_URL and the path', () => {
        const links = new ConfigAppLinks('https://app.contrack.co.th/');
        expect(links.url('/s/abc')).toBe('https://app.contrack.co.th/s/abc');
        expect(links.url('vendor')).toBe('https://app.contrack.co.th/vendor');
        expect(links.url('https://elsewhere/x')).toBe('https://elsewhere/x');
    });
});

describe('LoggingLineSender', () => {
    it('is enabled only with a channel token and logs pushes', async () => {
        const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        expect(new LoggingLineSender(undefined).enabled).toBe(false);
        expect(new LoggingLineSender('').enabled).toBe(false);
        const line = new LoggingLineSender('token');
        expect(line.enabled).toBe(true);
        await line.push('U1', 'สวัสดี');
        expect(log).toHaveBeenCalledWith('LINE to U1: สวัสดี');
        log.mockRestore();
    });
});
