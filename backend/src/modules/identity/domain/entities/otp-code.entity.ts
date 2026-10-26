// ─── One-time sign-in code sent by SMS. Only an HMAC of the code is kept; at most OTP_MAX_ATTEMPTS checks per code ───
import type { Brand } from '../../../../shared/domain/ids';
import type { Phone } from '../value-objects/phone.value-object';

export type OtpCodeId = Brand<string, 'OtpCodeId'>;
export const asOtpCodeId = (v: string): OtpCodeId => v as OtpCodeId;

/** Verify attempts allowed per code (the right one included). */
export const OTP_MAX_ATTEMPTS = 5;

export interface OtpCodeProps {
    id: OtpCodeId;
    phone: Phone;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    /** Set when the code signed someone in, or when a newer code replaced it. */
    consumedAt: Date | null;
    createdAt: Date;
    requestIp: string | null;
}

export interface IssueOtpCode {
    id: OtpCodeId;
    phone: Phone;
    codeHash: string;
    now: Date;
    ttlMs: number;
    requestIp: string | null;
}

const copyDate = (d: Date | null): Date | null => (d === null ? null : new Date(d.getTime()));

export class OtpCode {
    private constructor(private props: OtpCodeProps) {}

    static issue(input: IssueOtpCode): OtpCode {
        if (input.ttlMs <= 0) throw new Error('OtpCode.issue: ttlMs must be positive');
        if (input.codeHash === '') throw new Error('OtpCode.issue: codeHash is empty');
        return new OtpCode({
            id: input.id,
            phone: input.phone,
            codeHash: input.codeHash,
            createdAt: new Date(input.now.getTime()),
            expiresAt: new Date(input.now.getTime() + input.ttlMs),
            attempts: 0,
            consumedAt: null,
            requestIp: input.requestIp,
        });
    }

    static rehydrate(props: OtpCodeProps): OtpCode {
        return new OtpCode(OtpCode.copy(props));
    }

    private static copy(props: OtpCodeProps): OtpCodeProps {
        return {
            ...props,
            expiresAt: new Date(props.expiresAt.getTime()),
            createdAt: new Date(props.createdAt.getTime()),
            consumedAt: copyDate(props.consumedAt),
        };
    }

    get id(): OtpCodeId { return this.props.id; }
    get phone(): Phone { return this.props.phone; }
    get codeHash(): string { return this.props.codeHash; }
    get expiresAt(): Date { return new Date(this.props.expiresAt.getTime()); }
    get attempts(): number { return this.props.attempts; }
    get consumedAt(): Date | null { return copyDate(this.props.consumedAt); }
    get createdAt(): Date { return new Date(this.props.createdAt.getTime()); }
    get requestIp(): string | null { return this.props.requestIp; }

    isExpired(now: Date): boolean {
        return now.getTime() >= this.props.expiresAt.getTime();
    }

    get isConsumed(): boolean {
        return this.props.consumedAt !== null;
    }

    get attemptsLeft(): number {
        return Math.max(0, OTP_MAX_ATTEMPTS - this.props.attempts);
    }

    /** Not consumed, not expired and attempts left: a verify may still try it. */
    isUsable(now: Date): boolean {
        return !this.isConsumed && !this.isExpired(now) && this.attemptsLeft > 0;
    }

    /** Counts one verify attempt (in-memory mirror of the repository's atomic increment). */
    registerAttempt(): void {
        this.props = { ...this.props, attempts: this.props.attempts + 1 };
    }

    /** Idempotent: the first consumption time is kept. */
    consume(now: Date): void {
        if (this.isConsumed) return;
        this.props = { ...this.props, consumedAt: new Date(now.getTime()) };
    }

    toSnapshot(): OtpCodeProps {
        return OtpCode.copy(this.props);
    }
}
