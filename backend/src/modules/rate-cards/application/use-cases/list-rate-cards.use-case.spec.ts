import type { Role } from '@contrack/contract';
import { OUTSIDER, OWNER, OWNER_B, ROLE_USERS, WS_A, WS_B, rateCardsKit } from '../../testing/rate-cards-test-kit';

describe('ListRateCardsUseCase', () => {
    it('lists the active cards of the workspace only, oldest first', async () => {
        const kit = rateCardsKit();
        await kit.seedCard({ name: 'ชุด A' });
        kit.clock.advance(1000);
        const b = await kit.seedCard({ name: 'ชุด B', skilledRate: 1000, labourerRate: 600 });
        kit.clock.advance(1000);
        await kit.seedCard({ name: 'ทีมไฟฟ้า' });
        await kit.seedCard({ by: OWNER_B, workspaceId: WS_B, name: 'Foreign' });
        await kit.archiveCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: b.id });

        const r = await kit.listCards.execute({ userId: OWNER, workspaceId: WS_A });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.map(c => c.name.value)).toEqual(['ชุด A', 'ทีมไฟฟ้า']);
    });

    it('an empty library is an empty list', async () => {
        const kit = rateCardsKit();
        expect(await kit.listCards.execute({ userId: OWNER, workspaceId: WS_A })).toEqual({ ok: true, value: [] });
    });

    it.each<Role>(['owner', 'admin', 'estimator', 'viewer'])('%s may list', async role => {
        const kit = rateCardsKit();
        await kit.seedCard();
        const r = await kit.listCards.execute({ userId: ROLE_USERS[role], workspaceId: WS_A });
        expect(r.ok && r.value).toHaveLength(1);
    });

    it('a non-member gets not_found', async () => {
        const kit = rateCardsKit();
        const r = await kit.listCards.execute({ userId: OUTSIDER, workspaceId: WS_A });
        expect(!r.ok && r.error.code).toBe('not_found');
    });
});
