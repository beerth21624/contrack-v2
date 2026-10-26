import type { Role } from '@contrack/contract';
import { BUYER, VENDOR, activeContract, codeOf, contractsKit, must, payInstallment } from '../../testing/contracts-test-kit';

describe('Retention ledger', () => {
    it('release and forfeit up to the balance; balance = withheld − released − forfeited', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        expect(codeOf(await kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: id, kind: 'released', amount: 1, note: '' }))).toBe('unprocessable');
        await payInstallment(kit, id, 1);
        expect(codeOf(await kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: id, kind: 'released', amount: 10_000.01, note: '' }))).toBe('unprocessable');
        const forfeit = must(await kit.moveRetention.execute({ userId: BUYER.admin, subcontractId: id, kind: 'forfeited', amount: 2_500, note: 'ค่าซ่อมผนัง' }));
        expect(forfeit).toMatchObject({ kind: 'forfeited', amount: 2_500, note: 'ค่าซ่อมผนัง', claimId: null });
        must(await kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: id, kind: 'released', amount: 7_500, note: '' }));
        const sc = must(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id }));
        expect(sc.retention).toMatchObject({ withheld: 10_000, released: 7_500, forfeited: 2_500, balance: 0 });
        expect(must(await kit.listRetention.execute({ userId: VENDOR.owner, subcontractId: id })).map(e => e.kind)).toEqual(['withheld', 'forfeited', 'released']);
        expect(kit.activity.rows.filter(r => r.action.startsWith('retention_')).map(r => r.action)).toEqual(['retention_forfeited', 'retention_released']);
    });

    it.each<[Role, string]>([['owner', 'ok'], ['admin', 'ok'], ['estimator', 'forbidden'], ['viewer', 'forbidden']])(
        'buyer %s moves retention: %s', async (role, code) => {
            const kit = contractsKit();
            const id = await activeContract(kit);
            await payInstallment(kit, id, 1);
            expect(codeOf(await kit.moveRetention.execute({ userId: BUYER[role], subcontractId: id, kind: 'released', amount: 100, note: '' }))).toBe(code);
        },
    );

    it('the crew cannot move retention; pending contracts have none to move', async () => {
        const kit = contractsKit();
        const pending = await kit.award();
        expect(codeOf(await kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: pending, kind: 'released', amount: 1, note: '' }))).toBe('conflict');
        const id = await activeContract(kit);
        expect(codeOf(await kit.moveRetention.execute({ userId: VENDOR.owner, subcontractId: id, kind: 'released', amount: 1, note: '' }))).toBe('forbidden');
    });
});
