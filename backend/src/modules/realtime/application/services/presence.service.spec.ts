import { PRESENCE_TTL_MS, type PresenceStateEvent } from '@contrack/contract';
import { asProjectId, asUserId } from '../../../../shared/domain/ids';
import { FixedClock } from '../../../../shared/infrastructure/system';
import { InMemoryRealtimeBus } from '../../infrastructure/adapters/in-memory-realtime-bus.adapter';
import { ManualScheduler, RecordingBroadcaster } from '../../testing/realtime-fakes';
import type { BusMessage } from '../ports/realtime-bus.port';
import { RealtimeInstance } from '../ports/realtime-instance.port';
import { PresenceService, type PresenceViewer } from './presence.service';

const P1 = asProjectId('11111111-1111-4111-8111-111111111111');
const P2 = asProjectId('22222222-2222-4222-8222-222222222222');
const ROOM1 = `project:${P1}`;
const ALICE = asUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const BOB = asUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

const alice = (connectionId = 'a1'): PresenceViewer => ({ connectionId, userId: ALICE, displayName: 'Alice' });
const bob = (connectionId = 'b1'): PresenceViewer => ({ connectionId, userId: BOB, displayName: 'Bob' });

function lastState(broadcaster: RecordingBroadcaster): PresenceStateEvent | undefined {
    return broadcaster.last('presence.state')?.payload as PresenceStateEvent | undefined;
}

function names(broadcaster: RecordingBroadcaster): string[] {
    return (lastState(broadcaster)?.users ?? []).map(u => u.displayName);
}

function setup(bus = new InMemoryRealtimeBus(), clock = new FixedClock(), id = 'instance-a') {
    const broadcaster = new RecordingBroadcaster();
    const scheduler = new ManualScheduler();
    const service = new PresenceService(clock, broadcaster, bus, new RealtimeInstance(id), scheduler);
    return { bus, clock, broadcaster, scheduler, service };
}

describe('PresenceService', () => {
    it('broadcasts the room state when someone joins', async () => {
        const { service, broadcaster, clock } = setup();
        await service.start();
        await service.join(alice(), P1);

        expect(broadcaster.last('presence.state')).toEqual({
            room: ROOM1,
            event: 'presence.state',
            payload: { projectId: P1, users: [{ userId: ALICE, displayName: 'Alice', levelId: null, seenAt: clock.now().toISOString() }] },
        });
    });

    it('shows a user with two tabs once, and still tells the room when the second tab joins', async () => {
        const { service, broadcaster } = setup();
        await service.join(alice('tab1'), P1);
        await service.join(alice('tab2'), P1);

        expect(broadcaster.of('presence.state')).toHaveLength(2);
        expect(names(broadcaster)).toEqual(['Alice']);
    });

    it('broadcasts a level change but not a heartbeat that changes nothing', async () => {
        const { service, broadcaster, clock } = setup();
        await service.join(alice(), P1);
        broadcaster.clear();

        clock.advance(15_000);
        await service.update(alice(), P1, null);
        expect(broadcaster.emitted).toEqual([]);

        await service.update(alice(), P1, 'roof');
        expect(lastState(broadcaster)?.users[0]?.levelId).toBe('roof');
        expect(service.snapshot(P1)[0]?.seenAt).toBe(clock.now().toISOString());
    });

    it('re-adds a connection on heartbeat after the sweeper forgot it', async () => {
        const { service, clock } = setup();
        await service.join(alice(), P1);
        clock.advance(PRESENCE_TTL_MS + 1);
        await service.sweep();
        expect(service.snapshot(P1)).toEqual([]);

        await service.update(alice(), P1, 'level-1');
        expect(service.snapshot(P1)).toEqual([
            { userId: ALICE, displayName: 'Alice', levelId: 'level-1', seenAt: clock.now().toISOString() },
        ]);
    });

    it('sweeper: expires connections without heartbeat after PRESENCE_TTL_MS and broadcasts the new state', async () => {
        const { service, broadcaster, clock, scheduler } = setup();
        await service.start();
        expect(scheduler.scheduled).toBe(1);
        await service.join(alice(), P1);
        clock.advance(10_000);
        await service.join(bob(), P1);
        broadcaster.clear();

        clock.advance(PRESENCE_TTL_MS - 10_000);
        scheduler.tick();
        expect(broadcaster.emitted).toEqual([]); // Alice is exactly at the TTL: still there

        clock.advance(1);
        scheduler.tick();
        expect(names(broadcaster)).toEqual(['Bob']);

        service.stop();
        expect(scheduler.scheduled).toBe(0);
    });

    it('leave and disconnect remove the connection and tell the room', async () => {
        const { service, broadcaster } = setup();
        await service.join(alice(), P1);
        await service.join(alice(), P2);
        await service.join(bob(), P1);

        await service.leave('b1', P1);
        expect(names(broadcaster)).toEqual(['Alice']);
        broadcaster.clear();
        await service.leave('b1', P1); // not there any more: nothing to tell
        expect(broadcaster.emitted).toEqual([]);

        await service.disconnect('a1');
        expect(broadcaster.of('presence.state').map(e => e.room).sort()).toEqual([ROOM1, `project:${P2}`].sort());
        expect(service.snapshot(P1)).toEqual([]);
        expect(service.snapshot(P2)).toEqual([]);
    });

    it('shares presence over the bus', async () => {
        const { service, bus } = setup();
        const published: BusMessage[] = [];
        bus.subscribe(m => { published.push(m); });
        await service.join(alice(), P1);
        expect(published).toContainEqual(expect.objectContaining({
            kind: 'presence.sync', origin: 'instance-a', projectId: P1,
            connections: [expect.objectContaining({ connectionId: 'a1', userId: ALICE, levelId: null })],
        }));
    });

    describe('with two server instances', () => {
        it('shows users connected to the other instance and forgets them when they leave', async () => {
            const bus = new InMemoryRealtimeBus();
            const clock = new FixedClock();
            const a = setup(bus, clock, 'instance-a');
            const b = setup(bus, clock, 'instance-b');
            await a.service.start();
            await b.service.start();

            await a.service.join(alice(), P1);
            expect(names(b.broadcaster)).toEqual(['Alice']);

            await b.service.join(bob(), P1);
            expect(names(a.broadcaster)).toEqual(['Alice', 'Bob']);
            expect(names(b.broadcaster)).toEqual(['Alice', 'Bob']);

            await a.service.disconnect('a1');
            expect(names(b.broadcaster)).toEqual(['Bob']);
        });

        it('a starting instance learns the presence of the others', async () => {
            const bus = new InMemoryRealtimeBus();
            const a = setup(bus, new FixedClock(), 'instance-a');
            await a.service.start();
            await a.service.join(alice(), P1);

            const b = setup(bus, new FixedClock(), 'instance-b');
            await b.service.start();

            expect(b.service.snapshot(P1).map(u => u.displayName)).toEqual(['Alice']);
        });

        it('expires the users of an instance that stopped sending heartbeats', async () => {
            const bus = new InMemoryRealtimeBus();
            const clock = new FixedClock();
            const a = setup(bus, clock, 'instance-a');
            const b = setup(bus, clock, 'instance-b');
            await a.service.start();
            await b.service.start();
            await a.service.join(alice(), P1);
            a.service.stop(); // instance A is gone

            clock.advance(PRESENCE_TTL_MS + 1);
            await b.service.sweep();
            expect(b.service.snapshot(P1)).toEqual([]);
            expect(lastState(b.broadcaster)?.users).toEqual([]);
        });
    });
});
