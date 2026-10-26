import { asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import { Membership } from './membership.entity';

const workspaceId = asWorkspaceId('00000000-0000-4000-8000-000000000001');
const userId = asUserId('00000000-0000-4000-8000-000000000002');
const joinedAt = new Date('2026-01-01T00:00:00.000Z');

describe('Membership', () => {
    it('creates with a role', () => {
        const m = Membership.create({ workspaceId, userId, role: 'owner', joinedAt });
        expect(m.workspaceId).toBe(workspaceId);
        expect(m.userId).toBe(userId);
        expect(m.role).toBe('owner');
        expect(m.isOwner).toBe(true);
        expect(m.joinedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('changes role', () => {
        const m = Membership.create({ workspaceId, userId, role: 'owner', joinedAt });
        m.changeRole('viewer');
        expect(m.role).toBe('viewer');
        expect(m.isOwner).toBe(false);
        expect(m.toProps().role).toBe('viewer');
    });

    it('rehydrates from props', () => {
        const m = Membership.rehydrate({ workspaceId, userId, role: 'estimator', joinedAt });
        expect(m.toProps()).toEqual({ workspaceId, userId, role: 'estimator', joinedAt });
    });
});
