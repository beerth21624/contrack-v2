import { PlainPassword } from '../../domain/value-objects/plain-password.value-object';
import { DEFAULT_SCRYPT_COST, ScryptPasswordHasher, parseScryptHash } from './scrypt-password-hasher.adapter';

const password = (raw: string): PlainPassword => {
    const p = PlainPassword.create(raw);
    if (!p.ok) throw new Error('bad test password');
    return p.value;
};

describe('ScryptPasswordHasher', () => {
    // Production cost: one derivation is ~50–150 ms, so the suite hashes once and reuses the result.
    const hasher = new ScryptPasswordHasher();
    let stored: string;

    beforeAll(async () => {
        stored = await hasher.hash(password('correct horse battery'));
    }, 20_000);

    it('uses the self-describing format with the production parameters', () => {
        const parts = stored.split('$');
        expect(parts).toHaveLength(6);
        expect(parts.slice(0, 4)).toEqual(['scrypt', String(2 ** 15), '8', '1']);
        const parsed = parseScryptHash(stored);
        expect(parsed?.cost).toEqual(DEFAULT_SCRYPT_COST);
        expect(parsed?.salt).toHaveLength(16);
        expect(parsed?.key).toHaveLength(64);
    });

    it('verifies the right password (round trip)', async () => {
        await expect(hasher.verify('correct horse battery', stored)).resolves.toBe(true);
    });

    it('rejects a wrong password', async () => {
        await expect(hasher.verify('correct horse battery!', stored)).resolves.toBe(false);
    });

    it('salts: the same password hashes differently each time', async () => {
        const again = await hasher.hash(password('correct horse battery'));
        expect(again).not.toBe(stored);
        await expect(hasher.verify('correct horse battery', again)).resolves.toBe(true);
    });

    it('rejects a tampered hash (changed key byte)', async () => {
        const parts = stored.split('$');
        const key = Buffer.from(parts[5]!, 'base64url');
        key[0] = (key[0]! + 1) % 256;
        parts[5] = key.toString('base64url');
        await expect(hasher.verify('correct horse battery', parts.join('$'))).resolves.toBe(false);
    });

    it('rejects a tampered hash (changed salt)', async () => {
        const parts = stored.split('$');
        parts[4] = Buffer.alloc(16, 7).toString('base64url');
        await expect(hasher.verify('correct horse battery', parts.join('$'))).resolves.toBe(false);
    });

    it.each([
        '',
        'not-a-hash',
        'argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA',
        'scrypt$32768$8$1$onlyfive',
        'scrypt$1000$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // N not a power of two
        `scrypt$${2 ** 24}$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, // N above the cap
        'scrypt$32768$8$1$!!!!$AAAA',
    ])('returns false (never throws) for a malformed hash %#', async bad => {
        await expect(hasher.verify('correct horse battery', bad)).resolves.toBe(false);
    });

    it('dummyVerify resolves without a stored hash', async () => {
        await expect(hasher.dummyVerify('whatever')).resolves.toBeUndefined();
    }, 20_000);

    it('a stored hash with other (cheaper) parameters still verifies', async () => {
        const cheap = new ScryptPasswordHasher({ N: 2 ** 10, r: 8, p: 1 });
        const h = await cheap.hash(password('another password'));
        expect(h.startsWith('scrypt$1024$8$1$')).toBe(true);
        await expect(hasher.verify('another password', h)).resolves.toBe(true);
    });
});
