// ─── A new password in clear text (only ever hashed, never stored or logged) ───
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';

export class PlainPassword {
    private constructor(readonly value: string) {}

    /** Length rules from the contract; not trimmed (spaces are part of a password). */
    static create(raw: string): Result<PlainPassword, DomainError> {
        if (raw.length < PASSWORD_MIN_LENGTH) {
            return err(DomainError.validation(`Password must have at least ${PASSWORD_MIN_LENGTH} characters`));
        }
        if (raw.length > PASSWORD_MAX_LENGTH) {
            return err(DomainError.validation(`Password must have at most ${PASSWORD_MAX_LENGTH} characters`));
        }
        return ok(new PlainPassword(raw));
    }

    /** Never leaks into logs or JSON. */
    toString(): string {
        return '[password]';
    }

    toJSON(): string {
        return '[password]';
    }
}
