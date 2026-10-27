import type { Role } from '@contrack/contract';
import { asRateCardId } from '../../../../shared/domain';
import { OUTSIDER, OWNER, OWNER_B, ROLE_USERS, WS_A, WS_B, rateCardsKit } from '../../testing/rate-cards-test-kit';

describe('UpdateRateCardUseCase', () => {
    it('changes the given fields and moves updatedAt', async () => {
        const kit = rateCardsKit();
        const card = await kit.seedCard({ name: 'ชุด B', skilledRate: 1000, labourerRate: 600, note: 'หลังคา' });
        kit.clock.advance(60_000);
        const r = await kit.updateCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id, labourerRate: 650, note: null });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.skilledRate.baht).toBe(1000);
        expect(r.value.labourerRate.baht).toBe(650);
        expect(r.value.note).toBeNull();
        expect(r.value.updatedAt).toEqual(kit.clock.now());
        expect((await kit.cards.find(WS_A, card.id))?.toProps()).toEqual(r.value.toProps());
    });

    it('renames (trimmed); a card may change the case of its own name', async () => {
        const kit = rateCardsKit();
        const card = await kit.seedCard({ name: 'team a' });
        const r = await kit.updateCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id, name: ' Team A ' });
        expect(r.ok && r.value.name.value).toBe('Team A');
    });

    it('refuses a name used by another active card (ignoring case), but not by an archived one', async () => {
        const kit = rateCardsKit();
        await kit.seedCard({ name: 'Taken' });
        const archived = await kit.seedCard({ name: 'Old' });
        await kit.archiveCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: archived.id });
        const card = await kit.seedCard({ name: 'Mine' });

        const taken = await kit.updateCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id, name: 'TAKEN' });
        if (taken.ok) throw new Error('expected conflict');
        expect(taken.error.code).toBe('conflict');
        expect(taken.error.details).toEqual({ reason: 'name_taken', name: 'TAKEN' });
        expect((await kit.cards.find(WS_A, card.id))?.name.value).toBe('Mine');

        const reuse = await kit.updateCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id, name: 'Old' });
        expect(reuse.ok && reuse.value.name.value).toBe('Old');
    });

    it('an unchanged value is a no-op (updatedAt stays)', async () => {
        const kit = rateCardsKit();
        const card = await kit.seedCard({ skilledRate: 800 });
        kit.clock.advance(60_000);
        const r = await kit.updateCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id, skilledRate: 800 });
        expect(r.ok && r.value.updatedAt).toEqual(card.updatedAt);
    });

    it('refuses an empty request and invalid values', async () => {
        const kit = rateCardsKit();
        const card = await kit.seedCard();
        const base = { userId: OWNER, workspaceId: WS_A, rateCardId: card.id };
        for (const input of [{}, { name: ' ' }, { skilledRate: 100_001 }, { labourerRate: -5 }, { skilledRate: 1.5 }, { note: 'x'.repeat(501) }]) {
            const r = await kit.updateCard.execute({ ...base, ...input });
            expect(!r.ok && r.error.code).toBe('validation_failed');
        }
    });

    it('an archived, unknown or other-workspace card is not_found', async () => {
        const kit = rateCardsKit();
        const card = await kit.seedCard();
        const foreign = await kit.seedCard({ by: OWNER_B, workspaceId: WS_B, name: 'B card' });
        const unknown = await kit.updateCard.execute({
            userId: OWNER, workspaceId: WS_A, rateCardId: asRateCardId('00000000-0000-4000-8000-0000000000ff'), skilledRate: 1,
        });
        expect(!unknown.ok && unknown.error.code).toBe('not_found');
        // B's card through A's workspace (the caller is a member of A only).
        const crossed = await kit.updateCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: foreign.id, skilledRate: 1 });
        expect(!crossed.ok && crossed.error.code).toBe('not_found');
        expect((await kit.cards.find(WS_B, foreign.id))?.skilledRate.baht).toBe(800);

        await kit.archiveCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id });
        const archived = await kit.updateCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: card.id, skilledRate: 1 });
        expect(!archived.ok && archived.error.code).toBe('not_found');
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', false], ['viewer', false]])(
        '%s may edit: %s',
        async (role, allowed) => {
            const kit = rateCardsKit();
            const card = await kit.seedCard();
            const r = await kit.updateCard.execute({ userId: ROLE_USERS[role], workspaceId: WS_A, rateCardId: card.id, skilledRate: 900 });
            if (allowed) expect(r.ok).toBe(true);
            else expect(!r.ok && r.error.code).toBe('forbidden');
        },
    );

    it('a non-member gets not_found', async () => {
        const kit = rateCardsKit();
        const card = await kit.seedCard();
        const r = await kit.updateCard.execute({ userId: OUTSIDER, workspaceId: WS_A, rateCardId: card.id, skilledRate: 900 });
        expect(!r.ok && r.error.code).toBe('not_found');
    });
});
