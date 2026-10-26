import { asWorkspaceId } from '../../../../../shared/domain/ids';
import { BUYER_WS, OUTSIDER, SourcingKit, USERS, VENDOR_OWNER, VENDOR_VIEWER, VENDOR_WS, codeOf, valueOf } from '../../testing/sourcing-test-kit';
import { ClaimInvitationUseCase } from './claim-invitation.use-case';
import { WithdrawInvitationUseCase } from './withdraw-invitation.use-case';

describe('ClaimInvitationUseCase', () => {
    it('links the invitation of a valid link to the crew (idempotent) and tells contracts', async () => {
        const kit = await SourcingKit.create();
        const { invitationId, token } = await kit.sentPackage();
        await kit.seedVendorProfile();
        const uc = kit.get(ClaimInvitationUseCase);
        const dto = valueOf(await uc.execute({ actorId: VENDOR_VIEWER, token, workspaceId: VENDOR_WS }));
        expect(dto.linkedToVendor).toBe(true);
        expect(dto.invitationStatus).toBe('viewed');
        expect((await kit.invitations.findById(invitationId))?.vendorWorkspaceId).toBe(VENDOR_WS);
        expect(kit.listener.calls).toEqual([{ invitationId, vendorWorkspaceId: VENDOR_WS }]);
        expect(codeOf(await uc.execute({ actorId: VENDOR_OWNER, token, workspaceId: VENDOR_WS }))).toBe('ok');
        expect(kit.listener.calls).toHaveLength(1);
    });

    it('linked to another crew → conflict', async () => {
        const kit = await SourcingKit.create();
        const { token } = await kit.sentPackage();
        await kit.seedVendorProfile();
        valueOf(await kit.get(ClaimInvitationUseCase).execute({ actorId: VENDOR_OWNER, token, workspaceId: VENDOR_WS }));
        const otherWs = asWorkspaceId('00000000-0000-4000-b000-0000000000aa');
        kit.roles.set(VENDOR_OWNER, otherWs, 'owner');
        const p = (await kit.profiles.find(VENDOR_WS))?.toProps();
        if (p !== undefined) kit.profiles.rows.set(otherWs, { ...p, workspaceId: otherWs });
        expect(codeOf(await kit.get(ClaimInvitationUseCase).execute({ actorId: VENDOR_OWNER, token, workspaceId: otherWs }))).toBe('conflict');
    });

    it('a crew whose verified phone is not the invited one → conflict phone_mismatch (nothing linked)', async () => {
        const kit = await SourcingKit.create();
        const pkg = await kit.draft();
        const entry = await kit.entry('ช่างอื่น', '0891234567');
        const sent = await kit.send(pkg.id, [entry]);
        const token = sent.links[0]?.url.split('/s/')[1] ?? '';
        await kit.seedVendorProfile();
        const res = await kit.get(ClaimInvitationUseCase).execute({ actorId: VENDOR_OWNER, token, workspaceId: VENDOR_WS });
        expect(res.ok ? undefined : res.error).toMatchObject({ code: 'conflict', details: { reason: 'phone_mismatch' } });
        expect((await kit.invitations.findById(sent.links[0]?.invitationId as never))?.vendorWorkspaceId).toBeNull();
        expect(kit.listener.calls).toEqual([]);
        expect(kit.activity.rows.map(r => r.action)).not.toContain('invitation.linked');
    });

    it('a crew profile without a verified phone cannot take an invitation (phone_mismatch)', async () => {
        const kit = await SourcingKit.create();
        const { token } = await kit.sentPackage();
        const p = await kit.seedVendorProfile();
        kit.profiles.rows.set(VENDOR_WS, { ...p.toProps(), phone: '' });
        const res = await kit.get(ClaimInvitationUseCase).execute({ actorId: VENDOR_OWNER, token, workspaceId: VENDOR_WS });
        expect(res.ok ? undefined : res.error.details).toEqual({ reason: 'phone_mismatch' });
    });

    it('an invitation already linked to this crew stays claimable (idempotent) even after the crew changed phone', async () => {
        const kit = await SourcingKit.create();
        const { token } = await kit.sentPackage();
        const p = await kit.seedVendorProfile();
        valueOf(await kit.get(ClaimInvitationUseCase).execute({ actorId: VENDOR_OWNER, token, workspaceId: VENDOR_WS }));
        kit.profiles.rows.set(VENDOR_WS, { ...p.toProps(), phone: '+66890000000' });
        expect(codeOf(await kit.get(ClaimInvitationUseCase).execute({ actorId: VENDOR_OWNER, token, workspaceId: VENDOR_WS }))).toBe('ok');
    });

    it('a withdrawn invitation → not_found', async () => {
        const kit = await SourcingKit.create();
        const { token, invitationId } = await kit.sentPackage();
        await kit.seedVendorProfile();
        valueOf(await kit.get(WithdrawInvitationUseCase).execute({ actorId: USERS.owner, invitationId }));
        expect(codeOf(await kit.get(ClaimInvitationUseCase).execute({ actorId: VENDOR_OWNER, token, workspaceId: VENDOR_WS }))).toBe('not_found');
    });

    it('no vendor profile → not_found; not a member → not_found; bad link → invitation_invalid; buyer off → module_disabled', async () => {
        const kit = await SourcingKit.create();
        const { token } = await kit.sentPackage();
        const uc = kit.get(ClaimInvitationUseCase);
        expect(codeOf(await uc.execute({ actorId: VENDOR_OWNER, token, workspaceId: VENDOR_WS }))).toBe('not_found');
        await kit.seedVendorProfile();
        expect(codeOf(await uc.execute({ actorId: OUTSIDER, token, workspaceId: VENDOR_WS }))).toBe('not_found');
        expect(codeOf(await uc.execute({ actorId: VENDOR_OWNER, token: 'z'.repeat(43), workspaceId: VENDOR_WS }))).toBe('invitation_invalid');
        kit.moduleOff(BUYER_WS);
        expect(codeOf(await uc.execute({ actorId: VENDOR_OWNER, token, workspaceId: VENDOR_WS }))).toBe('module_disabled');
    });
});
