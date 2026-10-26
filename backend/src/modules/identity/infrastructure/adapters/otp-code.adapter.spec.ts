import { HmacOtpHasher, RandomOtpGenerator } from './otp-code.adapter';

const KEY = 'otp-code:a-test-key-long-enough';

describe('RandomOtpGenerator', () => {
    it('produces 6 digits (leading zeros kept)', () => {
        const generator = new RandomOtpGenerator();
        for (let i = 0; i < 200; i += 1) expect(generator.newCode()).toMatch(/^\d{6}$/);
    });

    it('does not repeat the same code every time', () => {
        const generator = new RandomOtpGenerator();
        const codes = new Set(Array.from({ length: 50 }, () => generator.newCode()));
        expect(codes.size).toBeGreaterThan(40);
    });
});

describe('HmacOtpHasher', () => {
    const hasher = new HmacOtpHasher(KEY);

    it('hashes to hex without the code, and matches only the same phone + code', () => {
        const hash = hasher.hash('+66812345678', '123456');
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).not.toContain('123456');
        expect(hasher.matches(hash, '+66812345678', '123456')).toBe(true);
        expect(hasher.matches(hash, '+66812345678', '123457')).toBe(false);
        expect(hasher.matches(hash, '+66812345679', '123456')).toBe(false);
        expect(hasher.matches('garbage', '+66812345678', '123456')).toBe(false);
    });

    it('depends on the server key', () => {
        const other = new HmacOtpHasher(`${KEY}-other`);
        expect(other.hash('+66812345678', '123456')).not.toBe(hasher.hash('+66812345678', '123456'));
    });

    it('refuses a too short key (configuration error)', () => {
        expect(() => new HmacOtpHasher('short')).toThrow();
    });
});
