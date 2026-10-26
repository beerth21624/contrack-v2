// ─── Phone number: any common Thai form normalised to E.164 (+66…) with the contract's phoneSchema ───
import { PHONE_EMAIL_DOMAIN, phoneSchema } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';

export class Phone {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<Phone, DomainError> {
        const parsed = phoneSchema.safeParse(raw);
        return parsed.success ? ok(new Phone(parsed.data)) : err(DomainError.validation('Invalid phone number'));
    }

    /** From storage (already E.164). */
    static rehydrate(value: string): Phone {
        return new Phone(value);
    }

    /** Placeholder e-mail of a phone-only user: `66812345678@phone.contrack.invalid` (never shown, never mailed). */
    get placeholderEmail(): string {
        return `${this.value.replace('+', '')}@${PHONE_EMAIL_DOMAIN}`.toLowerCase();
    }

    equals(other: Phone): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}

/** True for the placeholder e-mails of phone-only users (they can never sign in with e-mail + password). */
export function isPhonePlaceholderEmail(email: string): boolean {
    return email.trim().toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}
