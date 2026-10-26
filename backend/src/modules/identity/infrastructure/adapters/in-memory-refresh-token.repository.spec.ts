import { asRefreshTokenId, asUserId } from '../../../../shared/domain/ids';
import { RefreshToken, asRefreshTokenFamilyId } from '../../domain/entities/refresh-token.entity';
import { InMemoryRefreshTokenRepository } from './in-memory-refresh-token.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const FAMILY = asRefreshTokenFamilyId('00000000-0000-4000-8000-0000000000ff');

const token = (n: number, now = NOW) => RefreshToken.issue({
    id: asRefreshTokenId(`00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`),
    userId: asUserId('00000000-0000-4000-8000-0000000000aa'),
    familyId: FAMILY,
    tokenHash: `hash-${n}`,
    now,
    ttlMs: DAY,
});

describe('InMemoryRefreshTokenRepository', () => {
    it('rotateIfActive: the first caller wins and stores its successor; the second writes nothing', async () => {
        const repo = new InMemoryRefreshTokenRepository();
        const current = token(1);
        await repo.insert(current);

        const [first, second] = await Promise.all([
            repo.rotateIfActive(current.id, token(2), NOW),
            repo.rotateIfActive(current.id, token(3), NOW),
        ]);

        expect([first, second]).toEqual([true, false]);
        const stored = await repo.findByHash('hash-1');
        expect(stored?.revokedAt).toEqual(NOW);
        expect(stored?.replacedBy).toBe(token(2).id);
        expect(await repo.findByHash('hash-2')).toBeDefined();
        expect(await repo.findByHash('hash-3')).toBeUndefined();
    });

    it('rotateIfActive loses against a revoked or unknown token', async () => {
        const repo = new InMemoryRefreshTokenRepository();
        const current = token(1);
        await repo.insert(current);
        await repo.revokeFamily(FAMILY, NOW);
        expect(await repo.rotateIfActive(current.id, token(2), NOW)).toBe(false);
        expect(await repo.rotateIfActive(asRefreshTokenId('00000000-0000-4000-8000-00000000dead'), token(3), NOW)).toBe(false);
        expect(repo.all()).toHaveLength(1);
    });

    it('revokeFamily keeps the first revocation of already revoked tokens', async () => {
        const repo = new InMemoryRefreshTokenRepository();
        await repo.insert(token(1));
        await repo.rotateIfActive(token(1).id, token(2), NOW);
        const later = new Date(NOW.getTime() + 1000);
        await repo.revokeFamily(FAMILY, later);
        expect((await repo.findByHash('hash-1'))?.revokedAt).toEqual(NOW);
        expect((await repo.findByHash('hash-2'))?.revokedAt).toEqual(later);
    });

    it('hasActiveInFamily ignores revoked and expired tokens', async () => {
        const repo = new InMemoryRefreshTokenRepository();
        await repo.insert(token(1));
        expect(await repo.hasActiveInFamily(FAMILY, NOW)).toBe(true);
        expect(await repo.hasActiveInFamily(FAMILY, new Date(NOW.getTime() + DAY))).toBe(false);
        await repo.revokeFamily(FAMILY, NOW);
        expect(await repo.hasActiveInFamily(FAMILY, NOW)).toBe(false);
    });
});
