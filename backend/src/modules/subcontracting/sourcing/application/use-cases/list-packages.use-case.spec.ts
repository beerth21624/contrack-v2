import { MASONRY_KEYS, PROJECT_ID, SourcingKit, USERS, describeBuyerAuthorization, valueOf } from '../../testing/sourcing-test-kit';
import { ListPackagesUseCase } from './list-packages.use-case';

describe('ListPackagesUseCase', () => {
    it('lists the packages of the project newest first with counts and the best bid', async () => {
        const kit = await SourcingKit.create();
        const first = await kit.draft({ title: 'แรก' });
        kit.clock.advance(1000);
        const { pkg, invitationId } = await kit.sentPackage({ title: 'สอง', lineKeys: MASONRY_KEYS.slice(3, 5) });
        kit.bids.put(invitationId, pkg.id, 90_000);
        await kit.invitations.findById(invitationId).then(async inv => {
            inv?.markSubmitted(kit.clock.now());
            if (inv !== undefined) await kit.invitations.update(inv);
        });
        const list = valueOf(await kit.get(ListPackagesUseCase).execute({ actorId: USERS.owner, projectId: PROJECT_ID }));
        expect(list.map(p => p.title)).toEqual(['สอง', 'แรก']);
        expect(list[0]?.status).toBe('open');
        expect(list[0]?.bestBidTotal).toBe(90_000);
        expect(list[0]?.invitations).toEqual({ total: 1, viewed: 1, submitted: 1, declined: 0 });
        expect(list[1]?.id).toBe(first.id);
        expect(list[1]?.bestBidTotal).toBeNull();
    });

    it('shows the effective status: open past the deadline is reviewing (bid) or expired (none)', async () => {
        const kit = await SourcingKit.create();
        await kit.sentPackage();
        kit.clock.set(new Date('2026-01-07T00:00:00.000Z'));
        const [p] = valueOf(await kit.get(ListPackagesUseCase).execute({ actorId: USERS.owner, projectId: PROJECT_ID }));
        expect(p?.status).toBe('expired');
    });

    it('zeroes estimates and hides the best bid for a viewer (no sc.readPrices), unless settings allow', async () => {
        const kit = await SourcingKit.create();
        const { pkg, invitationId } = await kit.sentPackage();
        kit.bids.put(invitationId, pkg.id, 80_000);
        const [p] = valueOf(await kit.get(ListPackagesUseCase).execute({ actorId: USERS.viewer, projectId: PROJECT_ID }));
        expect(p?.estimateTotal).toBe(0);
        expect(p?.bestBidTotal).toBeNull();
        kit.settings.value = { ...kit.settings.value, viewerSeesPrices: true };
        const [q] = valueOf(await kit.get(ListPackagesUseCase).execute({ actorId: USERS.viewer, projectId: PROJECT_ID }));
        expect(q?.estimateTotal).toBeGreaterThan(0);
        expect(q?.bestBidTotal).toBe(80_000);
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator', 'viewer'], () => Promise.resolve(undefined),
        (k, user) => k.get(ListPackagesUseCase).execute({ actorId: user, projectId: PROJECT_ID }));
});
