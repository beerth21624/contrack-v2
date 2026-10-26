// ─── Display name: trimmed, 1–80 characters (contract's displayNameSchema) ───
import { displayNameSchema } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';

export class DisplayName {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<DisplayName, DomainError> {
        const parsed = displayNameSchema.safeParse(raw);
        return parsed.success ? ok(new DisplayName(parsed.data)) : err(DomainError.validation('Invalid display name'));
    }

    static rehydrate(value: string): DisplayName {
        return new DisplayName(value);
    }

    toString(): string {
        return this.value;
    }
}
