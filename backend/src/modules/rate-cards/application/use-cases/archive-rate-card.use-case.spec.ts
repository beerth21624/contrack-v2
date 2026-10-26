import type { Role } from '@contrack/contract';
import { asRateCardId } from '../../../../shared/domain';
import { OUTSIDER, OWNER, OWNER_B, ROLE_USERS, WS_A, WS_B, rateCardsKit } from '../../testing/rate-cards-test-kit';

describe('ArchiveRateCardUseCase', () => {
    it('soft-deletes: the card stays stored with archivedAt but leaves the list', async () => {
        const kit = rateCardsKit();
        const card = await kit.seedCard();
        kit.clock.advance(60_000);
        const r = await kit.archiveCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id });
        expect(r.ok).toBe(true);
        const stored = await kit.cards.find(WS_A, card.id);
        expect(stored?.archivedAt).toEqual(kit.clock.now());
        expect(await kit.cards.listActive(WS_A)).toEqual([]);
    });

    it('archiving again is a no-op (archivedAt is kept)', async () => {
        const kit = rateCardsKit();
        const card = await kit.seedCard();
        await kit.archiveCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id });
        const first = (await kit.cards.find(WS_A, card.id))?.archivedAt;
        kit.clock.advance(60_000);
        expect((await kit.archiveCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id })).ok).toBe(true);
        expect((await kit.cards.find(WS_A, card.id))?.archivedAt).toEqual(first);
    });

    it('an unknown or other-workspace card is not_found, and the other card is untouched', async () => {
        const kit = rateCardsKit();
        const foreign = await kit.seedCard({ by: OWNER_B, workspaceId: WS_B });
        const unknown = await kit.archiveCard.execute({
            userId: OWNER, workspaceId: WS_A, rateCardId: asRateCardId('00000000-0000-4000-8000-0000000000ff'),
        });
        expect(!unknown.ok && unknown.error.code).toBe('not_found');
        const crossed = await kit.archiveCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: foreign.id });
        expect(!crossed.ok && crossed.error.code).toBe('not_found');
        expect((await kit.cards.find(WS_B, foreign.id))?.isArchived).toBe(false);
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', false], ['viewer', false]])(
        '%s may archive: %s',
        async (role, allowed) => {
            const kit = rateCardsKit();
            const card = await kit.seedCard();
            const r = await kit.archiveCard.execute({ userId: ROLE_USERS[role], workspaceId: WS_A, rateCardId: card.id });
            if (allowed) expect(r.ok).toBe(true);
            else expect(!r.ok && r.error.code).toBe('forbidden');
            expect((await kit.cards.find(WS_A, card.id))?.isArchived).toBe(allowed);
        },
    );

    it('a non-member gets not_found', async () => {
        const kit = rateCardsKit();
        const card = await kit.seedCard();
        const r = await kit.archiveCard.execute({ userId: OUTSIDER, workspaceId: WS_A, rateCardId: card.id });
        expect(!r.ok && r.error.code).toBe('not_found');
    });
});
