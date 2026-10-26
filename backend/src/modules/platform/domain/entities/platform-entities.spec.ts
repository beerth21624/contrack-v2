import { asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import { asDeliveryId, asFileId } from '../platform-ids';
import { MAX_DELIVERY_ATTEMPTS, NotificationDelivery, redactLinks } from './notification-delivery.entity';
import { StoredFile, cleanFileName } from './stored-file.entity';
import { WorkspaceModule } from './workspace-module.entity';

const ws = asWorkspaceId('00000000-0000-4000-8000-000000000001');
const user = asUserId('00000000-0000-4000-8000-000000000002');
const now = new Date('2026-03-05T10:00:00.000Z');

describe('WorkspaceModule', () => {
    it('starts off and records who switched it and when it was switched on', () => {
        const m = WorkspaceModule.initial(ws, 'subcontracting');
        expect(m.enabled).toBe(false);
        m.switch(true, user, now);
        expect(m.toProps()).toMatchObject({ enabled: true, enabledBy: user, enabledAt: now });
        m.switch(false, user, new Date(now.getTime() + 1000));
        expect(m.toProps()).toMatchObject({ enabled: false, enabledAt: now });
    });

    it('switching to the same state changes nothing', () => {
        const m = WorkspaceModule.initial(ws, 'subcontracting');
        m.switch(false, user, now);
        expect(m.toProps()).toMatchObject({ enabledBy: null, enabledAt: null });
    });
});

describe('StoredFile', () => {
    it('cleanFileName keeps the base name, drops control characters, never empty, ≤ 200 chars', () => {
        expect(cleanFileName('a/b/c.jpg')).toBe('c.jpg');
        expect(cleanFileName('C:\\x\\แบบ.pdf')).toBe('แบบ.pdf');
        expect(cleanFileName('  a\u0000b.png ')).toBe('ab.png');
        expect(cleanFileName('')).toBe('file');
        expect(cleanFileName('folder/')).toBe('file');
        const long = `${'ก'.repeat(300)}.pdf`;
        expect(cleanFileName(long)).toHaveLength(200);
        expect(cleanFileName(long).endsWith('.pdf')).toBe(true);
    });

    it('keys bytes by month folder', () => {
        const r = StoredFile.create({
            id: asFileId('00000000-0000-4000-8000-0000000000aa'), uploadedBy: user, purpose: 'bid_photo', name: 'a.jpg',
            contentType: 'image/jpeg', size: 10, now,
        });
        expect(r.ok && r.value.storageKey).toBe('2026/03/00000000-0000-4000-8000-0000000000aa');
    });
});

describe('NotificationDelivery', () => {
    const queued = (): NotificationDelivery => NotificationDelivery.queue({
        id: asDeliveryId('00000000-0000-4000-8000-0000000000bb'), notificationId: null, channel: 'sms', toAddress: '+66812345678', body: 'x', now,
    });

    it('is given up after MAX_DELIVERY_ATTEMPTS failures, with the last error (cut to 500 chars)', () => {
        const d = queued();
        for (let i = 1; i < MAX_DELIVERY_ATTEMPTS; i += 1) {
            d.markAttemptFailed('boom');
            expect(d.status).toBe('queued');
        }
        d.markAttemptFailed('e'.repeat(1000));
        expect(d.status).toBe('failed');
        expect(d.attempts).toBe(MAX_DELIVERY_ATTEMPTS);
        expect(d.lastError).toHaveLength(500);
    });

    it('a sent delivery clears the error and records the time', () => {
        const d = queued();
        d.markAttemptFailed('boom');
        d.markSent(now);
        expect(d.toProps()).toMatchObject({ status: 'sent', attempts: 2, lastError: null, sentAt: now });
    });
});

describe('NotificationDelivery link redaction', () => {
    const INVITE = 'บ. ก เชิญเสนอราคา งานฉาบ ปิดรับ 30 ต.ค. 69 17:00 https://app.contrack.co.th/i/AbCdEf0123456789xyz';
    const withBody = (body: string): NotificationDelivery => NotificationDelivery.queue({
        id: asDeliveryId('00000000-0000-4000-8000-0000000000cc'), notificationId: null, channel: 'sms', toAddress: '+66812345678', body, now,
    });

    it('redactLinks replaces every http(s) link and keeps the words', () => {
        expect(redactLinks('ดู http://a.b/x?t=1 และ HTTPS://c.d/e แล้ว')).toBe('ดู [link] และ [link] แล้ว');
        expect(redactLinks('ไม่มีลิงก์ /vendor/x')).toBe('ไม่มีลิงก์ /vendor/x');
    });

    it('keeps the link while queued (a retry must still carry it)', () => {
        const d = withBody(INVITE);
        d.markAttemptFailed('provider down');
        expect(d.status).toBe('queued');
        expect(d.body).toBe(INVITE);
    });

    it('drops the link once sent', () => {
        const d = withBody(INVITE);
        d.markSent(now);
        expect(d.body).toBe('บ. ก เชิญเสนอราคา งานฉาบ ปิดรับ 30 ต.ค. 69 17:00 [link]');
        expect(d.toProps().body).not.toContain('https://');
    });

    it('drops the link once given up, also from the error text', () => {
        const d = withBody(INVITE);
        for (let i = 0; i < MAX_DELIVERY_ATTEMPTS; i += 1) d.markAttemptFailed('rejected text https://app.contrack.co.th/i/AbCdEf');
        expect(d.status).toBe('failed');
        expect(d.body).toContain('[link]');
        expect(d.body).not.toContain('https://');
        expect(d.lastError).toBe('rejected text [link]');
    });
});
