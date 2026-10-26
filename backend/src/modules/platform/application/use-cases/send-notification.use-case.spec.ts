import { PlatformTestKit, RecordingLineSender, valueOf } from '../../testing/platform-test-kit';
import { SMS_MAX_CHARS } from '../services/notification-templates';
import { SendNotificationUseCase } from './send-notification.use-case';

describe('SendNotificationUseCase', () => {
    let kit: PlatformTestKit;
    let line: RecordingLineSender;
    let useCase: SendNotificationUseCase;

    function build(lineOn = false): void {
        line = new RecordingLineSender(lineOn);
        useCase = new SendNotificationUseCase(kit.recipients, kit.notifications, kit.deliveries, line, kit.appLinks, kit.uow, kit.clock, kit.ids);
    }

    beforeEach(() => {
        kit = new PlatformTestKit();
        build();
    });

    const invitationPayload = {
        buyerName: 'บริษัท สมชายก่อสร้าง จำกัด',
        title: 'งานฉาบปูน อาคาร A',
        deadline: '30 ต.ค. 69 17:00',
        url: 'https://app.contrack.co.th/s/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg',
        href: '/vendor/invitations/00000000-0000-4000-8000-000000000099',
    };

    it('writes one in-app notification per member of the listed workspaces, with Thai text and the href', async () => {
        const s = kit.seedWorkspace();
        const out = valueOf(await useCase.execute({ template: 'sc.bid_received', toWorkspaceIds: [s.workspaceId], payload: {
            vendorName: 'ทีมช่างสมศักดิ์', title: 'งานฉาบปูน', total: '125,000 บาท', href: '/subcontracting/packages/p1/leveling',
        } }));
        expect(out).toEqual({ notifications: 4, deliveries: 0 });
        const list = await kit.notifications.listForUser(s.byRole.viewer, 10);
        expect(list).toHaveLength(1);
        expect(list[0]?.toProps()).toMatchObject({
            template: 'sc.bid_received',
            title: 'ได้รับใบเสนอราคา: งานฉาบปูน',
            // The total in the payload is not shown.
            body: 'ทีมช่างสมศักดิ์ ส่งราคางาน "งานฉาบปูน" แล้ว',
            href: '/subcontracting/packages/p1/leveling',
            readAt: null,
        });
        expect(await kit.notifications.listForUser(s.outsider, 10)).toEqual([]);
    });

    it('a user listed directly and as a workspace member gets one notification', async () => {
        const s = kit.seedWorkspace();
        const out = valueOf(await useCase.execute({
            template: 'sc.message', toUserIds: [s.byRole.owner], toWorkspaceIds: [s.workspaceId, s.workspaceId], payload: { fromName: 'ก', title: 'ข', href: '/x' },
        }));
        expect(out.notifications).toBe(4);
        expect(await kit.notifications.listForUser(s.byRole.owner, 10)).toHaveLength(1);
    });

    it('an invitation to a phone without an account queues one SMS (with the /s link, ≤ 2 segments) and no in-app row', async () => {
        const out = valueOf(await useCase.execute({ template: 'sc.invitation', toPhone: '+66812345678', payload: invitationPayload }));
        expect(out).toEqual({ notifications: 0, deliveries: 1 });
        const [sms] = kit.deliveries.all();
        expect(sms?.toProps()).toMatchObject({ channel: 'sms', toAddress: '+66812345678', status: 'queued', notificationId: null });
        expect(sms?.body.endsWith(invitationPayload.url)).toBe(true);
        expect(sms?.body.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
        expect(sms?.body).toContain('เชิญเสนอราคา');
    });

    it('SMS-worthy templates also text members with a phone, once per phone; the link falls back to PUBLIC_APP_URL + href', async () => {
        const s = kit.seedWorkspace();
        kit.recipients.addUser(s.byRole.owner, { phone: '+66811111111' });
        kit.recipients.addUser(s.byRole.admin, { phone: '+66 81-111-1111' });
        const out = valueOf(await useCase.execute({ template: 'sc.claim_paid', toWorkspaceIds: [s.workspaceId], payload: {
            title: 'งานฉาบปูน', installmentNo: 2, amount: '40,000 บาท', href: '/vendor/contracts/c1',
        } }));
        expect(out).toEqual({ notifications: 4, deliveries: 1 });
        const [sms] = kit.deliveries.all();
        expect(sms?.toAddress).toBe('+66811111111');
        expect(sms?.body).toBe('จ่ายเงินงวด 2 งาน งานฉาบปูน 40,000 บาท แล้ว https://app.test/vendor/contracts/c1');
        const [row] = await kit.notifications.listForUser(s.byRole.owner, 1);
        expect(sms?.toProps().notificationId).toBe(row?.id);
    });

    it('templates that are not SMS-worthy reach phones only through toPhone', async () => {
        const s = kit.seedWorkspace();
        kit.recipients.addUser(s.byRole.owner, { phone: '+66811111111' });
        const out = valueOf(await useCase.execute({ template: 'sc.question_answered', toWorkspaceIds: [s.workspaceId], payload: { title: 'ก', href: '/x' } }));
        expect(out.deliveries).toBe(0);
    });

    it('toPhone that is also a member\'s phone gets one SMS', async () => {
        const s = kit.seedWorkspace();
        kit.recipients.addUser(s.byRole.owner, { phone: '+66812345678' });
        const out = valueOf(await useCase.execute({ template: 'sc.invitation', toWorkspaceIds: [s.workspaceId], toPhone: '+66812345678', payload: invitationPayload }));
        expect(out.deliveries).toBe(1);
    });

    it('queues LINE for users who linked LINE, only when LINE is configured', async () => {
        const s = kit.seedWorkspace();
        kit.recipients.addUser(s.byRole.owner, { lineUserId: 'U123' });
        const off = valueOf(await useCase.execute({ template: 'sc.message', toUserIds: [s.byRole.owner], payload: { fromName: 'ก', title: 'ข', href: '/x' } }));
        expect(off.deliveries).toBe(0);
        build(true);
        const on = valueOf(await useCase.execute({ template: 'sc.message', toUserIds: [s.byRole.owner], payload: { fromName: 'ก', title: 'ข', href: '/x' } }));
        expect(on.deliveries).toBe(1);
        expect(kit.deliveries.all()[0]?.toProps()).toMatchObject({ channel: 'line', toAddress: 'U123' });
    });

    it('nobody to reach writes nothing', async () => {
        const out = valueOf(await useCase.execute({ template: 'sc.message', toWorkspaceIds: [kit.newWorkspaceId()], payload: { href: '/x' } }));
        expect(out).toEqual({ notifications: 0, deliveries: 0 });
    });

    it('a missing href gives an empty href and an SMS without link', async () => {
        const out = valueOf(await useCase.execute({ template: 'sc.outcome_won', toPhone: '+66812345678', payload: { buyerName: 'ก', title: 'ข' } }));
        expect(out.deliveries).toBe(1);
        expect(kit.deliveries.all()[0]?.body).toBe('ยินดีด้วย ก เลือกคุณทำงาน ข');
    });
});
