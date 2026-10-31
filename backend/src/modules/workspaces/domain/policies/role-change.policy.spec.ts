import { ROLES, type Role } from '@contrack/contract';
import { asUserId } from '../../../../shared/domain/ids';
import { checkRoleChange } from './role-change.policy';

const ACTOR = asUserId('00000000-0000-4000-8000-00000000000a');
const TARGET = asUserId('00000000-0000-4000-8000-00000000000b');

type Outcome = 'ok' | 'forbidden' | 'last_owner' | 'personal_workspace';

const outcome = (r: ReturnType<typeof checkRoleChange>): Outcome => (r.ok ? 'ok' : r.error.code as Outcome);

const change = (actorRole: Role, targetRole: Role, newRole: Role, ownerCount: number, self = false): Outcome => outcome(checkRoleChange({
    kind: 'company',
    actor: { userId: ACTOR, role: actorRole },
    target: { userId: self ? ACTOR : TARGET, role: self ? actorRole : targetRole },
    newRole,
    ownerCount,
}));

const F = 'forbidden' as const;
/** Every new role allowed / refused. */
const ALL: Record<Role, Outcome> = { owner: 'ok', admin: 'ok', estimator: 'ok', viewer: 'ok', pm: 'ok', purchasing: 'ok', accounting: 'ok', foreman: 'ok' };
const NONE: Record<Role, Outcome> = { owner: F, admin: F, estimator: F, viewer: F, pm: F, purchasing: F, accounting: F, foreman: F };
/** An admin may grant every role except owner. */
const BUT_OWNER: Record<Role, Outcome> = { ...ALL, owner: F };
const NOBODY: Record<Role, Record<Role, Outcome>> = {
    owner: NONE, admin: NONE, estimator: NONE, viewer: NONE, pm: NONE, purchasing: NONE, accounting: NONE, foreman: NONE,
};

/**
 * Expected outcome of [actor][target][newRole] in a company workspace with two owners (no last-owner effect).
 * Written out by hand so the matrix is reviewed, not derived from the implementation. The ERP roles (pm, purchasing,
 * accounting, foreman) are rank 1 without members.changeRole, like the estimator.
 */
const MATRIX: Record<Role, Record<Role, Record<Role, Outcome>>> = {
    owner: { owner: ALL, admin: ALL, estimator: ALL, viewer: ALL, pm: ALL, purchasing: ALL, accounting: ALL, foreman: ALL },
    admin: {
        owner: NONE,
        admin: BUT_OWNER, estimator: BUT_OWNER, viewer: BUT_OWNER,
        pm: BUT_OWNER, purchasing: BUT_OWNER, accounting: BUT_OWNER, foreman: BUT_OWNER,
    },
    estimator: NOBODY,
    viewer: NOBODY,
    pm: NOBODY,
    purchasing: NOBODY,
    accounting: NOBODY,
    foreman: NOBODY,
};

const cases = ROLES.flatMap(actor => ROLES.flatMap(target => ROLES.map(newRole => [actor, target, newRole] as const)));

describe('checkRoleChange', () => {
    describe('company workspace with two owners: every actor × target × new role', () => {
        it.each(cases)('%s changes %s to %s', (actor, target, newRole) => {
            expect(change(actor, target, newRole, 2)).toBe(MATRIX[actor][target][newRole]);
        });
    });

    describe('last owner', () => {
        it.each(['admin', 'estimator', 'viewer'] as const)('the only owner cannot demote themselves to %s', newRole => {
            expect(change('owner', 'owner', newRole, 1, true)).toBe('last_owner');
        });

        it('the only owner may "change" themselves to owner (no-op)', () => {
            expect(change('owner', 'owner', 'owner', 1, true)).toBe('ok');
        });

        it.each(['admin', 'estimator', 'viewer'] as const)('an owner may demote themselves to %s when another owner remains', newRole => {
            expect(change('owner', 'owner', newRole, 2, true)).toBe('ok');
        });

        it('a zero owner count (inconsistent read) still refuses to remove an owner', () => {
            expect(change('owner', 'owner', 'viewer', 0)).toBe('last_owner');
        });

        it('an owner may demote another owner when two remain', () => {
            expect(change('owner', 'owner', 'admin', 2)).toBe('ok');
        });

        it('an admin is refused before the last-owner rule (forbidden, not last_owner)', () => {
            expect(change('admin', 'owner', 'viewer', 1)).toBe('forbidden');
        });
    });

    describe('self changes', () => {
        it('an admin may demote themselves', () => {
            expect(change('admin', 'admin', 'viewer', 1, true)).toBe('ok');
        });

        it('an admin cannot promote themselves to owner', () => {
            expect(change('admin', 'admin', 'owner', 1, true)).toBe('forbidden');
        });

        it.each(['estimator', 'viewer'] as const)('a %s cannot change their own role', role => {
            expect(change(role, role, 'admin', 1, true)).toBe('forbidden');
            expect(change(role, role, 'viewer', 1, true)).toBe('forbidden');
        });
    });

    describe('personal workspace', () => {
        it.each(cases)('%s changing %s to %s → personal_workspace', (actor, target, newRole) => {
            const r = checkRoleChange({
                kind: 'personal',
                actor: { userId: ACTOR, role: actor },
                target: { userId: TARGET, role: target },
                newRole,
                ownerCount: 1,
            });
            expect(outcome(r)).toBe('personal_workspace');
        });
    });
});
