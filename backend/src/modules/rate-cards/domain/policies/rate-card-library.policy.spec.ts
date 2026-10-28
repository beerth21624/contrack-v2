import { MAX_ACTIVE_RATE_CARDS, rateCardConflictDetailsSchema } from '@contrack/contract';
import { asRateCardId } from '../../../../shared/domain';
import { RateCardName } from '../value-objects/rate-card-name.value-object';
import { checkNameFree, checkRoomForAnotherCard } from './rate-card-library.policy';

const ID_1 = asRateCardId('00000000-0000-4000-8000-000000000001');
const ID_2 = asRateCardId('00000000-0000-4000-8000-000000000002');

function name(raw: string): RateCardName {
    const r = RateCardName.create(raw);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
}

describe('rate-card library policy', () => {
    it('room for one more card below the limit, conflict at the limit', () => {
        expect(checkRoomForAnotherCard(0).ok).toBe(true);
        expect(checkRoomForAnotherCard(MAX_ACTIVE_RATE_CARDS - 1).ok).toBe(true);
        const full = checkRoomForAnotherCard(MAX_ACTIVE_RATE_CARDS);
        if (full.ok) throw new Error('expected conflict');
        expect(full.error.code).toBe('conflict');
        expect(rateCardConflictDetailsSchema.parse(full.error.details)).toEqual({ reason: 'limit_reached', limit: MAX_ACTIVE_RATE_CARDS });
    });

    it('a name is free when nobody holds it, or the holder is the card itself', () => {
        expect(checkNameFree(name('A'), undefined).ok).toBe(true);
        expect(checkNameFree(name('A'), { id: ID_1 }, ID_1).ok).toBe(true);
    });

    it('a name held by another card is a conflict with name_taken details', () => {
        const taken = checkNameFree(name('Team A'), { id: ID_1 }, ID_2);
        if (taken.ok) throw new Error('expected conflict');
        expect(taken.error.code).toBe('conflict');
        expect(rateCardConflictDetailsSchema.parse(taken.error.details)).toEqual({ reason: 'name_taken', name: 'Team A' });
        expect(checkNameFree(name('Team A'), { id: ID_1 }).ok).toBe(false);
    });
});
