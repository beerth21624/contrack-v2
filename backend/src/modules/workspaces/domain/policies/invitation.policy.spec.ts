import { ASSIGNABLE_ROLES, ROLES, type AssignableRole, type Role } from '@contrack/contract';
import { checkInvitation } from './invitation.policy';

const ASSIGNABLE: readonly AssignableRole[] = ASSIGNABLE_ROLES;

const outcome = (inviterRole: Role, role: AssignableRole, kind: 'company' | 'personal' = 'company'): string => {
    const r = checkInvitation({ kind, inviterRole, role });
    return r.ok ? 'ok' : r.error.code;
};

const ALL_OK: Record<AssignableRole, string> = {
    admin: 'ok', estimator: 'ok', viewer: 'ok', pm: 'ok', purchasing: 'ok', accounting: 'ok', foreman: 'ok',
};
const NONE: Record<AssignableRole, string> = {
    admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden',
    pm: 'forbidden', purchasing: 'forbidden', accounting: 'forbidden', foreman: 'forbidden',
};

/** [inviter][invited role], written out by hand: only owner and admin invite (members.invite); every role up to admin. */
const MATRIX: Record<Role, Record<AssignableRole, string>> = {
    owner: ALL_OK,
    admin: ALL_OK,
    estimator: NONE,
    viewer: NONE,
    pm: NONE,
    purchasing: NONE,
    accounting: NONE,
    foreman: NONE,
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
