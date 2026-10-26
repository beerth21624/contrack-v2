import { createHmac } from 'node:crypto';
import { HmacFileLinkSigner } from './hmac-file-link-signer.adapter';

describe('HmacFileLinkSigner', () => {
    const secret = 'test-secret-test-secret-test-secret-123';
    const id = '00000000-0000-4000-8000-000000000001';
    const now = new Date('2026-01-01T00:00:00.000Z');
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const signer = new HmacFileLinkSigner(secret, 3600);

    it('is an HMAC-SHA256 (base64url) of `id.exp` keyed by a key derived from the JWT secret', () => {
        const { exp, sig } = signer.sign(id, now);
        const key = createHmac('sha256', secret).update('contrack/file-links/v1').digest();
        expect(sig).toBe(createHmac('sha256', key).update(`${id}.${exp}`).digest('base64url'));
        // Never signed with the raw secret (an access-token key must not open files and vice versa).
        expect(sig).not.toBe(createHmac('sha256', secret).update(`${id}.${exp}`).digest('base64url'));
    });

    it('lasts at least the TTL, rounded up to 5 minutes (same URL for repeated reads)', () => {
        const a = signer.sign(id, new Date(now.getTime() + 10_000));
        const b = signer.sign(id, new Date(now.getTime() + 70_000));
        expect(a.exp).toBeGreaterThanOrEqual(nowSeconds + 3600);
        expect(a.exp % 300).toBe(0);
        expect(b).toEqual(a);
    });

    it('verifies its own links until they expire', () => {
        const { exp, sig } = signer.sign(id, now);
        expect(signer.verify(id, exp, sig, now)).toBe(true);
        expect(signer.verify(id.toUpperCase(), exp, sig, now)).toBe(true);
        expect(signer.verify(id, exp, sig, new Date(exp * 1000 - 1))).toBe(true);
        expect(signer.verify(id, exp, sig, new Date(exp * 1000))).toBe(false);
    });

    it('rejects another id, another exp, a changed signature, another secret', () => {
        const { exp, sig } = signer.sign(id, now);
        expect(signer.verify('00000000-0000-4000-8000-000000000002', exp, sig, now)).toBe(false);
        expect(signer.verify(id, exp + 300, sig, now)).toBe(false);
        expect(signer.verify(id, exp, `${sig}x`, now)).toBe(false);
        expect(signer.verify(id, exp, '', now)).toBe(false);
        expect(new HmacFileLinkSigner(`${secret}-other`, 3600).verify(id, exp, sig, now)).toBe(false);
    });

    it('rejects a non-integer exp', () => {
        const { sig } = signer.sign(id, now);
        expect(signer.verify(id, Number.NaN, sig, now)).toBe(false);
        expect(signer.verify(id, 1.5e20, sig, now)).toBe(false);
    });

    it('a short TTL is not stretched by the rounding step', () => {
        const short = new HmacFileLinkSigner(secret, 60);
        const { exp } = short.sign(id, now);
        expect(exp - nowSeconds).toBeGreaterThanOrEqual(60);
        expect(exp - nowSeconds).toBeLessThan(120);
    });
});
