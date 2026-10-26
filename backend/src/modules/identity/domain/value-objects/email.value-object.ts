// ─── E-mail address: trimmed, lower-cased, validated with the contract's schema ───
import { emailSchema } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';

export class Email {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<Email, DomainError> {
        const parsed = emailSchema.safeParse(raw);
        return parsed.success ? ok(new Email(parsed.data)) : err(DomainError.validation('Invalid e-mail address'));
    }

    /** From storage (already normalised when it was written). */
    static rehydrate(value: string): Email {
        return new Email(value);
    }

    equals(other: Email): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
