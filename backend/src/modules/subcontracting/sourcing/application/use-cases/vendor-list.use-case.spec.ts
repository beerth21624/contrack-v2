import {
    BUYER_WS, OTHER_BUYER_WS, SourcingKit, USERS, VENDOR_WS, codeOf, describeBuyerAuthorization, valueOf,
} from '../../testing/sourcing-test-kit';
import { CreateVendorListEntryUseCase } from './create-vendor-list-entry.use-case';
import { DeleteVendorListEntryUseCase } from './delete-vendor-list-entry.use-case';
import { GetVendorCardUseCase } from './get-vendor-card.use-case';
import { ImportVendorListUseCase } from './import-vendor-list.use-case';
import { ListVendorListUseCase } from './list-vendor-list.use-case';
import { UpdateVendorListEntryUseCase } from './update-vendor-list-entry.use-case';

const body = (displayName: string, phone: string) => ({ displayName, phone, lineId: '', trades: ['masonry' as const], province: '', privateNote: '' });

describe('CreateVendorListEntryUseCase', () => {
    it('adds a crew (phone normalised), linked when that phone already has a vendor profile', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        kit.stats.byVendor.set(VENDOR_WS, { lastEngagedAt: new Date('2025-12-01T00:00:00.000Z'), ratingFromUs: 4.5, completedWithUs: 2 });
        const dto = valueOf(await kit.get(CreateVendorListEntryUseCase).execute({ actorId: USERS.estimator, workspaceId: BUYER_WS, body: body('สมชาย', '081 234 5678') }));
        expect(dto).toMatchObject({
            phone: '+66812345678', vendorWorkspaceId: VENDOR_WS, hasAccount: true, tier: 'L0', profileComplete: false,
            ratingFromUs: 4.5, completedWithUs: 2, lastEngagedAt: '2025-12-01T00:00:00.000Z', hidden: false,
        });
    });

    it('the same phone twice → conflict; a bad phone → validation_failed', async () => {
        const kit = await SourcingKit.create();
        const uc = kit.get(CreateVendorListEntryUseCase);
        valueOf(await uc.execute({ actorId: USERS.owner, workspaceId: BUYER_WS, body: body('ก', '0812345678') }));
        expect(codeOf(await uc.execute({ actorId: USERS.owner, workspaceId: BUYER_WS, body: body('ข', '+66812345678') }))).toBe('conflict');
        expect(codeOf(await uc.execute({ actorId: USERS.owner, workspaceId: BUYER_WS, body: body('ค', '12') }))).toBe('validation_failed');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], () => Promise.resolve(undefined),
        (k, user) => k.get(CreateVendorListEntryUseCase).execute({ actorId: user, workspaceId: BUYER_WS, body: body('ก', '0812345678') }));
});

describe('ListVendorListUseCase', () => {
    const seed = async (kit: SourcingKit) => {
        await kit.entry('ช่างสมชาย', '0812345678');
        const hidden = await kit.entry('ช่างไฟ', '0899999999');
        valueOf(await kit.get(UpdateVendorListEntryUseCase).execute({ actorId: USERS.owner, entryId: hidden as never, body: { hidden: true, trades: ['electrical'] } }));
    };

    it('hidden omitted → all; false → visible only; true → hidden only', async () => {
        const kit = await SourcingKit.create();
        await seed(kit);
        const uc = kit.get(ListVendorListUseCase);
        const names = async (hidden?: boolean) => valueOf(await uc.execute({ actorId: USERS.viewer, workspaceId: BUYER_WS, ...(hidden === undefined ? {} : { hidden }) }))
            .map(e => e.displayName);
        expect(await names()).toEqual(['ช่างสมชาย', 'ช่างไฟ']);
        expect(await names(false)).toEqual(['ช่างสมชาย']);
        expect(await names(true)).toEqual(['ช่างไฟ']);
    });

    it('filters by trade and by text (name or phone digits)', async () => {
        const kit = await SourcingKit.create();
        await seed(kit);
        const uc = kit.get(ListVendorListUseCase);
        expect(valueOf(await uc.execute({ actorId: USERS.owner, workspaceId: BUYER_WS, trade: 'electrical' })).map(e => e.displayName)).toEqual(['ช่างไฟ']);
        expect(valueOf(await uc.execute({ actorId: USERS.owner, workspaceId: BUYER_WS, q: 'สมชาย' }))).toHaveLength(1);
        expect(valueOf(await uc.execute({ actorId: USERS.owner, workspaceId: BUYER_WS, q: '089-999' })).map(e => e.displayName)).toEqual(['ช่างไฟ']);
    });

    it("never shows another workspace's list", async () => {
        const kit = await SourcingKit.create();
        await seed(kit);
        kit.roles.set(USERS.owner, OTHER_BUYER_WS, 'owner');
        expect(valueOf(await kit.get(ListVendorListUseCase).execute({ actorId: USERS.owner, workspaceId: OTHER_BUYER_WS }))).toEqual([]);
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator', 'viewer'], () => Promise.resolve(undefined),
        (k, user) => k.get(ListVendorListUseCase).execute({ actorId: user, workspaceId: BUYER_WS }));
});

describe('ImportVendorListUseCase', () => {
    it('creates the good rows, reports duplicates and invalid phones', async () => {
        const kit = await SourcingKit.create();
        await kit.entry('มีแล้ว', '0812345678');
        const res = valueOf(await kit.get(ImportVendorListUseCase).execute({
            actorId: USERS.owner, workspaceId: BUYER_WS, body: {
                rows: [
                    { displayName: 'ก', phone: '081-234-5678', trades: [], province: '', lineId: '' },
                    { displayName: 'ข', phone: '0891111111', trades: [], province: '', lineId: '' },
                    { displayName: 'ค', phone: '+66891111111', trades: [], province: '', lineId: '' },
                    { displayName: 'ง', phone: 'abc', trades: [], province: '', lineId: '' },
                ],
            },
        }));
        expect(res).toEqual({ created: 1, duplicates: [0, 2], invalid: [{ row: 3, reason: 'เบอร์โทรไม่ถูกต้อง' }] });
        expect(await kit.entries.list(BUYER_WS)).toHaveLength(2);
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], () => Promise.resolve(undefined),
        (k, user) => k.get(ImportVendorListUseCase).execute({
            actorId: user, workspaceId: BUYER_WS, body: { rows: [{ displayName: 'ก', phone: '0891111111', trades: [], province: '', lineId: '' }] },
        }));
});

describe('UpdateVendorListEntryUseCase', () => {
    it('changes fields, hides / shows; a phone of another entry → conflict', async () => {
        const kit = await SourcingKit.create();
        const a = await kit.entry('ก', '0812345678');
        await kit.entry('ข', '0899999999');
        const uc = kit.get(UpdateVendorListEntryUseCase);
        const dto = valueOf(await uc.execute({ actorId: USERS.owner, entryId: a as never, body: { displayName: 'กอ', hidden: true, privateNote: 'โน้ต' } }));
        expect(dto).toMatchObject({ displayName: 'กอ', hidden: true, privateNote: 'โน้ต' });
        expect(valueOf(await uc.execute({ actorId: USERS.owner, entryId: a as never, body: { hidden: false } })).hidden).toBe(false);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, entryId: a as never, body: { phone: '089-999-9999' } }))).toBe('conflict');
        expect(codeOf(await uc.execute({ actorId: USERS.owner, entryId: a as never, body: { phone: '081-234-5678' } }))).toBe('ok');
    });

    it('unknown entry → not_found', async () => {
        const kit = await SourcingKit.create();
        expect(codeOf(await kit.get(UpdateVendorListEntryUseCase).execute({ actorId: USERS.owner, entryId: '00000000-0000-4000-8000-0000000000ff' as never, body: {} })))
            .toBe('not_found');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], k => k.entry(),
        (k, user, e) => k.get(UpdateVendorListEntryUseCase).execute({ actorId: user, entryId: e as never, body: { province: 'นนทบุรี' } }));
});

describe('DeleteVendorListEntryUseCase', () => {
    it('deletes an entry never invited; an invited one → conflict (hide instead)', async () => {
        const kit = await SourcingKit.create();
        const free = await kit.entry('ก', '0891111111');
        const uc = kit.get(DeleteVendorListEntryUseCase);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, entryId: free as never }))).toBe('ok');
        expect(await kit.entries.findById(free as never)).toBeUndefined();
        const { entryId } = await kit.sentPackage();
        expect(codeOf(await uc.execute({ actorId: USERS.owner, entryId: entryId as never }))).toBe('conflict');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], k => k.entry(),
        (k, user, e) => k.get(DeleteVendorListEntryUseCase).execute({ actorId: user, entryId: e as never }));
});

describe('GetVendorCardUseCase', () => {
    const linked = async (kit: SourcingKit) => {
        await kit.seedVendorProfile();
        await kit.entry();
    };

    it("shows the crew's public card (no phone, no contact name)", async () => {
        const kit = await SourcingKit.create();
        await linked(kit);
        const card = valueOf(await kit.get(GetVendorCardUseCase).execute({ actorId: USERS.viewer, workspaceId: BUYER_WS, vendorWorkspaceId: VENDOR_WS }));
        expect(card).toMatchObject({ workspaceId: VENDOR_WS, teamName: 'ทีมช่างสมชาย', tier: 'L0', profileComplete: false, portfolio: [] });
        expect(JSON.stringify(card)).not.toContain('+668');
    });

    it('a crew that is not in this buyer list → not_found', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        expect(codeOf(await kit.get(GetVendorCardUseCase).execute({ actorId: USERS.owner, workspaceId: BUYER_WS, vendorWorkspaceId: VENDOR_WS }))).toBe('not_found');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator', 'viewer'], linked,
        (k, user) => k.get(GetVendorCardUseCase).execute({ actorId: user, workspaceId: BUYER_WS, vendorWorkspaceId: VENDOR_WS }));
});
