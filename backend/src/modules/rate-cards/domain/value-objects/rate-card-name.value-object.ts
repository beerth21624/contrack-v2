// ─── Rate-card name: trimmed, 1–60 characters (the contract's rateCardNameSchema); unique per workspace, ignoring case ───
import { RATE_CARD_NAME_MAX } from '@contrack/contract';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

export class RateCardName {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<RateCardName, DomainError> {
        const value = raw.trim();
        if (value.length === 0) return err(DomainError.validation('The rate card name is required'));
        if (value.length > RATE_CARD_NAME_MAX) {
            return err(DomainError.validation(`The rate card name is longer than ${RATE_CARD_NAME_MAX} characters`));
        }
        return ok(new RateCardName(value));
    }

    /** What uniqueness compares (PostgreSQL's `lower(name)` in the unique index). */
    get key(): string {
        return this.value.toLowerCase();
    }

    equals(other: RateCardName): boolean {
        return this.value === other.value;
    }

    /** Same name ignoring case ("Team A" and "team a" may not both be active). */
    sameKey(other: RateCardName): boolean {
        return this.key === other.key;
    }
}
