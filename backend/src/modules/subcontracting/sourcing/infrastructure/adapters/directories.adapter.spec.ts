import { Logger } from '@nestjs/common';
import { PackageDirectory, VendorDirectory } from '../../../shared/ports';
import { BUYER_WS, PROJECT_ID, SourcingKit, USERS, VENDOR_PHONE, VENDOR_WS, valueOf } from '../../testing/sourcing-test-kit';
import { SourcingPhoneSignInHook } from './phone-sign-in-hook.adapter';
import { LinkVendorOnPhoneSignInUseCase } from '../../application/use-cases/link-vendor-on-phone-sign-in.use-case';
import { SourcingSweepRunner } from './sourcing-sweep.runner';
import { RunSourcingSweepUseCase } from '../../application/use-cases/run-sourcing-sweep.use-case';
import { AppConfig, testEnv } from '../../../../../shared/infrastructure/config/env';
import { ViewInvitationUseCase } from '../../application/use-cases/view-invitation.use-case';
import { FakeModuleFlags } from '../../../../../shared/testing/platform-fakes';
import { WorkPackage } from '../../domain/entities/work-package.entity';

describe('SourcingPackageDirectory', () => {
    it('reads packages / invitations and applies bid and award state changes', async () => {
        const kit = await SourcingKit.create();
        const dir = kit.get(PackageDirectory);
        const { pkg, invitationId } = await kit.sentPackage();
        const second = (await kit.send(pkg.id, [await kit.entry('ทีมสอง', '0899999999')])).invitations[0]?.id as never;
        const third = (await kit.send(pkg.id, [await kit.entry('ทีมสาม', '0898888888')])).invitations[0]?.id as never;

        const view = await dir.findPackage(pkg.id as never);
        expect(view).toMatchObject({ buyerName: 'บริษัท ผู้รับเหมา จำกัด', status: 'open', version: 1, projectName: 'บ้านคุณสมศรี' });
        expect(view?.lines.length).toBe(pkg.lines.length);
        expect(await dir.linesOfVersion(pkg.id as never, 1)).toHaveLength(pkg.lines.length);
        expect(await dir.linesOfVersion(pkg.id as never, 2)).toBeUndefined();
        expect((await dir.listInvitations(pkg.id as never)).map(i => i.displayName)).toEqual(['ช่างสมชาย', 'ทีมสอง', 'ทีมสาม']);
        expect(await dir.listPackagesOfProject(BUYER_WS, PROJECT_ID)).toHaveLength(1);

        await dir.markSubmitted(invitationId, kit.clock.now());
        await dir.markSubmitted(second, kit.clock.now());
        expect((await dir.findInvitation(invitationId))?.status).toBe('submitted');
        await dir.markBidWithdrawn(second);
        expect((await dir.findInvitation(second))?.status).toBe('viewed');
        await dir.markSubmitted(second, kit.clock.now());

        expect(await dir.markAwarded(pkg.id as never, [invitationId], kit.clock.now())).toBe(true);
        expect((await dir.findPackage(pkg.id as never))?.status).toBe('awarded');
        expect((await dir.findInvitation(invitationId))?.status).toBe('won');
        expect((await dir.findInvitation(second))?.status).toBe('lost');
        expect((await dir.findInvitation(third))?.status).toBe('closed');

        await dir.reopenAfterCancel(pkg.id as never, kit.clock.now());
        expect((await dir.findPackage(pkg.id as never))?.status).toBe('reviewing');
        expect((await dir.findInvitation(invitationId))?.status).toBe('submitted');
        expect((await dir.findInvitation(third))?.status).toBe('sent');

        await dir.markClosed(pkg.id as never, kit.clock.now());
        expect((await dir.findPackage(pkg.id as never))?.status).toBe('closed');
        expect(kit.activity.rows.map(r => r.action)).toEqual(expect.arrayContaining(['package.awarded', 'package.reopened', 'package.closed']));
    });

    it('lists the invitations of a vendor workspace once linked', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { invitationId } = await kit.sentPackage();
        expect((await kit.get(PackageDirectory).listInvitationsOfVendor(VENDOR_WS)).map(i => i.id)).toEqual([invitationId]);
    });

    it('unknown ids are undefined and writes are no-ops', async () => {
        const kit = await SourcingKit.create();
        const dir = kit.get(PackageDirectory);
        const missing = '00000000-0000-4000-8000-0000000000ff' as never;
        expect(await dir.findPackage(missing)).toBeUndefined();
        expect(await dir.findInvitation(missing)).toBeUndefined();
        await dir.markSubmitted(missing, kit.clock.now());
        expect(await dir.markAwarded(missing, [], kit.clock.now())).toBe(false);
        await dir.reopenAfterCancel(missing, kit.clock.now());
        await dir.markClosed(missing, kit.clock.now());
    });

    it('markAwarded refuses (false, nothing written) a package already awarded, cancelled or closed', async () => {
        for (const finish of ['award', 'cancel', 'close'] as const) {
            const kit = await SourcingKit.create();
            const dir = kit.get(PackageDirectory);
            const { pkg, invitationId } = await kit.sentPackage();
            await dir.markSubmitted(invitationId, kit.clock.now());
            const stored = await kit.packages.findById(pkg.id as never);
            if (finish === 'award') stored?.markAwarded(kit.clock.now());
            if (finish === 'cancel') stored?.cancel('ยกเลิก', kit.clock.now());
            if (finish === 'close') stored?.markClosed(kit.clock.now());
            if (stored !== undefined) await kit.packages.update(stored);
            const statusBefore = stored?.status;
            const rows = kit.activity.rows.length;
            expect(await dir.markAwarded(pkg.id as never, [invitationId], kit.clock.now())).toBe(false);
            expect((await kit.packages.findById(pkg.id as never))?.status).toBe(statusBefore);
            expect((await dir.findInvitation(invitationId))?.status).toBe('submitted');
            expect(kit.activity.rows).toHaveLength(rows);
        }
    });

    it('markAwarded works from open (deadline passed), reviewing and expired', async () => {
        for (const status of ['open', 'reviewing', 'expired'] as const) {
            const kit = await SourcingKit.create();
            const { pkg, invitationId } = await kit.sentPackage();
            const stored = await kit.packages.findById(pkg.id as never);
            if (stored !== undefined) await kit.packages.update(WorkPackage.rehydrate({ ...stored.toProps(), status }));
            expect(await kit.get(PackageDirectory).markAwarded(pkg.id as never, [invitationId], kit.clock.now())).toBe(true);
            expect((await kit.packages.findById(pkg.id as never))?.status).toBe('awarded');
        }
    });

    it('reopenAfterCancel changes only an awarded package; markClosed leaves a cancelled one alone', async () => {
        const kit = await SourcingKit.create();
        const dir = kit.get(PackageDirectory);
        const { pkg } = await kit.sentPackage();
        await dir.reopenAfterCancel(pkg.id as never, kit.clock.now());
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('open');
        const stored = await kit.packages.findById(pkg.id as never);
        stored?.cancel('ยกเลิก', kit.clock.now());
        if (stored !== undefined) await kit.packages.update(stored);
        await dir.markClosed(pkg.id as never, kit.clock.now());
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('cancelled');
    });
});

describe('SourcingVendorDirectory', () => {
    it('gives cards of vendor workspaces and the buyer names of entries', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const entryId = await kit.entry();
        const dir = kit.get(VendorDirectory);
        const cards = await dir.cards([VENDOR_WS, '00000000-0000-4000-b000-0000000000ff' as never]);
        expect([...cards.values()]).toEqual([{ workspaceId: VENDOR_WS, teamName: 'ทีมช่างสมชาย', phone: VENDOR_PHONE, tier: 'L0', profileComplete: false, vatRegistered: false }]);
        expect((await dir.entryNames([entryId as never])).get(entryId as never)).toBe('ช่างสมชาย');
    });
});

describe('SourcingPhoneSignInHook', () => {
    it('delegates to the linking use case', async () => {
        const kit = await SourcingKit.create();
        const hook = new SourcingPhoneSignInHook(kit.get(LinkVendorOnPhoneSignInUseCase));
        expect(await hook.afterSignIn({ userId: USERS.owner, phone: VENDOR_PHONE, isNewUser: true, displayName: 'x' })).toEqual({ vendorWorkspaceId: null });
    });
});

describe('SourcingSweepRunner', () => {
    it('does not start a timer under NODE_ENV=test; tick runs one pass', async () => {
        const kit = await SourcingKit.create();
        await kit.sentPackage();
        const runner = new SourcingSweepRunner(kit.get(RunSourcingSweepUseCase), new AppConfig(testEnv()), kit.flags);
        runner.onApplicationBootstrap();
        expect(runner.started).toBe(false);
        kit.clock.set(new Date('2026-01-07T00:00:00.000Z'));
        await runner.tick();
        runner.onApplicationShutdown();
        expect(kit.activity.rows.map(r => r.action)).toContain('package.expired');
    });

    it('a failing pass is logged, not thrown', async () => {
        const failing = { execute: () => Promise.reject(new Error('db down')) } as unknown as RunSourcingSweepUseCase;
        const runner = new SourcingSweepRunner(failing, new AppConfig(testEnv()), new FakeModuleFlags());
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        await expect(runner.tick()).resolves.toBeUndefined();
    });
});

describe('SourcingSweepRunner outside tests', () => {
    const devConfig = (): AppConfig => new AppConfig({ ...testEnv(), NODE_ENV: 'development' });

    it('starts its timer when the platform offers subcontracting', () => {
        const runner = new SourcingSweepRunner({} as RunSourcingSweepUseCase, devConfig(), new FakeModuleFlags());
        runner.onApplicationBootstrap();
        expect(runner.started).toBe(true);
        runner.onApplicationShutdown();
        expect(runner.started).toBe(false);
    });

    it('never starts when the platform does not offer subcontracting', () => {
        const flags = new FakeModuleFlags();
        flags.platform.delete('subcontracting');
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        const runner = new SourcingSweepRunner({} as RunSourcingSweepUseCase, devConfig(), flags);
        runner.onApplicationBootstrap();
        expect(runner.started).toBe(false);
    });
});

describe('guest view after the directory changes', () => {
    it('a lost crew sees outcome lost', async () => {
        const kit = await SourcingKit.create();
        const { pkg, invitationId, token } = await kit.sentPackage();
        await kit.get(PackageDirectory).markSubmitted(invitationId, kit.clock.now());
        await kit.get(PackageDirectory).markAwarded(pkg.id as never, [], kit.clock.now());
        expect(valueOf(await kit.get(ViewInvitationUseCase).execute({ via: { token } })).outcome).toBe('lost');
    });
});
