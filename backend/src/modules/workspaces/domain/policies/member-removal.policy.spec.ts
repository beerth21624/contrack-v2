import { ROLES, type Role } from '@contrack/contract';
import { asUserId } from '../../../../shared/domain/ids';
import { checkMemberRemoval } from './member-removal.policy';

const ACTOR = asUserId('00000000-0000-4000-8000-00000000000a');
const TARGET = asUserId('00000000-0000-4000-8000-00000000000b');

type Outcome = 'ok' | 'forbidden' | 'last_owner' | 'personal_workspace';

const outcome = (r: ReturnType<typeof checkMemberRemoval>): Outcome => (r.ok ? 'ok' : r.error.code as Outcome);

const remove = (actorRole: Role, targetRole: Role, ownerCount: number): Outcome => outcome(checkMemberRemoval({
    kind: 'company',
    actor: { userId: ACTOR, role: actorRole },
    target: { userId: TARGET, role: targetRole },
    ownerCount,
}));

const leave = (role: Role, ownerCount: number, kind: 'company' | 'personal' = 'company'): Outcome => outcome(checkMemberRemoval({
    kind,
    actor: { userId: ACTOR, role },
    target: { userId: ACTOR, role },
    ownerCount,
}));

const F = 'forbidden' as const;
const NONE: Record<Role, Outcome> = { owner: F, admin: F, estimator: F, viewer: F, pm: F, purchasing: F, accounting: F, foreman: F };

/** [actor][target] with two owners, written out by hand (the ERP roles are rank 1 without members.remove). */
const MATRIX: Record<Role, Record<Role, Outcome>> = {
    owner: { owner: 'ok', admin: 'ok', estimator: 'ok', viewer: 'ok', pm: 'ok', purchasing: 'ok', accounting: 'ok', foreman: 'ok' },
    admin: { owner: F, admin: 'ok', estimator: 'ok', viewer: 'ok', pm: 'ok', purchasing: 'ok', accounting: 'ok', foreman: 'ok' },
    estimator: NONE,
    viewer: NONE,
    pm: NONE,
    purchasing: NONE,
    accounting: NONE,
    foreman: NONE,
};

const pairs = ROLES.flatMap(actor => ROLES.map(target => [actor, target] as const));

describe('checkMemberRemoval', () => {
    describe('removing someone else (two owners)', () => {
        it.each(pairs)('%s removes %s', (actor, target) => {
            expect(remove(actor, target, 2)).toBe(MATRIX[actor][target]);
        });
    });

    describe('leaving', () => {
        it.each(ROLES)('a %s may leave (two owners)', role => {
            expect(leave(role, 2)).toBe('ok');
        });

        it.each(['admin', 'estimator', 'viewer'] as const)('a %s may leave even when there is only one owner', role => {
            expect(leave(role, 1)).toBe('ok');
        });

        it('the last owner cannot leave', () => {
            expect(leave('owner', 1)).toBe('last_owner');
        });

        it('a zero owner count still refuses to remove an owner', () => {
            expect(leave('owner', 0)).toBe('last_owner');
        });
    });

    describe('last owner removed by someone else', () => {
        it('an owner cannot remove the only owner (inconsistent count, defensive)', () => {
            expect(remove('owner', 'owner', 1)).toBe('last_owner');
        });

        it('an admin is refused as forbidden before the last-owner rule', () => {
            expect(remove('admin', 'owner', 1)).toBe('forbidden');
        });
    });

    describe('personal workspace', () => {
        it.each(pairs)('%s removing %s → personal_workspace', (actor, target) => {
            const r = checkMemberRemoval({
                kind: 'personal',
                actor: { userId: ACTOR, role: actor },
                target: { userId: TARGET, role: target },
                ownerCount: 1,
            });
            expect(outcome(r)).toBe('personal_workspace');
        });

        it('the owner cannot leave their personal workspace', () => {
            expect(leave('owner', 1, 'personal')).toBe('personal_workspace');
        });
    });
});
