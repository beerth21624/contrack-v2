import { asWorkspaceId } from '../../../../../shared/domain';
import {
    BUYER, BUYER_WS, OTHER_VENDOR_WS, VENDOR, VENDOR_WS, activeContract, contractsKit, must, payInstallment,
} from '../../testing/contracts-test-kit';
import { DEFAULT_SUBCONTRACTING_SETTINGS } from '../../../shared/settings';

describe('Ports provided by the contracts stream', () => {
    it('SubcontractingSettingsReader: defaults, then saved values', async () => {
        const kit = contractsKit();
        expect(await kit.settings.get(BUYER_WS)).toEqual(DEFAULT_SUBCONTRACTING_SETTINGS);
        await kit.settingsRepo.put(BUYER_WS, { ...DEFAULT_SUBCONTRACTING_SETTINGS, estimatorCanAward: true }, BUYER.owner, kit.clock.now());
        expect((await kit.settings.get(BUYER_WS)).estimatorCanAward).toBe(true);
    });

    it('RepositoryModuleUsage counts pending + active subcontracts of the buyer for subcontracting only', async () => {
        const kit = contractsKit();
        await kit.award();
        const active = await activeContract(kit);
        const cancelled = await kit.award();
        must(await kit.cancel.execute({ userId: BUYER.owner, subcontractId: cancelled, reason: 'x' }));
        expect(await kit.moduleUsage.activeWork(BUYER_WS, 'subcontracting')).toEqual({ activeSubcontracts: 2 });
        expect(await kit.moduleUsage.activeWork(BUYER_WS, 'materials')).toEqual({ activeSubcontracts: 0 });
        expect(await kit.moduleUsage.activeWork(VENDOR_WS, 'subcontracting')).toEqual({ activeSubcontracts: 0 });
        must(await kit.terminate.execute({ userId: BUYER.owner, subcontractId: active, reason: 'x' }));
        expect(await kit.moduleUsage.activeWork(BUYER_WS, 'subcontracting')).toEqual({ activeSubcontracts: 1 });
        // Registered in ModuleWorkRegistry: what the platform asks before switching the module off.
        expect(await kit.moduleWork.workOf(BUYER_WS, 'subcontracting')).toEqual({ activeSubcontracts: 1 });
        expect(await kit.moduleWork.workOf(BUYER_WS, 'materials')).toEqual({});
    });

    it('VendorStats: last engagement, completed count, average rating from this buyer', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        await payInstallment(kit, id, 1);
        await payInstallment(kit, id, 2);
        must(await kit.complete.execute({ userId: BUYER.owner, subcontractId: id }));
        must(await kit.rate.execute({ userId: BUYER.owner, subcontractId: id, scores: { quality: 5, time: 4, communication: 3 }, comment: '' }));
        const stats = await kit.vendorStats.forBuyer(BUYER_WS, [VENDOR_WS, OTHER_VENDOR_WS]);
        expect(stats.get(VENDOR_WS)).toEqual({ lastEngagedAt: kit.clock.now(), ratingFromUs: 4, completedWithUs: 1 });
        expect(stats.get(OTHER_VENDOR_WS)).toEqual({ lastEngagedAt: null, ratingFromUs: null, completedWithUs: 0 });
        expect((await kit.vendorStats.forBuyer(asWorkspaceId(OTHER_VENDOR_WS), [VENDOR_WS])).get(VENDOR_WS)?.completedWithUs).toBe(0);
    });

    it('VendorLinkListener links subcontracts awarded before the crew signed up', async () => {
        const kit = contractsKit();
        const id = await kit.award({ vendorWorkspaceId: null });
        expect((await kit.get.execute({ userId: VENDOR.owner, subcontractId: id })).ok).toBe(false);
        const sc = await kit.subcontracts.findById(id);
        await kit.linkListener.onInvitationLinked(sc!.state.invitationId, VENDOR_WS);
        const linked = must(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id }));
        expect(linked).toMatchObject({ vendorWorkspaceId: VENDOR_WS, vendorName: 'ทีมช่างสมชาย', viewerSide: 'vendor' });
        expect(kit.activity.rows.at(-1)?.action).toBe('vendor_linked');
        await kit.linkListener.onInvitationLinked(sc!.state.invitationId, OTHER_VENDOR_WS);
        expect((await kit.subcontracts.findById(id))?.vendorWorkspaceId).toBe(VENDOR_WS);
    });
});
