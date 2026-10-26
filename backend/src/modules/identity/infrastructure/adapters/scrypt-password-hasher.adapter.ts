// ─── Password hashes with node:crypto scrypt (argon2's native install is not available here) ───
// Format: scrypt$<N>$<r>$<p>$<saltB64url>$<hashB64url> — the parameters travel with the hash, so the cost can be
// raised later without breaking existing hashes.
import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';
import { PasswordHasher } from '../../application/ports/password-hasher.port';
import type { PlainPassword } from '../../domain/value-objects/plain-password.value-object';

export interface ScryptCost {
    /** CPU/memory cost, a power of two. */
    N: number;
    r: number;
    p: number;
}

export const DEFAULT_SCRYPT_COST: ScryptCost = { N: 2 ** 15, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 64;
/** Upper bounds accepted when reading a stored hash (a tampered hash must not make us burn unbounded memory). */
const MAX_N = 2 ** 20;
const MAX_R = 32;
const MAX_P = 16;
const MAX_KEY_BYTES = 256;

function derive(password: string, salt: Buffer, keyLength: number, cost: ScryptCost): Promise<Buffer> {
    // scrypt needs 128·N·r bytes (plus a little); leave headroom above Node's 32 MiB default.
    const options: ScryptOptions = { N: cost.N, r: cost.r, p: cost.p, maxmem: 2 * 128 * cost.N * cost.r * cost.p + 1024 * 1024 };
    return new Promise((resolve, reject) => {
        scrypt(password.normalize('NFC'), salt, keyLength, options, (error, key) => {
            if (error) reject(error);
            else resolve(key);
        });
    });
}

const isPowerOfTwo = (n: number): boolean => n > 1 && (n & (n - 1)) === 0;

function parseInteger(raw: string): number | undefined {
    if (!/^\d{1,8}$/.test(raw)) return undefined;
    return Number(raw);
}

interface ParsedHash {
    cost: ScryptCost;
    salt: Buffer;
    key: Buffer;
}

export function parseScryptHash(stored: string): ParsedHash | undefined {
    const parts = stored.split('$');
    if (parts.length !== 6) return undefined;
    const [scheme, rawN, rawR, rawP, rawSalt, rawKey] = parts;
    if (scheme !== 'scrypt' || rawN === undefined || rawR === undefined || rawP === undefined
        || rawSalt === undefined || rawKey === undefined) return undefined;
    const N = parseInteger(rawN);
    const r = parseInteger(rawR);
    const p = parseInteger(rawP);
    if (N === undefined || r === undefined || p === undefined) return undefined;
    if (!isPowerOfTwo(N) || N > MAX_N || r < 1 || r > MAX_R || p < 1 || p > MAX_P) return undefined;
    const b64url = /^[A-Za-z0-9_-]+$/;
    if (!b64url.test(rawSalt) || !b64url.test(rawKey)) return undefined;
    const salt = Buffer.from(rawSalt, 'base64url');
    const key = Buffer.from(rawKey, 'base64url');
    if (salt.length < 8 || key.length < 16 || key.length > MAX_KEY_BYTES) return undefined;
    return { cost: { N, r, p }, salt, key };
}

export class ScryptPasswordHasher extends PasswordHasher {
    /** Hash of a fixed password, computed once up front so `dummyVerify` costs exactly one derivation. */
    private readonly dummyHash: Promise<string>;

    /** `cost` is only lowered in tests; production uses the default. */
    constructor(private readonly cost: ScryptCost = DEFAULT_SCRYPT_COST) {
        super();
        this.dummyHash = this.hashString('contrack-dummy-password');
    }

    hash(password: PlainPassword): Promise<string> {
        return this.hashString(password.value);
    }

    async verify(password: string, stored: string): Promise<boolean> {
        const parsed = parseScryptHash(stored);
        if (parsed === undefined) return false;
        const candidate = await derive(password, parsed.salt, parsed.key.length, parsed.cost);
        return candidate.length === parsed.key.length && timingSafeEqual(candidate, parsed.key);
    }

    async dummyVerify(password: string): Promise<void> {
        await this.verify(password, await this.dummyHash);
    }

    private async hashString(password: string): Promise<string> {
        const salt = randomBytes(SALT_BYTES);
        const key = await derive(password, salt, KEY_BYTES, this.cost);
        const { N, r, p } = this.cost;
        return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
    }
}
