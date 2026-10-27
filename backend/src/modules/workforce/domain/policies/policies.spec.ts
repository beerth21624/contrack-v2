import { MAX_ACTIVE_CREWS, MAX_ACTIVE_PEOPLE } from '@contrack/contract';
import { asCrewId } from '../../../../shared/domain';
import { WorkforceName } from '../value-objects/workforce-name.value-object';
import { crewDailyCost } from './crew-cost.policy';
import {
    checkCrewNameFree, checkNotInUse, checkRoomForAnotherCrew, checkRoomForAnotherPerson,
} from './workforce-library.policy';

const C1 = asCrewId('60000000-0000-4000-8000-000000000001');
const C2 = asCrewId('60000000-0000-4000-8000-000000000002');

describe('workforce library policy', () => {
    it('limits: people and crews', () => {
        expect(checkRoomForAnotherPerson(MAX_ACTIVE_PEOPLE - 1).ok).toBe(true);
        const people = checkRoomForAnotherPerson(MAX_ACTIVE_PEOPLE);
        expect(!people.ok && people.error.details).toEqual({ reason: 'limit_reached', limit: MAX_ACTIVE_PEOPLE });
        expect(checkRoomForAnotherCrew(MAX_ACTIVE_CREWS - 1).ok).toBe(true);
        const crews = checkRoomForAnotherCrew(MAX_ACTIVE_CREWS);
        expect(!crews.ok && crews.error.code).toBe('conflict');
        expect(!crews.ok && crews.error.details).toEqual({ reason: 'limit_reached', limit: MAX_ACTIVE_CREWS });
    });

    it('crew names: free, taken by another, kept by the crew itself', () => {
        const r = WorkforceName.create('ทีมทาสี', 'crew');
        if (!r.ok) throw new Error('bad name');
        expect(checkCrewNameFree(r.value, undefined).ok).toBe(true);
        const taken = checkCrewNameFree(r.value, { id: C1 });
        expect(!taken.ok && taken.error.details).toEqual({ reason: 'name_taken', name: 'ทีมทาสี' });
        expect(checkCrewNameFree(r.value, { id: C1 }, C1).ok).toBe(true);
        expect(checkCrewNameFree(r.value, { id: C1 }, C2).ok).toBe(false);
    });

    it('in use: any open assignment blocks archiving', () => {
        expect(checkNotInUse('crew', 0).ok).toBe(true);
        const used = checkNotInUse('person', 3);
        expect(!used.ok && used.error.code).toBe('conflict');
        expect(!used.ok && used.error.details).toEqual({ reason: 'in_use', assignments: 3 });
    });
});

describe('crewDailyCost', () => {
    const card = { skilledRate: 800, labourerRate: 500 };

    it('override wins, else the card prices the headcount, else null', () => {
        expect(crewDailyCost({ skilledCount: 2, labourerCount: 3, dailyCostOverride: 4000 }, card)).toBe(4000);
        expect(crewDailyCost({ skilledCount: 2, labourerCount: 3, dailyCostOverride: 0 }, card)).toBe(0);
        expect(crewDailyCost({ skilledCount: 2, labourerCount: 3, dailyCostOverride: null }, card)).toBe(2 * 800 + 3 * 500);
        expect(crewDailyCost({ skilledCount: 0, labourerCount: 0, dailyCostOverride: null }, card)).toBe(0);
        expect(crewDailyCost({ skilledCount: 2, labourerCount: 3, dailyCostOverride: null }, undefined)).toBeNull();
    });
});
