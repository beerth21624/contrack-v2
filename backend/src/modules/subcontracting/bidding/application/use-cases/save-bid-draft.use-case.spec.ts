import type { Role } from '@contrack/contract';
import {
    BUYER, INV_A, INV_B, INV_C, LINES, OUTSIDER, PKG, VENDOR_A, VENDOR_A2, VENDOR_B, WS_BUYER, biddingKit,
} from '../../testing/bidding-test-kit';

const codeOf = (r: { ok: boolean; error?: { code: string } }): string | undefined => (r.ok ? undefined : r.error?.code);

describe('SaveBidDraftUseCase', () => {
    it('creates a draft (version 0) with defaults and partial prices, then merges later saves', async () => {
        const kit = biddingKit();
        kit.seed();
        const first = await kit.saveDraft.execute({
            userId: VENDOR_A.owner, invitationId: INV_A,
            body: { lines: [{ idx: 0, unitPrice: 90, matUnitPrice: null, excluded: false, reason: '' }] },
        });
        if (!first.ok) throw new Error(first.error.message);
        expect(first.value).toMatchObject({ status: 'draft', version: 0, mode: 'unit', total: 900, validUntil: '2026-02-28', submittedAt: null });
        const second = await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { adjustment: -100, note: 'ลดให้' } });
        if (!second.ok) throw new Error(second.error.message);
        expect(second.value.id).toBe(first.value.id);
        expect(second.value).toMatchObject({ total: 800, note: 'ลดให้', adjustment: -100 });
        expect(second.value.lines).toHaveLength(1);
        expect(kit.packages.calls).toEqual([]); // a draft does not change the invitation
    });

    it('a lump package defaults the draft to lump and refuses unit', async () => {
        const kit = biddingKit();
        kit.seed({ pricingMode: 'lump' });
        const r = await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { lumpTotal: 4000 } });
        expect(r.ok && r.value.mode).toBe('lump');
        expect(r.ok && r.value.total).toBe(4000);
        const bad = await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { mode: 'unit' } });
        expect(codeOf(bad)).toBe('unprocessable');
    });

    it('refuses unknown lines and more answers than questions', async () => {
        const kit = biddingKit();
        kit.seed();
        const r = await kit.saveDraft.execute({
            userId: VENDOR_A.owner, invitationId: INV_A, body: { lines: [{ idx: 7, unitPrice: 1, matUnitPrice: null, excluded: false, reason: '' }] },
        });
        expect(codeOf(r)).toBe('unprocessable');
        const answers = await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { answers: ['a', 'b'] } });
        expect(codeOf(answers)).toBe('unprocessable');
    });

    it('photos must be uploaded by the caller; photos already on the draft may come from a teammate', async () => {
        const kit = biddingKit();
        kit.seed();
        const mine = kit.files.add(VENDOR_A.owner, 'bid_photo');
        const theirs = kit.files.add(VENDOR_B, 'bid_photo');
        const bad = await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { photoFileIds: [theirs.id] } });
        expect(codeOf(bad)).toBe('unprocessable');
        const ok = await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { photoFileIds: [mine.id] } });
        expect(ok.ok && ok.value.photos.map(p => p.id)).toEqual([mine.id]);
        const teammate = await kit.saveDraft.execute({ userId: VENDOR_A2, invitationId: INV_A, body: { note: 'x', photoFileIds: [mine.id] } });
        expect(teammate.ok).toBe(true);
    });

    it('after an addendum, keeps the prices of lines that still exist (by BOQ key)', async () => {
        const kit = biddingKit();
        kit.seed();
        await kit.saveDraft.execute({
            userId: VENDOR_A.owner, invitationId: INV_A,
            body: { lines: [{ idx: 0, unitPrice: 90, matUnitPrice: null, excluded: false, reason: '' }, { idx: 1, unitPrice: null, matUnitPrice: null, excluded: true, reason: 'ไม่ทำ' }] },
        });
        kit.packages.versions.set(`${PKG}|1`, structuredClone(LINES));
        // version 2: line k0 removed, k1 moved to idx 0
        kit.pkg({ version: 2, lines: [{ ...LINES[1]!, idx: 0 }, { ...LINES[2]!, idx: 1 }] });
        const r = await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { note: 'ต่อ' } });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.packageVersion).toBe(2);
        expect(r.value.lines).toEqual([{ idx: 0, unitPrice: null, matUnitPrice: null, excluded: true, reason: 'ไม่ทำ', total: 0 }]);
    });

    it('two first autosaves of one invitation at the same time: the later one is a 409, not a 500', async () => {
        const kit = biddingKit();
        kit.seed();
        const first = await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: { note: 'หนึ่ง' } });
        expect(first.ok).toBe(true);
        // the second request looked for the draft before the first one was saved
        jest.spyOn(kit.bids, 'findDraft').mockResolvedValueOnce(undefined);
        const r = await kit.saveDraft.execute({ userId: VENDOR_A2, invitationId: INV_A, body: { note: 'สอง' } });
        expect(r.ok ? undefined : [r.error.code, (r.error.details as { reason: string }).reason]).toEqual(['conflict', 'bid_changed']);
        expect((await kit.bids.findDraft(INV_A))?.content.note).toBe('หนึ่ง');
    });

    it('closed package, deadline passed, withdrawn invitation → conflict', async () => {
        const kit = biddingKit();
        kit.seed({ status: 'awarded' });
        expect(codeOf(await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: {} }))).toBe('conflict');
        const late = biddingKit();
        late.seed();
        late.clock.set(new Date('2026-01-10T10:00:00.000Z'));
        expect(codeOf(await late.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: {} }))).toBe('conflict');
        const gone = biddingKit();
        gone.seed();
        gone.invitation(INV_A, gone.packages.invitations.get(INV_A)?.vendorWorkspaceId ?? null, { status: 'withdrawn' });
        expect(codeOf(await gone.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: {} }))).toBe('conflict');
    });

    it('buyer module off → module_disabled; platform off → module_disabled', async () => {
        const kit = biddingKit();
        kit.seed();
        kit.flags.set(WS_BUYER, 'subcontracting', false);
        expect(codeOf(await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: {} }))).toBe('module_disabled');
        const p = biddingKit();
        p.seed();
        p.flags.platform.delete('subcontracting');
        expect(codeOf(await p.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_A, body: {} }))).toBe('module_disabled');
    });

    it('another crew, the buyer, an outsider and an unlinked invitation → not_found', async () => {
        const kit = biddingKit();
        kit.seed();
        for (const userId of [VENDOR_B, BUYER.owner, OUTSIDER]) {
            expect(codeOf(await kit.saveDraft.execute({ userId, invitationId: INV_A, body: {} }))).toBe('not_found');
        }
        expect(codeOf(await kit.saveDraft.execute({ userId: VENDOR_A.owner, invitationId: INV_C, body: {} }))).toBe('not_found');
        expect(codeOf(await kit.saveDraft.execute({ userId: VENDOR_B, invitationId: INV_B, body: {} }))).toBeUndefined();
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
        'crew %s may save a draft: %s',
        async (role, allowed) => {
            const kit = biddingKit();
            kit.seed();
            const r = await kit.saveDraft.execute({ userId: VENDOR_A[role], invitationId: INV_A, body: {} });
            expect(codeOf(r)).toBe(allowed ? undefined : 'forbidden');
        },
    );
});
