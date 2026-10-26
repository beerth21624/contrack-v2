import { SourcingKit, USERS, VENDOR_WS, codeOf, describeBuyerAuthorization, valueOf } from '../../testing/sourcing-test-kit';
import { CancelPackageUseCase } from './cancel-package.use-case';

describe('CancelPackageUseCase', () => {
    it('cancels with a reason and tells the linked invitees', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { pkg } = await kit.sentPackage();
        kit.notifier.sent.length = 0;
        const dto = valueOf(await kit.get(CancelPackageUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, reason: 'เจ้าของเลื่อน' }));
        expect(dto.status).toBe('cancelled');
        expect(dto.cancelReason).toBe('เจ้าของเลื่อน');
        expect(dto.cancelledAt).not.toBeNull();
        const [n] = kit.notifier.sent;
        expect(n?.template).toBe('sc.package_cancelled');
        expect(n?.toWorkspaceIds).toEqual([VENDOR_WS]);
        expect(n?.payload).toMatchObject({ reason: 'เจ้าของเลื่อน', buyerName: 'บริษัท ผู้รับเหมา จำกัด' });
    });

    it('not after award / twice (conflict)', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        const uc = kit.get(CancelPackageUseCase);
        valueOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, reason: 'x' }));
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, reason: 'x' }))).toBe('conflict');
        const other = await kit.draft();
        const stored = await kit.packages.findById(other.id as never);
        stored?.markAwarded(kit.clock.now());
        if (stored !== undefined) await kit.packages.update(stored);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: other.id as never, reason: 'x' }))).toBe('conflict');
    });

    it('an award that committed before the cancel got the row lock wins: conflict, nothing written, nobody told', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { pkg } = await kit.sentPackage();
        kit.notifier.sent.length = 0;
        const lock = kit.packages.lockById.bind(kit.packages);
        jest.spyOn(kit.packages, 'lockById').mockImplementation(async id => {
            const row = kit.packages.rows.get(id);
            if (row !== undefined) kit.packages.rows.set(id, { ...row, status: 'awarded' });
            return lock(id);
        });
        expect(codeOf(await kit.get(CancelPackageUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, reason: 'x' }))).toBe('conflict');
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('awarded');
        expect(kit.notifier.sent).toEqual([]);
        expect(kit.activity.rows.map(r => r.action)).not.toContain('package.cancelled');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], k => k.sentPackage(),
        (k, user, s) => k.get(CancelPackageUseCase).execute({ actorId: user, packageId: s.pkg.id as never, reason: 'x' }));
});
