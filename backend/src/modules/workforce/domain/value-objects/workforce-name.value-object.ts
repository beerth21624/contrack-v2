// ─── Name of a person or a crew: trimmed, 1–80 characters (the contract's WORKFORCE_NAME_MAX) ───
// Crew names are unique per workspace among active crews, ignoring case; people may share a name.
import { WORKFORCE_NAME_MAX } from '@contrack/contract';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

export type NameOf = 'person' | 'crew';

export class WorkforceName {
    private constructor(readonly value: string) {}

    static create(raw: string, of: NameOf): Result<WorkforceName, DomainError> {
        const value = raw.trim();
        if (value.length === 0) return err(DomainError.validation(`The ${of} name is required`));
        if (value.length > WORKFORCE_NAME_MAX) {
            return err(DomainError.validation(`The ${of} name is longer than ${WORKFORCE_NAME_MAX} characters`));
        }
        return ok(new WorkforceName(value));
    }

    /** What crew-name uniqueness compares (PostgreSQL's `lower(name)` in the crews_name_key unique index). */
    get key(): string {
        return this.value.toLowerCase();
    }

    equals(other: WorkforceName): boolean {
        return this.value === other.value;
    }

    sameKey(other: WorkforceName): boolean {
        return this.key === other.key;
    }
}
