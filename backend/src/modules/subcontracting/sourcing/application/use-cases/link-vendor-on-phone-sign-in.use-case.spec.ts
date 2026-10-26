import { asWorkspaceId } from '../../../../../shared/domain/ids';
import { BUYER_WS, OTHER_BUYER_WS, SourcingKit, USERS, VENDOR_OWNER, VENDOR_PHONE, VENDOR_WS, valueOf } from '../../testing/sourcing-test-kit';
import { CreateVendorListEntryUseCase } from './create-vendor-list-entry.use-case';
import { LinkVendorOnPhoneSignInUseCase } from './link-vendor-on-phone-sign-in.use-case';

const event = (extra: Partial<Parameters<LinkVendorOnPhoneSignInUseCase['execute']>[0]> = {}) => ({
    userId: VENDOR_OWNER, phone: VENDOR_PHONE, isNewUser: true, displayName: 'สมชาย', ...extra,
});

describe('LinkVendorOnPhoneSignInUseCase', () => {
    it('creates the L0 profile with a team name and links every entry with the phone (any buyer) and their invitations', async () => {
        const kit = await SourcingKit.create();
        const { invitationId } = await kit.sentPackage();
        kit.roles.set(USERS.owner, OTHER_BUYER_WS, 'owner');
        valueOf(await kit.get(CreateVendorListEntryUseCase).execute({
            actorId: USERS.owner, workspaceId: OTHER_BUYER_WS,
            body: { displayName: 'อีกเจ้า', phone: VENDOR_PHONE, lineId: '', trades: [], province: '', privateNote: '' },
        }));
        const res = await kit.get(LinkVendorOnPhoneSignInUseCase).execute(event({ teamName: 'ทีมช่างสมชาย' }));
        expect(res.vendorWorkspaceId).toBe(VENDOR_WS);
        const profile = await kit.profiles.find(VENDOR_WS);
        expect(profile?.props).toMatchObject({ teamName: 'ทีมช่างสมชาย', contactName: 'สมชาย', phone: VENDOR_PHONE, tier: 'L0' });
        expect((await kit.entries.findByPhone(BUYER_WS, VENDOR_PHONE))?.vendorWorkspaceId).toBe(VENDOR_WS);
        expect((await kit.entries.findByPhone(OTHER_BUYER_WS, VENDOR_PHONE))?.vendorWorkspaceId).toBe(VENDOR_WS);
        expect((await kit.invitations.findById(invitationId))?.vendorWorkspaceId).toBe(VENDOR_WS);
        expect(kit.listener.calls).toEqual([{ invitationId, vendorWorkspaceId: VENDOR_WS }]);
    });

    it('links the invitation of the link the user came from when it was sent to the verified phone', async () => {
        const kit = await SourcingKit.create();
        const { invitationId, token } = await kit.sentPackage();
        const res = await kit.get(LinkVendorOnPhoneSignInUseCase).execute(event({ teamName: 'ทีม', invitationToken: token }));
        expect(res.vendorWorkspaceId).toBe(VENDOR_WS);
        expect((await kit.invitations.findById(invitationId))?.vendorWorkspaceId).toBe(VENDOR_WS);
        expect(kit.listener.calls).toEqual([{ invitationId, vendorWorkspaceId: VENDOR_WS }]);
    });

    it('never links the invitation of the link when the buyer invited another phone (sign-in still succeeds)', async () => {
        const kit = await SourcingKit.create();
        const pkg = await kit.draft();
        const entry = await kit.entry('ช่างอื่น', '0891234567');
        const sent = await kit.send(pkg.id, [entry]);
        const token = sent.links[0]?.url.split('/s/')[1] ?? '';
        const res = await kit.get(LinkVendorOnPhoneSignInUseCase).execute(event({ teamName: 'ทีม', invitationToken: token }));
        expect(res.vendorWorkspaceId).toBe(VENDOR_WS);
        expect((await kit.invitations.findById(sent.links[0]?.invitationId as never))?.vendorWorkspaceId).toBeNull();
        expect((await kit.entries.findById(entry as never))?.vendorWorkspaceId).toBeNull();
        expect(kit.listener.calls).toEqual([]);
    });

    it('a phone match on the entry does not link an invitation that was sent to an older phone of that entry', async () => {
        const kit = await SourcingKit.create();
        const { invitationId } = await kit.sentPackage();
        const stored = kit.invitations.rows.get(invitationId);
        if (stored !== undefined) kit.invitations.rows.set(invitationId, { ...stored, phone: '+66890000000' });
        await kit.get(LinkVendorOnPhoneSignInUseCase).execute(event({ teamName: 'ทีม' }));
        expect((await kit.entries.findByPhone(BUYER_WS, VENDOR_PHONE))?.vendorWorkspaceId).toBe(VENDOR_WS);
        expect((await kit.invitations.findById(invitationId))?.vendorWorkspaceId).toBeNull();
    });

    it('reuses an existing profile (no team name needed) and ignores an expired link', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const pkg = await kit.draft();
        const entry = await kit.entry('ช่างอื่น', '0891234567');
        const sent = await kit.send(pkg.id, [entry]);
        kit.clock.set(new Date('2026-03-01T00:00:00.000Z'));
        const token = sent.links[0]?.url.split('/s/')[1] ?? '';
        const res = await kit.get(LinkVendorOnPhoneSignInUseCase).execute(event({ isNewUser: false, invitationToken: token }));
        expect(res.vendorWorkspaceId).toBe(VENDOR_WS);
        expect((await kit.invitations.findById(sent.links[0]?.invitationId as never))?.vendorWorkspaceId).toBeNull();
        expect(kit.profiles.rows.size).toBe(1);
    });

    it('no profile and no team name → null (nothing linked); no personal workspace → null', async () => {
        const kit = await SourcingKit.create();
        await kit.sentPackage();
        expect(await kit.get(LinkVendorOnPhoneSignInUseCase).execute(event())).toEqual({ vendorWorkspaceId: null });
        expect((await kit.entries.findByPhone(BUYER_WS, VENDOR_PHONE))?.vendorWorkspaceId).toBeNull();
        kit.workspaces.personal.delete(VENDOR_OWNER);
        expect(await kit.get(LinkVendorOnPhoneSignInUseCase).execute(event({ teamName: 'x' }))).toEqual({ vendorWorkspaceId: null });
    });

    it('an invitation already linked to another crew stays linked to it', async () => {
        const kit = await SourcingKit.create();
        const { invitationId, token } = await kit.sentPackage();
        const inv = await kit.invitations.findById(invitationId);
        const other = asWorkspaceId('00000000-0000-4000-b000-0000000000bb');
        inv?.linkTo(other);
        if (inv !== undefined) await kit.invitations.update(inv);
        await kit.get(LinkVendorOnPhoneSignInUseCase).execute(event({ teamName: 'ทีม', invitationToken: token }));
        expect((await kit.invitations.findById(invitationId))?.vendorWorkspaceId).toBe(other);
        expect(kit.listener.calls).toEqual([]);
    });
});
