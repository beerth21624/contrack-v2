import { MAX_ACTIVE_RATE_CARDS, type Role } from '@contrack/contract';
import {
    ESTIMATOR, OUTSIDER, OWNER, OWNER_B, ROLE_USERS, WS_A, WS_B, rateCardsKit,
} from '../../testing/rate-cards-test-kit';

describe('CreateRateCardUseCase', () => {
    it('creates a trimmed card with whole-baht rates, stored in the workspace', async () => {
        const kit = rateCardsKit();
        const r = await kit.createCard.execute({
            userId: OWNER, workspaceId: WS_A, name: '  ทีมไฟฟ้า ช่างพงษ์ ', skilledRate: 1200, labourerRate: 650, note: ' งานไฟฟ้า ',
        });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.name.value).toBe('ทีมไฟฟ้า ช่างพงษ์');
        expect(r.value.skilledRate.baht).toBe(1200);
        expect(r.value.labourerRate.baht).toBe(650);
        expect(r.value.note).toBe('งานไฟฟ้า');
        expect(r.value.createdBy).toBe(OWNER);
        expect(r.value.createdAt).toEqual(kit.clock.now());
        expect(r.value.id).toBe('00000000-0000-4000-8000-000000000001');
        expect((await kit.cards.find(WS_A, r.value.id))?.toProps()).toEqual(r.value.toProps());
        expect(await kit.cards.find(WS_B, r.value.id)).toBeUndefined();
    });

    it('a blank or missing note is stored as null', async () => {
        const kit = rateCardsKit();
        expect((await kit.seedCard({ name: 'A', note: '  ' })).note).toBeNull();
        expect((await kit.seedCard({ name: 'B', note: null })).note).toBeNull();
        expect((await kit.seedCard({ name: 'C' })).note).toBeNull();
    });

    it('refuses a name already used by an active card of the workspace, ignoring case', async () => {
        const kit = rateCardsKit();
        await kit.seedCard({ name: 'Team A' });
        const r = await kit.createCard.execute({ userId: OWNER, workspaceId: WS_A, name: ' team a ', skilledRate: 1, labourerRate: 1 });
        if (r.ok) throw new Error('expected conflict');
        expect(r.error.code).toBe('conflict');
        expect(r.error.details).toEqual({ reason: 'name_taken', name: 'team a' });
    });

    it('another workspace may use the same name; an archived card frees its name', async () => {
        const kit = rateCardsKit();
        const a = await kit.seedCard({ name: 'ชุด B' });
        expect((await kit.createCard.execute({
            userId: OWNER_B, workspaceId: WS_B, name: 'ชุด B', skilledRate: 1000, labourerRate: 600,
        })).ok).toBe(true);
        await kit.archiveCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: a.id });
        expect((await kit.createCard.execute({
            userId: OWNER, workspaceId: WS_A, name: 'ชุด B', skilledRate: 1000, labourerRate: 600,
        })).ok).toBe(true);
    });

    it(`keeps at most ${MAX_ACTIVE_RATE_CARDS} active cards; archiving one makes room`, async () => {
        const kit = rateCardsKit();
        const first = await kit.seedCard({ name: 'card 0' });
        for (let i = 1; i < MAX_ACTIVE_RATE_CARDS; i += 1) await kit.seedCard({ name: `card ${i}` });
        const full = await kit.createCard.execute({ userId: OWNER, workspaceId: WS_A, name: 'one more', skilledRate: 1, labourerRate: 1 });
        if (full.ok) throw new Error('expected conflict');
        expect(full.error.code).toBe('conflict');
        expect(full.error.details).toEqual({ reason: 'limit_reached', limit: MAX_ACTIVE_RATE_CARDS });
        // Another workspace has its own limit.
        expect((await kit.createCard.execute({ userId: OWNER_B, workspaceId: WS_B, name: 'x', skilledRate: 1, labourerRate: 1 })).ok).toBe(true);

        await kit.archiveCard.execute({ userId: OWNER, workspaceId: WS_A, rateCardId: first.id });
        expect((await kit.createCard.execute({ userId: OWNER, workspaceId: WS_A, name: 'one more', skilledRate: 1, labourerRate: 1 })).ok).toBe(true);
    });

    it('concurrent creates cannot both take the last place or the same name (library lock)', async () => {
        const kit = rateCardsKit();
        for (let i = 0; i < MAX_ACTIVE_RATE_CARDS - 1; i += 1) await kit.seedCard({ name: `card ${i}` });
        const results = await Promise.all(['x', 'y'].map(n =>
            kit.createCard.execute({ userId: OWNER, workspaceId: WS_A, name: n, skilledRate: 1, labourerRate: 1 })));
        expect(results.filter(r => r.ok)).toHaveLength(1);
        expect(await kit.cards.countActive(WS_A)).toBe(MAX_ACTIVE_RATE_CARDS);

        const kit2 = rateCardsKit();
        const same = await Promise.all([1, 2].map(() =>
            kit2.createCard.execute({ userId: OWNER, workspaceId: WS_A, name: 'Same', skilledRate: 1, labourerRate: 1 })));
        expect(same.map(r => (r.ok ? 'ok' : r.error.code)).sort()).toEqual(['conflict', 'ok']);
    });

    it.each<[string, Record<string, unknown>]>([
        ['an empty name', { name: '   ' }],
        ['a name over 60 characters', { name: 'x'.repeat(61) }],
        ['a negative skilled rate', { skilledRate: -1 }],
        ['a labourer rate over 100,000', { labourerRate: 100_001 }],
        ['a fractional rate', { skilledRate: 800.5 }],
        ['a note over 500 characters', { note: 'x'.repeat(501) }],
    ])('refuses %s', async (_what, override) => {
        const kit = rateCardsKit();
        const r = await kit.createCard.execute({
            userId: OWNER, workspaceId: WS_A, name: 'A', skilledRate: 800, labourerRate: 500, ...override,
        });
        expect(!r.ok && r.error.code).toBe('validation_failed');
        expect(await kit.cards.countActive(WS_A)).toBe(0);
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
        '%s may create: %s',
        async (role, allowed) => {
            const kit = rateCardsKit();
            const r = await kit.createCard.execute({ userId: ROLE_USERS[role], workspaceId: WS_A, name: 'A', skilledRate: 1, labourerRate: 1 });
            if (allowed) expect(r.ok).toBe(true);
            else expect(!r.ok && r.error.code).toBe('forbidden');
        },
    );

    it('a non-member gets not_found (another tenant is never revealed)', async () => {
        const kit = rateCardsKit();
        const outsider = await kit.createCard.execute({ userId: OUTSIDER, workspaceId: WS_A, name: 'A', skilledRate: 1, labourerRate: 1 });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const otherTenant = await kit.createCard.execute({ userId: ESTIMATOR, workspaceId: WS_B, name: 'A', skilledRate: 1, labourerRate: 1 });
        expect(!otherTenant.ok && otherTenant.error.code).toBe('not_found');
    });

    it('checks permission before validating (a viewer learns nothing about the input)', async () => {
        const kit = rateCardsKit();
        const r = await kit.createCard.execute({ userId: ROLE_USERS.viewer, workspaceId: WS_A, name: '', skilledRate: -1, labourerRate: 1 });
        expect(!r.ok && r.error.code).toBe('forbidden');
    });
});
