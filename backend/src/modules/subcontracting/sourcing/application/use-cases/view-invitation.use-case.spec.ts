import { buyerPackageLineDtoSchema, guestPackageDtoSchema, packageLineDtoSchema } from '@contrack/contract';
import {
    OUTSIDER, SourcingKit, USERS, VENDOR_OWNER, VENDOR_VIEWER, codeOf, valueOf,
} from '../../testing/sourcing-test-kit';
import { AskQuestionUseCase } from './ask-question.use-case';
import { DeclineInvitationUseCase } from './decline-invitation.use-case';
import { WithdrawInvitationUseCase } from './withdraw-invitation.use-case';
import { ViewInvitationUseCase } from './view-invitation.use-case';

describe('ViewInvitationUseCase', () => {
    it('shows the package through the link and marks the invitation viewed once', async () => {
        const kit = await SourcingKit.create();
        const { invitationId, token } = await kit.sentPackage();
        const uc = kit.get(ViewInvitationUseCase);
        const dto = valueOf(await uc.execute({ via: { token } }));
        expect(dto.invitationStatus).toBe('viewed');
        expect(dto.packageStatus).toBe('open');
        expect(dto.buyerName).toBe('บริษัท ผู้รับเหมา จำกัด');
        expect(dto.invitedPhoneMasked).toBe('xxx-xxx-5678');
        expect(dto.invitedDisplayName).toBe('ช่างสมชาย');
        expect(dto.linkedToVendor).toBe(false);
        expect(dto.outcome).toBe('pending');
        expect(dto.addendumNote).toBeNull();
        const viewedAt = (await kit.invitations.findById(invitationId))?.props.viewedAt;
        kit.clock.advance(60_000);
        valueOf(await uc.execute({ via: { token } }));
        expect((await kit.invitations.findById(invitationId))?.props.viewedAt).toEqual(viewedAt);
        expect(kit.activity.rows.filter(r => r.action === 'invitation.viewed')).toHaveLength(1);
    });

    it('hides the owner identity (project name, address) until the crew wins', async () => {
        const kit = await SourcingKit.create();
        const { pkg, invitationId, token } = await kit.sentPackage();
        const uc = kit.get(ViewInvitationUseCase);
        const before = valueOf(await uc.execute({ via: { token } }));
        expect(before.projectName).toBe('');
        expect(before.location).toEqual({ district: 'คลองหลวง', province: 'ปทุมธานี', address: '' });
        const stored = await kit.packages.findById(pkg.id as never);
        const inv = await kit.invitations.findById(invitationId);
        stored?.markAwarded(kit.clock.now());
        inv?.settleAward(true);
        if (stored !== undefined && inv !== undefined) {
            await kit.packages.update(stored);
            await kit.invitations.update(inv);
        }
        const after = valueOf(await uc.execute({ via: { token } }));
        expect(after.projectName).toBe('บ้านคุณสมศรี');
        expect(after.location.address).toBe('99 หมู่ 1 ต.คลองหนึ่ง');
        expect(after.outcome).toBe('won');
    });

    it('never carries an estimate, a BOQ key or another bidder (GuestPackageDto shape)', async () => {
        const kit = await SourcingKit.create();
        const { token, pkg } = await kit.sentPackage();
        await kit.send(pkg.id, [await kit.entry('ทีมอื่น', '0899999999')]);
        const dto = valueOf(await kit.get(ViewInvitationUseCase).execute({ via: { token } }));
        expect(guestPackageDtoSchema.strict().safeParse(dto).success).toBe(true);
        const allowed = Object.keys(packageLineDtoSchema.shape).sort();
        for (const line of dto.lines) expect(Object.keys(line).sort()).toEqual(allowed);
        const buyerOnly = Object.keys(buyerPackageLineDtoSchema.shape).filter(k => !allowed.includes(k));
        const json = JSON.stringify(dto);
        for (const k of [...buyerOnly, 'estimateTotal', 'bestBidTotal', 'privateNote', 'ทีมอื่น']) expect(json).not.toContain(k);
        expect(json).not.toMatch(/est[A-Z]/);
    });

    it('an unknown, withdrawn or expired link → invitation_invalid', async () => {
        const kit = await SourcingKit.create();
        const { invitationId, token } = await kit.sentPackage();
        const uc = kit.get(ViewInvitationUseCase);
        expect(codeOf(await uc.execute({ via: { token: 'nope-nope-nope-nope' } }))).toBe('invitation_invalid');
        kit.clock.set(new Date('2026-02-05T10:00:00.000Z'));
        expect(codeOf(await uc.execute({ via: { token } }))).toBe('invitation_invalid');
        kit.clock.set(new Date('2026-01-02T00:00:00.000Z'));
        valueOf(await kit.get(WithdrawInvitationUseCase).execute({ actorId: USERS.owner, invitationId }));
        expect(codeOf(await uc.execute({ via: { token } }))).toBe('invitation_invalid');
    });

    it('the platform switched off → module_disabled', async () => {
        const kit = await SourcingKit.create();
        const { token } = await kit.sentPackage();
        kit.flags.platform.delete('subcontracting');
        expect(codeOf(await kit.get(ViewInvitationUseCase).execute({ via: { token } }))).toBe('module_disabled');
    });

    it('signed in: any member of the linked crew (vendor.read); others not_found', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { invitationId } = await kit.sentPackage();
        const uc = kit.get(ViewInvitationUseCase);
        expect(valueOf(await uc.execute({ via: { userId: VENDOR_VIEWER, invitationId } })).linkedToVendor).toBe(true);
        expect(codeOf(await uc.execute({ via: { userId: VENDOR_OWNER, invitationId } }))).toBe('ok');
        expect(codeOf(await uc.execute({ via: { userId: OUTSIDER, invitationId } }))).toBe('not_found');
        expect(codeOf(await uc.execute({ via: { userId: USERS.owner, invitationId } }))).toBe('not_found');
    });

    it('signed in: an invitation not linked to any crew → not_found', async () => {
        const kit = await SourcingKit.create();
        const { invitationId } = await kit.sentPackage();
        expect(codeOf(await kit.get(ViewInvitationUseCase).execute({ via: { userId: VENDOR_OWNER, invitationId } }))).toBe('not_found');
    });

    it('signed in: a withdrawn invitation → not_found for view, decline and questions', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { invitationId } = await kit.sentPackage();
        valueOf(await kit.get(WithdrawInvitationUseCase).execute({ actorId: USERS.owner, invitationId }));
        const via = { userId: VENDOR_OWNER, invitationId };
        expect(codeOf(await kit.get(ViewInvitationUseCase).execute({ via }))).toBe('not_found');
        expect(codeOf(await kit.get(DeclineInvitationUseCase).execute({ via, reason: 'busy', note: '' }))).toBe('not_found');
        expect(codeOf(await kit.get(AskQuestionUseCase).execute({ via, question: 'ถาม?' }))).toBe('not_found');
    });
});
