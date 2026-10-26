import { Logger } from '@nestjs/common';
import { MAX_DELIVERY_ATTEMPTS, NotificationDelivery } from '../../domain/entities/notification-delivery.entity';
import { asDeliveryId } from '../../domain/platform-ids';
import { PlatformTestKit, RecordingLineSender, valueOf } from '../../testing/platform-test-kit';
import { DeliverQueuedUseCase } from './deliver-queued.use-case';

describe('DeliverQueuedUseCase', () => {
    let kit: PlatformTestKit;
    let line: RecordingLineSender;
    let useCase: DeliverQueuedUseCase;

    afterEach(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        kit = new PlatformTestKit();
        line = new RecordingLineSender(true);
        useCase = new DeliverQueuedUseCase(kit.deliveries, kit.sms, line, kit.clock);
    });

    async function queue(channel: 'sms' | 'line' | 'email', to: string, body: string): Promise<void> {
        await kit.deliveries.insertMany([NotificationDelivery.queue({
            id: asDeliveryId(kit.ids.newId()), notificationId: null, channel, toAddress: to, body, now: kit.clock.now(),
        })]);
        kit.clock.advance(1);
    }

    it('sends queued SMS and LINE messages oldest first and marks them sent', async () => {
        await queue('sms', '+66811111111', 'หนึ่ง');
        await queue('line', 'U1', 'สอง');
        await queue('sms', '+66822222222', 'สาม');
        expect(valueOf(await useCase.execute())).toEqual({ sent: 3, retrying: 0, failed: 0 });
        expect(kit.sms.sent).toEqual([{ phone: '+66811111111', text: 'หนึ่ง' }, { phone: '+66822222222', text: 'สาม' }]);
        expect(line.pushed).toEqual([{ to: 'U1', text: 'สอง' }]);
        expect(kit.deliveries.all().every(d => d.status === 'sent' && d.attempts === 1)).toBe(true);
        expect(valueOf(await useCase.execute())).toEqual({ sent: 0, retrying: 0, failed: 0 });
    });

    it('a failed send stays queued with the error, and is given up after 3 tries', async () => {
        await queue('sms', '+66811111111', 'x');
        kit.sms.failures = MAX_DELIVERY_ATTEMPTS;
        expect(valueOf(await useCase.execute())).toEqual({ sent: 0, retrying: 1, failed: 0 });
        expect(kit.deliveries.all()[0]?.toProps()).toMatchObject({ status: 'queued', attempts: 1, lastError: 'SMS provider unavailable' });
        expect(valueOf(await useCase.execute())).toEqual({ sent: 0, retrying: 1, failed: 0 });
        expect(valueOf(await useCase.execute())).toEqual({ sent: 0, retrying: 0, failed: 1 });
        expect(kit.deliveries.all()[0]?.toProps()).toMatchObject({ status: 'failed', attempts: 3 });
        expect(valueOf(await useCase.execute())).toEqual({ sent: 0, retrying: 0, failed: 0 });
        expect(kit.sms.sent).toEqual([]);
    });

    it('a send that works on the second try is sent', async () => {
        await queue('sms', '+66811111111', 'x');
        kit.sms.failures = 1;
        valueOf(await useCase.execute());
        expect(valueOf(await useCase.execute())).toEqual({ sent: 1, retrying: 0, failed: 0 });
        expect(kit.deliveries.all()[0]?.toProps()).toMatchObject({ status: 'sent', attempts: 2, lastError: null, sentAt: kit.clock.now() });
    });

    it('one failure does not stop the rest of the batch', async () => {
        await queue('line', 'U1', 'a');
        await queue('sms', '+66811111111', 'b');
        line.failures = 1;
        expect(valueOf(await useCase.execute())).toEqual({ sent: 1, retrying: 1, failed: 0 });
    });

    it('e-mail is not a channel yet: recorded as failing', async () => {
        await queue('email', 'a@b.c', 'x');
        expect(valueOf(await useCase.execute())).toEqual({ sent: 0, retrying: 1, failed: 0 });
    });

    it('sends at most `limit` per run', async () => {
        await queue('sms', '+1', 'a');
        await queue('sms', '+2', 'b');
        expect(valueOf(await useCase.execute(1)).sent).toBe(1);
        expect(kit.sms.sent.map(s => s.phone)).toEqual(['+1']);
    });
});
