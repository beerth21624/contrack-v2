import {
    BUYER_WS, OUTSIDER, SourcingKit, VENDOR_ESTIMATOR, VENDOR_OWNER, VENDOR_VIEWER, codeOf, valueOf,
} from '../../testing/sourcing-test-kit';
import { DeclineInvitationUseCase } from './decline-invitation.use-case';

describe('DeclineInvitationUseCase', () => {
    it('declines through the link; the buyer is told the reason in Thai', async () => {
        const kit = await SourcingKit.create();
        const { invitationId, token } = await kit.sentPackage();
        kit.notifier.sent.length = 0;
        valueOf(await kit.get(DeclineInvitationUseCase).execute({ via: { token }, reason: 'busy', note: 'ถึงสิ้นเดือน' }));
        const inv = await kit.invitations.findById(invitationId);
        expect(inv?.status).toBe('declined');
        expect(inv?.props.declineReason).toBe('busy');
        expect(kit.notifier.sent[0]).toMatchObject({
            template: 'sc.declined', toWorkspaceIds: [BUYER_WS], payload: { vendorName: 'ช่างสมชาย', reason: 'คิวงานเต็ม: ถึงสิ้นเดือน' },
        });
    });

    it('twice → conflict; after the deadline → 422; buyer module off → module_disabled', async () => {
        const kit = await SourcingKit.create();
        const { token } = await kit.sentPackage();
        const uc = kit.get(DeclineInvitationUseCase);
        kit.moduleOff();
        expect(codeOf(await uc.execute({ via: { token }, reason: 'busy', note: '' }))).toBe('module_disabled');
        kit.flags.set(BUYER_WS, 'subcontracting', true);
        valueOf(await uc.execute({ via: { token }, reason: 'busy', note: '' }));
        expect(codeOf(await uc.execute({ via: { token }, reason: 'busy', note: '' }))).toBe('conflict');
        const k2 = await SourcingKit.create();
        const s2 = await k2.sentPackage();
        k2.clock.set(new Date('2026-01-07T00:00:00.000Z'));
        expect(codeOf(await k2.get(DeclineInvitationUseCase).execute({ via: { token: s2.token }, reason: 'busy', note: '' }))).toBe('unprocessable');
    });

    it('signed in: needs vendor.bid.submit (owner yes, estimator / viewer forbidden, outsider not_found)', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { invitationId } = await kit.sentPackage();
        const uc = kit.get(DeclineInvitationUseCase);
        const decline = (userId: typeof OUTSIDER) => uc.execute({ via: { userId, invitationId }, reason: 'too_far', note: '' });
        expect(codeOf(await decline(VENDOR_VIEWER))).toBe('forbidden');
        expect(codeOf(await decline(VENDOR_ESTIMATOR))).toBe('forbidden');
        expect(codeOf(await decline(OUTSIDER))).toBe('not_found');
        expect(codeOf(await decline(VENDOR_OWNER))).toBe('ok');
        expect(kit.notifier.sent.at(-1)?.payload.vendorName).toBe('ทีมช่างสมชาย');
    });
});
