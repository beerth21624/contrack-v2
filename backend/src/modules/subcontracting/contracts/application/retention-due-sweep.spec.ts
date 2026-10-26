import { AppConfig, testEnv } from '../../../../shared/infrastructure/config/env';
import { BUYER, BUYER_WS, VENDOR_WS, activeContract, contractsKit, must, payInstallment } from '../testing/contracts-test-kit';
import { RetentionDueSweep } from './retention-due-sweep';

async function completedWithRetention() {
    const kit = contractsKit();
    const id = await activeContract(kit);
    await payInstallment(kit, id, 1);
    await payInstallment(kit, id, 2);
    must(await kit.complete.execute({ userId: BUYER.owner, subcontractId: id }));
    kit.notifier.sent.length = 0;
    return { kit, id };
}

describe('RetentionDueSweep', () => {
    it('reminds both sides once, from 7 days before a planned release', async () => {
        const { kit, id } = await completedWithRetention();
        // first half is due at completion (today): reminded now, once
        expect(await kit.sweep.runOnce()).toBe(1);
        expect(kit.notifier.sent).toEqual([
            { template: 'sc.retention_due', toWorkspaceIds: [BUYER_WS], payload: { title: 'งานก่ออิฐฉาบปูน', amount: '12,500 บาท', dueAt: '26 ต.ค. 69', href: `/subcontracting/contracts/${id}` } },
            { template: 'sc.retention_due', toWorkspaceIds: [VENDOR_WS], payload: { title: 'งานก่ออิฐฉาบปูน', amount: '12,500 บาท', dueAt: '26 ต.ค. 69', href: `/vendor/contracts/${id}` } },
        ]);
        expect(await kit.sweep.runOnce()).toBe(0);
        // the second half is due 12 months later: not yet 8 days before, yes 7 days before
        kit.clock.set(new Date('2027-10-17T12:00:00Z'));
        expect(await kit.sweep.runOnce()).toBe(0);
        kit.clock.set(new Date('2027-10-19T00:00:00Z'));
        expect(await kit.sweep.runOnce()).toBe(1);
        expect(await kit.sweep.runOnce()).toBe(0);
    });

    it('skips buyers that switched the module off, and contracts with nothing held', async () => {
        const { kit } = await completedWithRetention();
        kit.flags.set(BUYER_WS, 'subcontracting', false);
        expect(await kit.sweep.runOnce()).toBe(0);
        kit.flags.set(BUYER_WS, 'subcontracting', true);
        const id = (await kit.subcontracts.listByBuyer(BUYER_WS))[0]!.id;
        must(await kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: id, kind: 'released', amount: 25_000, note: '' }));
        expect(await kit.sweep.runOnce()).toBe(0);
    });

    it('does not start timers under NODE_ENV=test', () => {
        const kit = contractsKit();
        kit.sweep.onModuleInit();
        expect(kit.sweep.started).toBe(false);
        kit.sweep.onModuleDestroy();
    });

    it('does not start timers (nor send anything) when the platform does not offer the module', async () => {
        const { kit } = await completedWithRetention();
        const sweep = (): RetentionDueSweep => new RetentionDueSweep(
            kit.subcontracts, kit.retention, kit.flags, kit.notices, kit.uow, kit.clock, new AppConfig(testEnv({ NODE_ENV: 'development', MODULES_ENABLED: 'subcontracting' })),
        );
        const on = sweep();
        on.onModuleInit();
        expect(on.started).toBe(true);
        on.onModuleDestroy();
        expect(on.started).toBe(false);
        kit.flags.platform.clear();
        const off = sweep();
        off.onModuleInit();
        expect(off.started).toBe(false);
        expect(await off.runOnce()).toBe(0);
        expect(kit.notifier.sent).toEqual([]);
    });

    it('locks and reads each contract again: one closed meanwhile is neither reminded nor turned back', async () => {
        const { kit, id } = await completedWithRetention();
        const real = kit.subcontracts.lockForUpdate.bind(kit.subcontracts);
        const lock = jest.spyOn(kit.subcontracts, 'lockForUpdate').mockImplementationOnce(async scId => {
            // another request releases everything and closes the contract while the sweep is about to write
            must(await kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: id, kind: 'released', amount: 25_000, note: '' }));
            must(await kit.close.execute({ userId: BUYER.owner, subcontractId: id }));
            return real(scId);
        });
        const update = jest.spyOn(kit.subcontracts, 'update');
        update.mockClear();
        expect(await kit.sweep.runOnce()).toBe(0);
        expect(lock).toHaveBeenCalled();
        expect((await kit.subcontracts.findById(id))?.status).toBe('closed');
        expect(kit.notifier.sent.filter(n => n.template === 'sc.retention_due')).toEqual([]);
    });

    it('writes the reminder on the locked row, after taking the lock', async () => {
        const { kit } = await completedWithRetention();
        const lock = jest.spyOn(kit.subcontracts, 'lockForUpdate');
        const update = jest.spyOn(kit.subcontracts, 'update');
        expect(await kit.sweep.runOnce()).toBe(1);
        expect(Math.min(...update.mock.invocationCallOrder)).toBeGreaterThan(Math.min(...lock.mock.invocationCallOrder));
    });
});
