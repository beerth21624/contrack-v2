// ─── Revision label: trimmed, 1–40 characters, unique per project (uniqueness is checked by the repository) ───
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

export const REVISION_LABEL_MAX = 40;
export const REVISION_NOTE_MAX = 2000;

export class RevisionLabel {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<RevisionLabel, DomainError> {
        const value = raw.trim();
        if (value.length === 0) return err(DomainError.validation('The revision label is required'));
        if (value.length > REVISION_LABEL_MAX) {
            return err(DomainError.validation(`The revision label is longer than ${REVISION_LABEL_MAX} characters`));
        }
        return ok(new RevisionLabel(value));
    }
}

/** An optional note: trimmed, empty → null, at most 2000 characters. */
export function revisionNote(raw: string | undefined | null): Result<string | null, DomainError> {
    const value = raw?.trim() ?? '';
    if (value.length > REVISION_NOTE_MAX) {
        return err(DomainError.validation(`The note is longer than ${REVISION_NOTE_MAX} characters`));
    }
    return ok(value === '' ? null : value);
}
