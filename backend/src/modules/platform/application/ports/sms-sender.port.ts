/**
 * Sends one SMS right away (no queue). Used by the notification delivery worker and by identity for OTP codes.
 * Adapters: console (prints to the server log, development), thaibulksms (real SMS), RecordingSmsSender (tests).
 * Throws when the provider refused the message (the caller records / retries).
 */
export abstract class SmsSender {
    /** `phone` in E.164 (+66…); `text` Thai, ideally ≤ 2 segments (134 characters). */
    abstract send(phone: string, text: string): Promise<void>;
}
