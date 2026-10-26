import { ROLES } from '@contrack/contract';
import { countOwners, wouldLeaveNoOwner } from './owners.policy';

describe('countOwners', () => {
    it('counts only owners', () => {
        expect(countOwners([])).toBe(0);
        expect(countOwners([{ role: 'owner' }, { role: 'admin' }, { role: 'owner' }, { role: 'viewer' }])).toBe(2);
        expect(countOwners([{ role: 'admin' }, { role: 'estimator' }])).toBe(0);
    });
});

describe('wouldLeaveNoOwner', () => {
    it('is true only when the last owner loses ownership', () => {
        expect(wouldLeaveNoOwner('owner', 'admin', 1)).toBe(true);
        expect(wouldLeaveNoOwner('owner', null, 1)).toBe(true);
        expect(wouldLeaveNoOwner('owner', null, 0)).toBe(true);
        expect(wouldLeaveNoOwner('owner', 'owner', 1)).toBe(false);
        expect(wouldLeaveNoOwner('owner', 'viewer', 2)).toBe(false);
        expect(wouldLeaveNoOwner('owner', null, 2)).toBe(false);
    });

    it.each(ROLES.filter(r => r !== 'owner'))('never for a %s', role => {
        expect(wouldLeaveNoOwner(role, null, 1)).toBe(false);
        expect(wouldLeaveNoOwner(role, 'viewer', 0)).toBe(false);
    });
});
