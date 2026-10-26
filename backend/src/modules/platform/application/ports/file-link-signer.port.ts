/** A signed, time-limited link to the content of a file (usable in <img src> without the bearer token). */
export interface SignedFileLink {
    /** Unix seconds. */
    exp: number;
    sig: string;
}

export abstract class FileLinkSigner {
    /** A link valid for at least the configured TTL from `now`. */
    abstract sign(fileId: string, now: Date): SignedFileLink;
    /** True when `sig` was made for (fileId, exp) by this server and `exp` has not passed. */
    abstract verify(fileId: string, exp: number, sig: string, now: Date): boolean;
}
