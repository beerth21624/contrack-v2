// ─── Rate-card note: optional, trimmed, empty → null, at most 500 characters (the contract's rateCardNoteSchema) ───
import { RATE_CARD_NOTE_MAX } from '@contrack/contract';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

export function rateCardNote(raw: string | undefined | null): Result<string | null, DomainError> {
    const value = raw?.trim() ?? '';
    if (value.length > RATE_CARD_NOTE_MAX) {
        return err(DomainError.validation(`The note is longer than ${RATE_CARD_NOTE_MAX} characters`));
    }
    return ok(value === '' ? null : value);
}
