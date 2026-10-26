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

/**
 * Expected outcome of [actor][target][newRole] in a company workspace with two owners (no last-owner effect).
 * Written out by hand so the matrix is reviewed, not derived from the implementation.
 */
const MATRIX: Record<Role, Record<Role, Record<Role, Outcome>>> = {
    owner: {
        owner: { owner: 'ok', admin: 'ok', estimator: 'ok', viewer: 'ok' },
        admin: { owner: 'ok', admin: 'ok', estimator: 'ok', viewer: 'ok' },
        estimator: { owner: 'ok', admin: 'ok', estimator: 'ok', viewer: 'ok' },
        viewer: { owner: 'ok', admin: 'ok', estimator: 'ok', viewer: 'ok' },
    },
    admin: {
        owner: { owner: 'forbidden', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
        admin: { owner: 'forbidden', admin: 'ok', estimator: 'ok', viewer: 'ok' },
        estimator: { owner: 'forbidden', admin: 'ok', estimator: 'ok', viewer: 'ok' },
        viewer: { owner: 'forbidden', admin: 'ok', estimator: 'ok', viewer: 'ok' },
    },
    estimator: {
        owner: { owner: 'forbidden', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
        admin: { owner: 'forbidden', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
        estimator: { owner: 'forbidden', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
        viewer: { owner: 'forbidden', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
    },
    viewer: {
        owner: { owner: 'forbidden', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
        admin: { owner: 'forbidden', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
        estimator: { owner: 'forbidden', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
        viewer: { owner: 'forbidden', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden' },
    },
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
