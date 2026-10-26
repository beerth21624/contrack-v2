import type { OtpCode, OtpCodeId } from '../../domain/entities/otp-code.entity';
import type { Phone } from '../../domain/value-objects/phone.value-object';

/** Stored one-time codes (keyed hashes only). Every check-and-write is one atomic statement (safe under concurrency). */
export abstract class OtpCodeRepository {
    abstract insert(code: OtpCode): Promise<void>;
    /** The newest code of the phone that is not consumed and not expired at `now` (attempts not considered). */
    abstract findLatestActive(phone: Phone, now: Date): Promise<OtpCode | undefined>;
    /**
     * Counts one verify attempt: `attempts + 1` only while the code is unconsumed, unexpired at `now` and has fewer
     * than `maxAttempts` attempts. True when the attempt was counted (the caller may then compare the code).
     */
    abstract tryAttempt(id: OtpCodeId, now: Date, maxAttempts: number): Promise<boolean>;
    /** Marks the code consumed if nobody consumed it yet. True for the single winner. */
    abstract consumeIfUnused(id: OtpCodeId, at: Date): Promise<boolean>;
    /** Marks every still-unconsumed code of the phone consumed (a new code replaces them). */
    abstract invalidateActive(phone: Phone, at: Date): Promise<void>;
}
