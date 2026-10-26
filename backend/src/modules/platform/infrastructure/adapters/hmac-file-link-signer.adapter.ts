// ─── Signed file links: HMAC-SHA256 (base64url) of `<fileId>.<exp>` with a key derived from JWT_ACCESS_SECRET ───
import { createHmac, timingSafeEqual } from 'node:crypto';
import { FileLinkSigner, type SignedFileLink } from '../../application/ports/file-link-signer.port';

/** Expiry times are rounded up to this step, so repeated reads of a DTO give the same URL (browser cache hits). */
const EXP_STEP_SECONDS = 300;

export class HmacFileLinkSigner extends FileLinkSigner {
    private readonly key: Buffer;
    private readonly step: number;

    constructor(secret: string, private readonly ttlSeconds: number) {
        super();
        // A key of its own: a file signature can never be replayed as (or derived from) an access-token signature.
        this.key = createHmac('sha256', secret).update('contrack/file-links/v1').digest();
        this.step = Math.min(EXP_STEP_SECONDS, ttlSeconds);
    }

    sign(fileId: string, now: Date): SignedFileLink {
        const nowSeconds = Math.floor(now.getTime() / 1000);
        const exp = Math.ceil((nowSeconds + this.ttlSeconds) / this.step) * this.step;
        return { exp, sig: this.signature(fileId, exp) };
    }

    verify(fileId: string, exp: number, sig: string, now: Date): boolean {
        if (!Number.isSafeInteger(exp) || exp * 1000 <= now.getTime()) return false;
        const expected = Buffer.from(this.signature(fileId, exp));
        const given = Buffer.from(sig);
        return expected.length === given.length && timingSafeEqual(expected, given);
    }

    private signature(fileId: string, exp: number): string {
        return createHmac('sha256', this.key).update(`${fileId.toLowerCase()}.${exp}`).digest('base64url');
    }
}
