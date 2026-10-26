/** New random one-time codes (6 digits). */
export abstract class OtpGenerator {
    abstract newCode(): string;
}

/** Keyed hash of a code (bound to its phone), so a leaked table does not reveal codes. */
export abstract class OtpHasher {
    abstract hash(phone: string, code: string): string;
    /** Constant-time comparison of `code` against a stored hash. */
    abstract matches(hash: string, phone: string, code: string): boolean;
}
