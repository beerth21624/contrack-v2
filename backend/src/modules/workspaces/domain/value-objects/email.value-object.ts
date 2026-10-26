import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 254;

/** An e-mail address, trimmed and lower-cased (invitations are matched case-insensitively). */
export class Email {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<Email, DomainError> {
        const value = raw.trim().toLowerCase();
        if (value.length > EMAIL_MAX_LENGTH || !EMAIL.test(value)) return err(DomainError.validation('Invalid e-mail address'));
        return ok(new Email(value));
    }

    /** Trusted value read back from storage (normalised again so comparisons never depend on the source). */
    static rehydrate(value: string): Email {
        return new Email(value.trim().toLowerCase());
    }

    /** Case-insensitive comparison with a raw address (e.g. a user's e-mail from the directory). */
    matches(raw: string): boolean {
        return this.value === raw.trim().toLowerCase();
    }
}
