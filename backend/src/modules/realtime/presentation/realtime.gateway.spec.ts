import type { Ack as AckReply, PresenceStateEvent, Role } from '@contrack/contract';
import {
    AccessTokenVerifier, type AuthenticatedUser, ProjectDirectory, UserDirectory, type UserProfile, WorkspaceAccess,
} from '../../../shared/application/ports';
import { type ProjectId, type UserId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../shared/domain/ids';
import { FixedClock } from '../../../shared/infrastructure/system';
import { RealtimeInstance } from '../application/ports/realtime-instance.port';
import { PresenceService } from '../application/services/presence.service';
import { ProjectViewAccess } from '../application/services/project-view-access.service';
import { InMemoryRealtimeBus } from '../infrastructure/adapters/in-memory-realtime-bus.adapter';
import { ManualScheduler, RecordingBroadcaster } from '../testing/realtime-fakes';
import { ACCESS_RECHECK_MS, RealtimeGateway } from './realtime.gateway';
import type { RealtimeSocket, RealtimeSocketData } from './realtime-socket';
import { SocketIoBroadcaster } from './socket-io.broadcaster';

const ALICE = asUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const MALLORY = asUserId('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
const WS = asWorkspaceId('99999999-9999-4999-8999-999999999999');
const OTHER_WS = asWorkspaceId('88888888-8888-4888-8888-888888888888');
const PROJECT = asProjectId('11111111-1111-4111-8111-111111111111');
const OTHER_TENANT_PROJECT = asProjectId('22222222-2222-4222-8222-222222222222');
const MISSING_PROJECT = '33333333-3333-4333-8333-333333333333';
const ROOM = `project:${PROJECT}`;

class FakeVerifier extends AccessTokenVerifier {
    verify(token: string): Promise<AuthenticatedUser | undefined> {
        const users: Record<string, UserId> = { 'alice-token': ALICE, 'mallory-token': MALLORY };
        const userId = users[token];
        return Promise.resolve(userId === undefined ? undefined : { userId });
    }
}

class FakeProjects extends ProjectDirectory {
    workspaceOf(projectId: ProjectId): Promise<WorkspaceId | undefined> {
        if (projectId === PROJECT) return Promise.resolve(WS);
        if (projectId === OTHER_TENANT_PROJECT) return Promise.resolve(OTHER_WS);
        return Promise.resolve(undefined);
    }
}

class FakeAccess extends WorkspaceAccess {
    readonly roles = new Map<string, Role>([[`${ALICE}/${WS}`, 'viewer']]);

    roleOf(userId: UserId, workspaceId: WorkspaceId): Promise<Role | undefined> {
        return Promise.resolve(this.roles.get(`${userId}/${workspaceId}`));
    }
}

class FakeUsers extends UserDirectory {
    findMany(ids: readonly UserId[]): Promise<Map<UserId, UserProfile>> {
        const all = new Map<UserId, UserProfile>([[ALICE, { id: ALICE, email: 'alice@example.com', displayName: 'Alice' }]]);
        return Promise.resolve(new Map(ids.flatMap(id => {
            const profile = all.get(id);
            return profile === undefined ? [] : [[id, profile] as const];
        })));
    }
}

class FakeSocket {
    connected = true;
    data: RealtimeSocketData = {};
    readonly rooms = new Set<string>();
    readonly handshake: { auth: Record<string, unknown>; headers: Record<string, string> };
    readonly disconnect = jest.fn(() => {
        this.connected = false;
        return this;
    });

    constructor(readonly id: string, auth: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
        this.handshake = { auth, headers };
        this.rooms.add(id);
    }

    join(room: string): void {
        this.rooms.add(room);
    }

    leave(room: string): void {
        this.rooms.delete(room);
    }

    get socket(): RealtimeSocket {
        return this as unknown as RealtimeSocket;
    }
}

function setup() {
    const clock = new FixedClock();
    const broadcaster = new RecordingBroadcaster();
    const workspaceAccess = new FakeAccess();
    const presence = new PresenceService(clock, broadcaster, new InMemoryRealtimeBus(), new RealtimeInstance('i1'), new ManualScheduler());
    const gateway = new RealtimeGateway(
        new FakeVerifier(),
        new ProjectViewAccess(new FakeProjects(), workspaceAccess, new FakeUsers()),
        presence,
        new SocketIoBroadcaster(),
        clock,
    );
    return { gateway, presence, broadcaster, clock, workspaceAccess };
}

async function connected(gateway: RealtimeGateway, id = 's1', token = 'alice-token'): Promise<FakeSocket> {
    const socket = new FakeSocket(id, { token });
    await gateway.handleConnection(socket.socket);
    return socket;
}

const ackSpy = () => jest.fn<undefined, [AckReply]>();

describe('RealtimeGateway', () => {
    describe('handshake', () => {
        it('disconnects a socket with a bad token', async () => {
            const { gateway } = setup();
            const socket = new FakeSocket('s1', { token: 'forged' });
            await gateway.handleConnection(socket.socket);
            expect(socket.disconnect).toHaveBeenCalledWith(true);
            expect(socket.data.userId).toBeUndefined();
        });

        it('disconnects a socket without a token', async () => {
            const { gateway } = setup();
            const socket = new FakeSocket('s1');
            await gateway.handleConnection(socket.socket);
            expect(socket.disconnect).toHaveBeenCalled();
        });

        it('accepts the token from handshake auth and remembers the user', async () => {
            const { gateway } = setup();
            const socket = await connected(gateway);
            expect(socket.disconnect).not.toHaveBeenCalled();
            expect(socket.data.userId).toBe(ALICE);
        });

        it('falls back to the Authorization header', async () => {
            const { gateway } = setup();
            const socket = new FakeSocket('s1', {}, { authorization: 'Bearer alice-token' });
            await gateway.handleConnection(socket.socket);
            expect(socket.disconnect).not.toHaveBeenCalled();
            expect(socket.data.userId).toBe(ALICE);
        });
    });

    describe('project.join', () => {
        it('joins the room, acks ok and sends the presence state', async () => {
            const { gateway, broadcaster } = setup();
            const socket = await connected(gateway);
            const ack = ackSpy();

            await gateway.onJoin(socket.socket, { projectId: PROJECT }, ack);

            expect(ack).toHaveBeenCalledWith({ ok: true });
            expect(socket.rooms.has(ROOM)).toBe(true);
            const state = broadcaster.last('presence.state');
            expect(state?.room).toBe(ROOM);
            expect((state?.payload as PresenceStateEvent).users.map(u => [u.userId, u.displayName])).toEqual([[ALICE, 'Alice']]);
        });

        it('answers not_found for another tenant\'s project and for a missing one', async () => {
            const { gateway, broadcaster } = setup();
            const socket = await connected(gateway);
            for (const projectId of [OTHER_TENANT_PROJECT, MISSING_PROJECT]) {
                const ack = ackSpy();
                await gateway.onJoin(socket.socket, { projectId }, ack);
                expect(ack).toHaveBeenCalledWith({ ok: false, code: 'not_found' });
            }
            expect([...socket.rooms]).toEqual(['s1']);
            expect(broadcaster.emitted).toEqual([]);
        });

        it('answers not_found to a user who is not a member', async () => {
            const { gateway } = setup();
            const socket = await connected(gateway, 's2', 'mallory-token');
            const ack = ackSpy();
            await gateway.onJoin(socket.socket, { projectId: PROJECT }, ack);
            expect(ack).toHaveBeenCalledWith({ ok: false, code: 'not_found' });
            expect(socket.rooms.has(ROOM)).toBe(false);
        });

        it('rejects an invalid payload', async () => {
            const { gateway } = setup();
            const socket = await connected(gateway);
            const ack = ackSpy();
            await gateway.onJoin(socket.socket, { projectId: 'not-a-uuid' }, ack);
            expect(ack).toHaveBeenCalledWith({ ok: false, code: 'validation_failed' });
        });

        it('answers unauthenticated on a socket without a user', async () => {
            const { gateway } = setup();
            const socket = new FakeSocket('s1');
            const ack = ackSpy();
            await gateway.onJoin(socket.socket, { projectId: PROJECT }, ack);
            expect(ack).toHaveBeenCalledWith({ ok: false, code: 'unauthenticated' });
        });
    });

    describe('presence.update', () => {
        it('answers not_found before the socket joined the project', async () => {
            const { gateway, presence } = setup();
            const socket = await connected(gateway);
            const ack = ackSpy();
            await gateway.onPresenceUpdate(socket.socket, { projectId: PROJECT, levelId: 'roof' }, ack);
            expect(ack).toHaveBeenCalledWith({ ok: false, code: 'not_found' });
            expect(presence.snapshot(PROJECT)).toEqual([]);
        });

        it('updates the level of a joined socket', async () => {
            const { gateway, presence } = setup();
            const socket = await connected(gateway);
            await gateway.onJoin(socket.socket, { projectId: PROJECT }, ackSpy());
            const ack = ackSpy();

            await gateway.onPresenceUpdate(socket.socket, { projectId: PROJECT, levelId: 'roof' }, ack);

            expect(ack).toHaveBeenCalledWith({ ok: true });
            expect(presence.snapshot(PROJECT)[0]?.levelId).toBe('roof');
        });

        it('rejects a bad level id', async () => {
            const { gateway } = setup();
            const socket = await connected(gateway);
            await gateway.onJoin(socket.socket, { projectId: PROJECT }, ackSpy());
            const ack = ackSpy();
            await gateway.onPresenceUpdate(socket.socket, { projectId: PROJECT, levelId: 'Not Valid!' }, ack);
            expect(ack).toHaveBeenCalledWith({ ok: false, code: 'validation_failed' });
        });

        it('re-checks access after a minute and drops a user who lost it', async () => {
            const { gateway, presence, clock, workspaceAccess } = setup();
            const socket = await connected(gateway);
            await gateway.onJoin(socket.socket, { projectId: PROJECT }, ackSpy());

            workspaceAccess.roles.clear(); // removed from the workspace
            clock.advance(ACCESS_RECHECK_MS - 1);
            const before = ackSpy();
            await gateway.onPresenceUpdate(socket.socket, { projectId: PROJECT, levelId: null }, before);
            expect(before).toHaveBeenCalledWith({ ok: true }); // not re-checked yet

            clock.advance(ACCESS_RECHECK_MS);
            const after = ackSpy();
            await gateway.onPresenceUpdate(socket.socket, { projectId: PROJECT, levelId: null }, after);
            expect(after).toHaveBeenCalledWith({ ok: false, code: 'not_found' });
            expect(socket.rooms.has(ROOM)).toBe(false);
            expect(presence.snapshot(PROJECT)).toEqual([]);
        });
    });

    describe('project.leave', () => {
        it('leaves the room and the presence', async () => {
            const { gateway, presence } = setup();
            const socket = await connected(gateway);
            await gateway.onJoin(socket.socket, { projectId: PROJECT }, ackSpy());
            const ack = ackSpy();

            await gateway.onLeave(socket.socket, { projectId: PROJECT }, ack);

            expect(ack).toHaveBeenCalledWith({ ok: true });
            expect(socket.rooms.has(ROOM)).toBe(false);
            expect(presence.snapshot(PROJECT)).toEqual([]);
        });

        it('answers not_found when the socket was not in the project', async () => {
            const { gateway } = setup();
            const socket = await connected(gateway);
            const ack = ackSpy();
            await gateway.onLeave(socket.socket, { projectId: PROJECT }, ack);
            expect(ack).toHaveBeenCalledWith({ ok: false, code: 'not_found' });
        });
    });

    describe('disconnect', () => {
        it('removes the presence of the closed socket and tells the room', async () => {
            const { gateway, presence, broadcaster } = setup();
            const tab1 = await connected(gateway, 's1');
            const tab2 = await connected(gateway, 's2');
            await gateway.onJoin(tab1.socket, { projectId: PROJECT }, ackSpy());
            await gateway.onJoin(tab2.socket, { projectId: PROJECT }, ackSpy());

            await gateway.handleDisconnect(tab1.socket);
            expect(presence.snapshot(PROJECT)).toHaveLength(1); // the other tab keeps Alice there

            await gateway.handleDisconnect(tab2.socket);
            expect(presence.snapshot(PROJECT)).toEqual([]);
            expect((broadcaster.last('presence.state')?.payload as PresenceStateEvent).users).toEqual([]);
        });
    });
});
