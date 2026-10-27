// ─── Daily rate: whole baht per day, 0–100,000 (the contract's dailyRateSchema) ───
import { RATE_CARD_RATE_MAX } from '@contrack/contract';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

export type RateKind = 'skilled' | 'labourer';

const LABEL: Record<RateKind, string> = { skilled: 'skilled rate', labourer: 'labourer rate' };

export class DailyRate {
    private constructor(readonly baht: number) {}

    static create(raw: number, kind: RateKind): Result<DailyRate, DomainError> {
        if (!Number.isInteger(raw)) return err(DomainError.validation(`The ${LABEL[kind]} must be a whole number of baht`));
        if (raw < 0 || raw > RATE_CARD_RATE_MAX) {
            return err(DomainError.validation(`The ${LABEL[kind]} must be between 0 and ${RATE_CARD_RATE_MAX} baht per day`));
        }
        return ok(new DailyRate(raw));
    }

    equals(other: DailyRate): boolean {
        return this.baht === other.baht;
    }
}
