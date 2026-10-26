import { asProjectId, asUserId } from '../../../../shared/domain/ids';
import { type PresenceConnection, PresenceRoster } from './presence-roster.entity';

const P1 = asProjectId('11111111-1111-4111-8111-111111111111');
const P2 = asProjectId('22222222-2222-4222-8222-222222222222');
const ALICE = asUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const BOB = asUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const T0 = new Date('2026-01-01T00:00:00.000Z');
const at = (ms: number): Date => new Date(T0.getTime() + ms);

function conn(overrides: Partial<PresenceConnection> = {}): PresenceConnection {
    return {
        userId: ALICE, displayName: 'Alice', levelId: null, seenAt: T0, connectionId: 'c1', instanceId: 'i1', ...overrides,
    };
}

describe('PresenceRoster', () => {
    it('starts empty', () => {
        expect(PresenceRoster.create().snapshot(P1)).toEqual([]);
    });

    it('shows a user with two tabs once, with the level of the most recently seen tab', () => {
        const roster = PresenceRoster.create();
        roster.join(P1, conn({ connectionId: 'tab1', levelId: 'ground-floor', seenAt: at(0) }));
        roster.join(P1, conn({ connectionId: 'tab2', levelId: 'roof', seenAt: at(1_000) }));

        expect(roster.snapshot(P1)).toEqual([
            { userId: ALICE, displayName: 'Alice', levelId: 'roof', seenAt: at(1_000).toISOString() },
        ]);

        roster.update(P1, 'i1', 'tab1', { levelId: 'foundation', seenAt: at(2_000) });
        expect(roster.snapshot(P1)).toEqual([
            { userId: ALICE, displayName: 'Alice', levelId: 'foundation', seenAt: at(2_000).toISOString() },
        ]);
    });

    it('keeps the user while one of the tabs is still open', () => {
        const roster = PresenceRoster.create();
        roster.join(P1, conn({ connectionId: 'tab1' }));
        roster.join(P1, conn({ connectionId: 'tab2' }));
        expect(roster.leave(P1, 'i1', 'tab1')).toBe(true);
        expect(roster.snapshot(P1)).toHaveLength(1);
        expect(roster.leave(P1, 'i1', 'tab2')).toBe(true);
        expect(roster.snapshot(P1)).toEqual([]);
        expect(roster.leave(P1, 'i1', 'tab2')).toBe(false);
    });

    it('changes the level on update and refuses unknown connections', () => {
        const roster = PresenceRoster.create();
        roster.join(P1, conn());
        expect(roster.update(P1, 'i1', 'c1', { levelId: 'level-2', seenAt: at(5) })).toBe(true);
        expect(roster.snapshot(P1)[0]?.levelId).toBe('level-2');
        expect(roster.update(P1, 'i1', 'unknown', { levelId: null, seenAt: at(5) })).toBe(false);
        expect(roster.update(P2, 'i1', 'c1', { levelId: null, seenAt: at(5) })).toBe(false);
        expect(roster.update(P1, 'i2', 'c1', { levelId: null, seenAt: at(5) })).toBe(false);
    });

    it('treats the same socket id on two instances as two connections', () => {
        const roster = PresenceRoster.create();
        roster.join(P1, conn({ instanceId: 'i1' }));
        roster.join(P1, conn({ instanceId: 'i2', userId: BOB, displayName: 'Bob' }));
        expect(roster.snapshot(P1).map(e => e.displayName)).toEqual(['Alice', 'Bob']);
    });

    it('sorts by display name', () => {
        const roster = PresenceRoster.create();
        roster.join(P1, conn({ connectionId: 'c1', userId: BOB, displayName: 'bob' }));
        roster.join(P1, conn({ connectionId: 'c2', userId: ALICE, displayName: 'Alice' }));
        roster.join(P1, conn({ connectionId: 'c3', userId: asUserId('cccccccc-cccc-4ccc-8ccc-cccccccccccc'), displayName: 'Chris' }));
        expect(roster.snapshot(P1).map(e => e.displayName)).toEqual(['Alice', 'bob', 'Chris']);
    });

    it('expires connections not seen within the TTL and reports the affected projects', () => {
        const roster = PresenceRoster.create();
        roster.join(P1, conn({ connectionId: 'old', seenAt: at(0) }));
        roster.join(P1, conn({ connectionId: 'fresh', userId: BOB, displayName: 'Bob', seenAt: at(40_000) }));
        roster.join(P2, conn({ connectionId: 'other', seenAt: at(40_000) }));

        expect(roster.expire(at(45_000), 45_000)).toEqual([]);
        expect(roster.expire(at(45_001), 45_000)).toEqual([P1]);
        expect(roster.snapshot(P1).map(e => e.displayName)).toEqual(['Bob']);
        expect(roster.snapshot(P2)).toHaveLength(1);

        expect(roster.expire(at(100_000), 45_000).sort()).toEqual([P1, P2].sort());
        expect(roster.snapshot(P1)).toEqual([]);
        expect(roster.projectsOf('i1')).toEqual([]);
    });

    it('removes a closed socket from every project', () => {
        const roster = PresenceRoster.create();
        roster.join(P1, conn());
        roster.join(P2, conn());
        roster.join(P2, conn({ connectionId: 'c2', userId: BOB, displayName: 'Bob' }));
        expect(roster.leaveAll('i1', 'c1').sort()).toEqual([P1, P2].sort());
        expect(roster.snapshot(P1)).toEqual([]);
        expect(roster.snapshot(P2).map(e => e.displayName)).toEqual(['Bob']);
    });

    it('replaces what another instance reported, leaving other instances alone', () => {
        const roster = PresenceRoster.create();
        roster.join(P1, conn({ instanceId: 'local' }));
        roster.replaceInstance(P1, 'remote', [conn({ instanceId: 'remote', connectionId: 'r1', userId: BOB, displayName: 'Bob' })]);
        expect(roster.snapshot(P1).map(e => e.displayName)).toEqual(['Alice', 'Bob']);
        expect(roster.connectionsOf(P1, 'remote')).toHaveLength(1);

        roster.replaceInstance(P1, 'remote', []);
        expect(roster.snapshot(P1).map(e => e.displayName)).toEqual(['Alice']);
        expect(roster.connectionsOf(P1, 'local')).toHaveLength(1);
        expect(roster.projectsOf('local')).toEqual([P1]);
    });
});
