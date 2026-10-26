import type { CreatePortfolioItemRequest, PutVendorProfileRequest } from '@contrack/contract';
import {
    OUTSIDER, SourcingKit, VENDOR_ESTIMATOR, VENDOR_OWNER, VENDOR_VIEWER, VENDOR_WS, codeOf, valueOf,
} from '../../testing/sourcing-test-kit';
import { AddPortfolioItemUseCase } from './add-portfolio-item.use-case';
import { DeletePortfolioItemUseCase } from './delete-portfolio-item.use-case';
import { GetVendorProfileUseCase } from './get-vendor-profile.use-case';
import { ListMyVendorsUseCase } from './list-my-vendors.use-case';
import { PutVendorProfileUseCase } from './put-vendor-profile.use-case';

const profileBody = (): PutVendorProfileRequest => ({
    workspaceId: VENDOR_WS, teamName: 'ทีมช่างสมชาย', contactName: 'สมชาย', trades: ['masonry'], provinces: ['ปทุมธานี'],
    crewSkilled: 4, crewLabourers: 6, tools: ['เครื่องผสมปูน'], vatRegistered: false, referenceRates: [], availableMonths: ['2026-02'],
});
const itemBody = (photoFileIds: string[] = []): CreatePortfolioItemRequest => ({
    title: 'บ้านเดี่ยว 2 ชั้น', trade: 'masonry', year: 2025, district: '', province: '', photoFileIds, note: '',
});

describe('PutVendorProfileUseCase', () => {
    it('creates the profile when missing (L0) and updates it', async () => {
        const kit = await SourcingKit.create();
        const uc = kit.get(PutVendorProfileUseCase);
        const created = valueOf(await uc.execute({ actorId: VENDOR_OWNER, body: profileBody() }));
        expect(created).toMatchObject({ teamName: 'ทีมช่างสมชาย', tier: 'L0', profileComplete: false, phone: '' });
        const updated = valueOf(await uc.execute({ actorId: VENDOR_OWNER, body: { ...profileBody(), teamName: 'ทีมใหม่' } }));
        expect(updated.teamName).toBe('ทีมใหม่');
    });

    it('owner/admin only (vendor.profile.edit); outsider not_found; platform off → module_disabled', async () => {
        const kit = await SourcingKit.create();
        const uc = kit.get(PutVendorProfileUseCase);
        expect(codeOf(await uc.execute({ actorId: VENDOR_ESTIMATOR, body: profileBody() }))).toBe('forbidden');
        expect(codeOf(await uc.execute({ actorId: VENDOR_VIEWER, body: profileBody() }))).toBe('forbidden');
        expect(codeOf(await uc.execute({ actorId: OUTSIDER, body: profileBody() }))).toBe('not_found');
        kit.flags.platform.delete('subcontracting');
        expect(codeOf(await uc.execute({ actorId: VENDOR_OWNER, body: profileBody() }))).toBe('module_disabled');
    });
});

describe('AddPortfolioItemUseCase / DeletePortfolioItemUseCase', () => {
    it('three items complete the profile (L1); deleting one goes back to L0', async () => {
        const kit = await SourcingKit.create();
        valueOf(await kit.get(PutVendorProfileUseCase).execute({ actorId: VENDOR_OWNER, body: profileBody() }));
        const add = kit.get(AddPortfolioItemUseCase);
        const photo = kit.files.add(VENDOR_OWNER, 'portfolio_photo');
        const first = valueOf(await add.execute({ actorId: VENDOR_OWNER, workspaceId: VENDOR_WS, body: itemBody([photo.id]) }));
        expect(first.photos.map(p => p.id)).toEqual([photo.id]);
        valueOf(await add.execute({ actorId: VENDOR_OWNER, workspaceId: VENDOR_WS, body: itemBody() }));
        valueOf(await add.execute({ actorId: VENDOR_OWNER, workspaceId: VENDOR_WS, body: itemBody() }));
        const full = valueOf(await kit.get(GetVendorProfileUseCase).execute({ actorId: VENDOR_VIEWER, workspaceId: VENDOR_WS }));
        expect(full).toMatchObject({ tier: 'L1', profileComplete: true });
        expect(full.portfolio).toHaveLength(3);
        valueOf(await kit.get(DeletePortfolioItemUseCase).execute({ actorId: VENDOR_OWNER, itemId: first.id as never }));
        expect(valueOf(await kit.get(GetVendorProfileUseCase).execute({ actorId: VENDOR_OWNER, workspaceId: VENDOR_WS })).tier).toBe('L0');
    });

    it("refuses someone else's photo (422), a missing profile (not_found) and a viewer (forbidden)", async () => {
        const kit = await SourcingKit.create();
        const add = kit.get(AddPortfolioItemUseCase);
        expect(codeOf(await add.execute({ actorId: VENDOR_OWNER, workspaceId: VENDOR_WS, body: itemBody() }))).toBe('not_found');
        await kit.seedVendorProfile();
        const other = kit.files.add(OUTSIDER);
        expect(codeOf(await add.execute({ actorId: VENDOR_OWNER, workspaceId: VENDOR_WS, body: itemBody([other.id]) }))).toBe('unprocessable');
        expect(codeOf(await add.execute({ actorId: VENDOR_VIEWER, workspaceId: VENDOR_WS, body: itemBody() }))).toBe('forbidden');
        expect(codeOf(await add.execute({ actorId: OUTSIDER, workspaceId: VENDOR_WS, body: itemBody() }))).toBe('not_found');
    });

    it('delete: unknown item / outsider → not_found, viewer → forbidden', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const item = valueOf(await kit.get(AddPortfolioItemUseCase).execute({ actorId: VENDOR_OWNER, workspaceId: VENDOR_WS, body: itemBody() }));
        const del = kit.get(DeletePortfolioItemUseCase);
        expect(codeOf(await del.execute({ actorId: VENDOR_OWNER, itemId: '00000000-0000-4000-8000-0000000000ff' as never }))).toBe('not_found');
        expect(codeOf(await del.execute({ actorId: OUTSIDER, itemId: item.id as never }))).toBe('not_found');
        expect(codeOf(await del.execute({ actorId: VENDOR_VIEWER, itemId: item.id as never }))).toBe('forbidden');
    });
});

describe('GetVendorProfileUseCase', () => {
    it('any member reads it; no profile → not_found; outsider → not_found', async () => {
        const kit = await SourcingKit.create();
        const uc = kit.get(GetVendorProfileUseCase);
        expect(codeOf(await uc.execute({ actorId: VENDOR_OWNER, workspaceId: VENDOR_WS }))).toBe('not_found');
        await kit.seedVendorProfile();
        expect(valueOf(await uc.execute({ actorId: VENDOR_VIEWER, workspaceId: VENDOR_WS })).phone).toBe('+66812345678');
        expect(codeOf(await uc.execute({ actorId: OUTSIDER, workspaceId: VENDOR_WS }))).toBe('not_found');
    });
});

describe('ListMyVendorsUseCase', () => {
    it('lists the workspaces of the caller that carry a profile, with the role', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        kit.memberships.byUser.set(VENDOR_OWNER, [
            { workspaceId: VENDOR_WS, name: 'ทีม', kind: 'personal', role: 'owner' },
            { workspaceId: '00000000-0000-4000-b000-000000000001' as never, name: 'บริษัท', kind: 'company', role: 'viewer' },
        ]);
        expect(valueOf(await kit.get(ListMyVendorsUseCase).execute({ actorId: VENDOR_OWNER })))
            .toEqual([{ workspaceId: VENDOR_WS, teamName: 'ทีมช่างสมชาย', tier: 'L0', role: 'owner' }]);
        kit.flags.platform.delete('subcontracting');
        expect(codeOf(await kit.get(ListMyVendorsUseCase).execute({ actorId: VENDOR_OWNER }))).toBe('module_disabled');
    });
});
