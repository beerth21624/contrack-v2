import { asRefreshTokenId, asUserId } from '../../../../shared/domain/ids';
import { RefreshToken, asRefreshTokenFamilyId } from './refresh-token.entity';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(NOW.getTime() + ms);

const issue = () => RefreshToken.issue({
    id: asRefreshTokenId('00000000-0000-4000-8000-000000000001'),
    userId: asUserId('00000000-0000-4000-8000-0000000000aa'),
    familyId: asRefreshTokenFamilyId('00000000-0000-4000-8000-0000000000ff'),
    tokenHash: 'hash-1',
    now: NOW,
    ttlMs: 30 * DAY,
});

describe('RefreshToken', () => {
    it('is issued active, expiring after the ttl', () => {
        const token = issue();
        expect(token.createdAt).toEqual(NOW);
        expect(token.expiresAt).toEqual(at(30 * DAY));
        expect(token.revokedAt).toBeNull();
        expect(token.replacedBy).toBeNull();
        expect(token.isActive(NOW)).toBe(true);
        expect(token.isRevoked).toBe(false);
        expect(token.wasRotated).toBe(false);
    });

    it('refuses a non-positive ttl', () => {
        expect(() => RefreshToken.issue({
            id: asRefreshTokenId('00000000-0000-4000-8000-000000000001'),
            userId: asUserId('00000000-0000-4000-8000-0000000000aa'),
            familyId: asRefreshTokenFamilyId('00000000-0000-4000-8000-0000000000ff'),
            tokenHash: 'h', now: NOW, ttlMs: 0,
        })).toThrow();
    });

    it('expires exactly at expiresAt', () => {
        const token = issue();
        expect(token.isExpired(at(30 * DAY - 1))).toBe(false);
        expect(token.isExpired(at(30 * DAY))).toBe(true);
        expect(token.isActive(at(30 * DAY))).toBe(false);
    });

    it('revoke without successor is a plain revocation (logout)', () => {
        const token = issue();
        token.revoke(at(1000));
        expect(token.isRevoked).toBe(true);
        expect(token.wasRotated).toBe(false);
        expect(token.revokedAt).toEqual(at(1000));
        expect(token.isActive(at(1000))).toBe(false);
    });

    it('revoke is idempotent: the first revocation wins', () => {
        const token = issue();
        const successor = asRefreshTokenId('00000000-0000-4000-8000-000000000002');
        token.revoke(at(1000), successor);
        token.revoke(at(5000));
        expect(token.revokedAt).toEqual(at(1000));
        expect(token.replacedBy).toBe(successor);
    });

    it('rotate issues a successor in the same family and revokes itself in its favour', () => {
        const token = issue();
        const next = token.rotate({
            id: asRefreshTokenId('00000000-0000-4000-8000-000000000002'), tokenHash: 'hash-2', now: at(DAY), ttlMs: 30 * DAY,
        });
        expect(next.familyId).toBe(token.familyId);
        expect(next.userId).toBe(token.userId);
        expect(next.tokenHash).toBe('hash-2');
        expect(next.isActive(at(DAY))).toBe(true);
        expect(next.expiresAt).toEqual(at(31 * DAY));
        expect(token.wasRotated).toBe(true);
        expect(token.replacedBy).toBe(next.id);
        expect(token.revokedAt).toEqual(at(DAY));
    });

    it('rotate refuses an inactive token (programming error)', () => {
        const token = issue();
        token.revoke(NOW);
        expect(() => token.rotate({
            id: asRefreshTokenId('00000000-0000-4000-8000-000000000002'), tokenHash: 'h2', now: NOW, ttlMs: DAY,
        })).toThrow();
        const expired = issue();
        expect(() => expired.rotate({
            id: asRefreshTokenId('00000000-0000-4000-8000-000000000003'), tokenHash: 'h3', now: at(31 * DAY), ttlMs: DAY,
        })).toThrow();
    });

    it('rotatedWithin: only a rotated token, only inside the window (inclusive)', () => {
        const token = issue();
        expect(token.rotatedWithin(NOW, 30_000)).toBe(false);
        token.rotate({ id: asRefreshTokenId('00000000-0000-4000-8000-000000000002'), tokenHash: 'h2', now: NOW, ttlMs: DAY });
        expect(token.rotatedWithin(NOW, 30_000)).toBe(true);
        expect(token.rotatedWithin(at(30_000), 30_000)).toBe(true);
        expect(token.rotatedWithin(at(30_001), 30_000)).toBe(false);
        expect(token.rotatedWithin(at(-1), 30_000)).toBe(false);

        const loggedOut = issue();
        loggedOut.revoke(NOW);
        expect(loggedOut.rotatedWithin(NOW, 30_000)).toBe(false);
    });

    it('snapshots and rehydration are independent copies', () => {
        const token = issue();
        const snapshot = token.toSnapshot();
        snapshot.expiresAt.setUTCFullYear(2000);
        expect(token.expiresAt).toEqual(at(30 * DAY));
        const copy = RefreshToken.rehydrate(token.toSnapshot());
        copy.revoke(NOW);
        expect(token.isRevoked).toBe(false);
    });
});
