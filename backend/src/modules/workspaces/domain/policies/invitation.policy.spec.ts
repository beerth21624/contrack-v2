import { ROLES, type AssignableRole, type Role } from '@contrack/contract';
import { checkInvitation } from './invitation.policy';

const ASSIGNABLE: readonly AssignableRole[] = ['admin', 'estimator', 'viewer'];

const outcome = (inviterRole: Role, role: AssignableRole, kind: 'company' | 'personal' = 'company'): string => {
    const r = checkInvitation({ kind, inviterRole, role });
    return r.ok ? 'ok' : r.error.code;
};

/** [inviter][invited role], written out by hand. */
const MATRIX: Record<Role, Record<AssignableRole, string>> = {
    owner: { admin: 'ok', estimator: 'ok', viewer: 'ok' },
    admin: { admin: 'ok', estimator: 'ok', viewer: 'ok' },
    estimator: { admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
    viewer: { admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
};

const cases = ROLES.flatMap(inviter => ASSIGNABLE.map(role => [inviter, role] as const));

describe('checkInvitation', () => {
    it.each(cases)('company: %s invites as %s', (inviter, role) => {
        expect(outcome(inviter, role)).toBe(MATRIX[inviter][role]);
    });

    it.each(cases)('personal: %s invites as %s → personal_workspace', (inviter, role) => {
        expect(outcome(inviter, role, 'personal')).toBe('personal_workspace');
    });
});
