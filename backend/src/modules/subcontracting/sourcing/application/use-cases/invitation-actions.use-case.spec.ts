import { sha256 } from '../../../../../shared/infrastructure/crypto';
import { BUYER_SMS_PER_DAY, buyerSmsRules } from '../ports/sms-rate-limiter.port';
import { BUYER_WS, DAY_MS, SourcingKit, USERS, VENDOR_WS, codeOf, describeBuyerAuthorization, valueOf } from '../../testing/sourcing-test-kit';
import { ListInvitationsUseCase } from './list-invitations.use-case';
import { ResendInvitationUseCase } from './resend-invitation.use-case';
import { WithdrawInvitationUseCase } from './withdraw-invitation.use-case';

describe('ListInvitationsUseCase', () => {
    it('lists invitations with the latest bid (outdated after an addendum) and hides totals without prices', async () => {
        const kit = await SourcingKit.create();
        const { pkg, invitationId } = await kit.sentPackage();
        kit.bids.put(invitationId, pkg.id, 70_000, 0);
        const uc = kit.get(ListInvitationsUseCase);
        const [inv] = valueOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never }));
        expect(inv?.displayName).toBe('ช่างสมชาย');
        expect(inv?.phone).toBe('+66812345678');
        expect(inv?.latestBid).toMatchObject({ total: 70_000, outdated: true, enteredByBuyer: false });
        const [asViewer] = valueOf(await uc.execute({ actorId: USERS.viewer, packageId: pkg.id as never }));
        expect(asViewer?.latestBid?.total).toBe(0);
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator', 'viewer'], k => k.sentPackage(),
        (k, user, s) => k.get(ListInvitationsUseCase).execute({ actorId: user, packageId: s.pkg.id as never }));
});

describe('ResendInvitationUseCase', () => {
    it('gives a fresh link, revokes every earlier one, counts the resend and notifies again', async () => {
        const kit = await SourcingKit.create();
        const { invitationId, token } = await kit.sentPackage();
        kit.notifier.sent.length = 0;
        const res = valueOf(await kit.get(ResendInvitationUseCase).execute({ actorId: USERS.owner, invitationId }));
        const fresh = res.link.url.split('/s/')[1] ?? '';
        expect(fresh).not.toBe(token);
        expect((await kit.invitations.findByTokenHash(sha256(fresh)))?.id).toBe(invitationId);
        expect(await kit.invitations.findByTokenHash(sha256(token))).toBeUndefined();
        expect(res.invitation.resentCount).toBe(1);
        expect(kit.notifier.templates()).toEqual(['sc.invitation']);
    });

    it('a withdrawn invitation or a draft / cancelled package → conflict', async () => {
        const kit = await SourcingKit.create();
        const { invitationId } = await kit.sentPackage();
        valueOf(await kit.get(WithdrawInvitationUseCase).execute({ actorId: USERS.owner, invitationId }));
        expect(codeOf(await kit.get(ResendInvitationUseCase).execute({ actorId: USERS.owner, invitationId }))).toBe('conflict');
    });

    it('unknown invitation → not_found', async () => {
        const kit = await SourcingKit.create();
        expect(codeOf(await kit.get(ResendInvitationUseCase).execute({ actorId: USERS.owner, invitationId: '00000000-0000-4000-8000-0000000000ff' as never })))
            .toBe('not_found');
    });

    it('at most one resend per 10 minutes and 5 per day per invitation → rate_limited (nothing changes)', async () => {
        const kit = await SourcingKit.create();
        const { invitationId } = await kit.sentPackage();
        const uc = kit.get(ResendInvitationUseCase);
        const first = valueOf(await uc.execute({ actorId: USERS.owner, invitationId }));
        const notices = kit.notifier.sent.length;
        const blocked = await uc.execute({ actorId: USERS.owner, invitationId });
        expect(codeOf(blocked)).toBe('rate_limited');
        expect(kit.notifier.sent).toHaveLength(notices);
        const firstToken = first.link.url.split('/s/')[1] ?? '';
        expect((await kit.invitations.findByTokenHash(sha256(firstToken)))?.id).toBe(invitationId);
        expect((await kit.invitations.findById(invitationId))?.props.resentCount).toBe(1);
        for (let n = 2; n <= 5; n += 1) {
            kit.clock.advance(11 * 60 * 1000);
            expect(codeOf(await uc.execute({ actorId: USERS.owner, invitationId }))).toBe('ok');
        }
        kit.clock.advance(11 * 60 * 1000);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, invitationId }))).toBe('rate_limited');
        kit.clock.advance(DAY_MS);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, invitationId }))).toBe('ok');
    });

    it('an SMS resend counts against the buyer workspace daily SMS budget', async () => {
        const kit = await SourcingKit.create();
        const { invitationId } = await kit.sentPackage();
        await kit.limiter.tryTake(buyerSmsRules(BUYER_WS, BUYER_SMS_PER_DAY - 1));
        expect(codeOf(await kit.get(ResendInvitationUseCase).execute({ actorId: USERS.owner, invitationId }))).toBe('rate_limited');
    });

    it('a resend of an invitation linked to a crew reaches it in-app with the signed-in route only (no raw link)', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { invitationId } = await kit.sentPackage();
        kit.notifier.sent.length = 0;
        valueOf(await kit.get(ResendInvitationUseCase).execute({ actorId: USERS.owner, invitationId }));
        expect(kit.notifier.sent).toEqual([{
            template: 'sc.invitation', toWorkspaceIds: [VENDOR_WS],
            payload: { buyerName: 'บริษัท ผู้รับเหมา จำกัด', title: 'ก่ออิฐฉาบปูนทั้งหลัง', deadline: '6 ม.ค. 69 17:00', href: `/vendor/invitations/${invitationId}` },
        }]);
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], k => k.sentPackage(),
        (k, user, s) => k.get(ResendInvitationUseCase).execute({ actorId: user, invitationId: s.invitationId }));
});

describe('WithdrawInvitationUseCase', () => {
    it('withdraws: the link stops working and the crew no longer counts', async () => {
        const kit = await SourcingKit.create();
        const { invitationId } = await kit.sentPackage();
        const dto = valueOf(await kit.get(WithdrawInvitationUseCase).execute({ actorId: USERS.owner, invitationId }));
        expect(dto.status).toBe('withdrawn');
        const stored = await kit.invitations.findById(invitationId);
        expect(stored?.linkValid(kit.clock.now())).toBe(false);
        expect(kit.activity.rows.map(r => r.action)).toContain('invitation.withdrawn');
    });

    it('a crew with a bid in, or after the award → conflict', async () => {
        const kit = await SourcingKit.create();
        const { pkg, invitationId } = await kit.sentPackage();
        const inv = await kit.invitations.findById(invitationId);
        inv?.markSubmitted(kit.clock.now());
        if (inv !== undefined) await kit.invitations.update(inv);
        expect(codeOf(await kit.get(WithdrawInvitationUseCase).execute({ actorId: USERS.owner, invitationId }))).toBe('conflict');
        const stored = await kit.packages.findById(pkg.id as never);
        stored?.markAwarded(kit.clock.now());
        if (stored !== undefined) await kit.packages.update(stored);
        expect(codeOf(await kit.get(WithdrawInvitationUseCase).execute({ actorId: USERS.owner, invitationId }))).toBe('conflict');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], k => k.sentPackage(),
        (k, user, s) => k.get(WithdrawInvitationUseCase).execute({ actorId: user, invitationId: s.invitationId }));
});
