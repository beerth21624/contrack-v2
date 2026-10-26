// ─── Opaque tokens (refresh tokens, invitation tokens): random, URL-safe, stored only as SHA-256 hashes ───
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes, base64url (43 characters). */
export function newOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests / strings of the same kind. */
export function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}
