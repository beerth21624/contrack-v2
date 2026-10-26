import { BUYER_WS, HOUR_MS, MASONRY_KEYS, SourcingKit, VENDOR_WS } from '../../testing/sourcing-test-kit';
import { RunSourcingSweepUseCase } from './run-sourcing-sweep.use-case';

describe('RunSourcingSweepUseCase', () => {
    it('reminds invitees without a bid once, 24 h before the deadline', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { invitationId } = await kit.sentPackage();
        kit.notifier.sent.length = 0;
        const sweep = kit.get(RunSourcingSweepUseCase);
        expect(await sweep.execute()).toEqual({ reminded: 0, settled: 0 });
        kit.clock.set(new Date(new Date('2026-01-06T10:00:00.000Z').getTime() - 23 * HOUR_MS));
        expect(await sweep.execute()).toEqual({ reminded: 1, settled: 0 });
        expect(kit.notifier.sent[0]).toMatchObject({ template: 'sc.deadline_soon', toWorkspaceIds: [VENDOR_WS], payload: { deadline: '6 ม.ค. 69 17:00' } });
        expect(await sweep.execute()).toEqual({ reminded: 0, settled: 0 });
        expect((await kit.invitations.findById(invitationId))?.props.deadlineSoonAt).not.toBeNull();
    });

    it('skips invitees that already bid or declined', async () => {
        const kit = await SourcingKit.create();
        const { invitationId } = await kit.sentPackage();
        const inv = await kit.invitations.findById(invitationId);
        inv?.markSubmitted(kit.clock.now());
        if (inv !== undefined) await kit.invitations.update(inv);
        kit.clock.set(new Date('2026-01-06T00:00:00.000Z'));
        expect((await kit.get(RunSourcingSweepUseCase).execute()).reminded).toBe(0);
    });

    it('stores reviewing (with a bid) or expired (without) once the deadline passed', async () => {
        const kit = await SourcingKit.create();
        const a = await kit.sentPackage();
        const b = await kit.sentPackage({ title: 'สอง', lineKeys: MASONRY_KEYS.slice(3, 5) });
        const inv = await kit.invitations.findById(b.invitationId);
        inv?.markSubmitted(kit.clock.now());
        if (inv !== undefined) await kit.invitations.update(inv);
        kit.clock.set(new Date('2026-01-06T10:00:00.000Z'));
        expect((await kit.get(RunSourcingSweepUseCase).execute()).settled).toBe(2);
        expect((await kit.packages.findById(a.pkg.id as never))?.status).toBe('expired');
        expect((await kit.packages.findById(b.pkg.id as never))?.status).toBe('reviewing');
        expect(kit.activity.rows.map(r => r.action)).toEqual(expect.arrayContaining(['package.expired', 'package.reviewing']));
        expect((await kit.get(RunSourcingSweepUseCase).execute()).settled).toBe(0);
    });

    it('does nothing when the platform does not offer subcontracting', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        kit.flags.platform.delete('subcontracting');
        kit.clock.set(new Date('2026-01-07T00:00:00.000Z'));
        expect(await kit.get(RunSourcingSweepUseCase).execute()).toEqual({ reminded: 0, settled: 0 });
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('open');
    });

    it('skips packages of buyer workspaces that switched the module off', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { pkg } = await kit.sentPackage();
        kit.moduleOff(BUYER_WS);
        kit.notifier.sent.length = 0;
        kit.clock.set(new Date('2026-01-06T00:00:00.000Z'));
        expect(await kit.get(RunSourcingSweepUseCase).execute()).toEqual({ reminded: 0, settled: 0 });
        kit.clock.set(new Date('2026-01-07T00:00:00.000Z'));
        expect(await kit.get(RunSourcingSweepUseCase).execute()).toEqual({ reminded: 0, settled: 0 });
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('open');
        expect(kit.notifier.sent).toEqual([]);
    });

    it.each(['awarded', 'cancelled'] as const)('never overwrites a package %s after the batch was listed', async status => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        const list = kit.packages.listOpenDueBy.bind(kit.packages);
        jest.spyOn(kit.packages, 'listOpenDueBy').mockImplementation(async before => {
            const due = await list(before);
            const row = kit.packages.rows.get(pkg.id as never);
            if (row !== undefined) kit.packages.rows.set(pkg.id as never, { ...row, status });
            return due;
        });
        kit.clock.set(new Date('2026-01-07T00:00:00.000Z'));
        expect(await kit.get(RunSourcingSweepUseCase).execute()).toEqual({ reminded: 0, settled: 0 });
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe(status);
        expect(kit.activity.rows.map(r => r.action)).not.toContain('package.expired');
    });

    it('no reminder when the deadline was extended after the batch was listed', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { pkg } = await kit.sentPackage();
        const list = kit.packages.listOpenDueBy.bind(kit.packages);
        jest.spyOn(kit.packages, 'listOpenDueBy').mockImplementation(async before => {
            const due = await list(before);
            const row = kit.packages.rows.get(pkg.id as never);
            if (row !== undefined) kit.packages.rows.set(pkg.id as never, { ...row, bidDeadline: new Date('2026-01-20T10:00:00.000Z') });
            return due;
        });
        kit.notifier.sent.length = 0;
        kit.clock.set(new Date('2026-01-06T00:00:00.000Z'));
        expect(await kit.get(RunSourcingSweepUseCase).execute()).toEqual({ reminded: 0, settled: 0 });
        expect(kit.notifier.sent).toEqual([]);
    });

    it('the stored status is written only while it is still the expected one (conditional update)', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        const stale = await kit.packages.findById(pkg.id as never);
        if (stale === undefined) throw new Error('no package');
        const awarded = await kit.packages.findById(pkg.id as never);
        awarded?.markAwarded(kit.clock.now());
        if (awarded !== undefined) await kit.packages.update(awarded);
        stale.settle(new Date('2026-01-07T00:00:00.000Z'), false);
        expect(await kit.packages.updateIfStatus(stale, 'open')).toBe(false);
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('awarded');
        expect(await kit.packages.updateIfStatus(stale, 'awarded')).toBe(true);
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('expired');
    });
});
