// â”€â”€â”€ E2E: Socket.IO /realtime â€” handshake auth, joining, presence (join/update/disconnect/TTL), live events â”€â”€â”€
import {
    PRESENCE_TTL_MS, type PresenceStateEvent, docUpdatedEventSchema, presenceStateEventSchema, projectDeletedEventSchema,
    projectDetailDtoSchema, projectUpdatedEventSchema,
} from '@contrack/contract';
import { JOURNEY_LEVELS } from '@contrack/domain/journey/levels';
import { asProjectId } from '../../src/shared/domain/ids';
import { PresenceService } from '../../src/modules/realtime/application/services/presence.service';
import { ACCESS_RECHECK_MS } from '../../src/modules/realtime/presentation/realtime.gateway';
import { SAMPLE_DOCS } from '../../src/modules/projects/testing/projects-test-kit';
import {
    type RealtimeClient, type Session, type TestApp, addMember, bearer, connect, createCompany, expectStatus, joinProject,
    nextEvent, recordEvents, register, sleep, startApp,
} from '../support/e2e';

const LEVEL = JOURNEY_LEVELS[0]?.id ?? '';

const userIds = (e: PresenceStateEvent): string[] => e.users.map(u => u.userId).sort();
const sameUsers = (ids: string[]) => (e: PresenceStateEvent): boolean =>
    JSON.stringify(userIds(e)) === JSON.stringify([...ids].sort());

describe('realtime (e2e)', () => {
    let t: TestApp;
    let owner: Session;
    let editor: Session;
    let viewer: Session;
    let outsider: Session;
    let workspaceId: string;
    const open: RealtimeClient[] = [];

    beforeAll(async () => {
        t = await startApp();
        owner = await register(t, 'Owner');
        editor = await register(t, 'Editor');
        viewer = await register(t, 'Viewer');
        outsider = await register(t, 'Outsider');
        workspaceId = (await createCompany(t, owner)).id;
        await addMember(t, owner, workspaceId, editor, 'estimator');
        await addMember(t, owner, workspaceId, viewer, 'viewer');
    });

    afterEach(() => {
        for (const s of open.splice(0)) s.disconnect();
    });

    afterAll(async () => {
        await t.close();
    });

    async function client(session: Session): Promise<RealtimeClient> {
        const socket = await connect(t, session.accessToken);
        open.push(socket);
        return socket;
    }

    async function newProject(): Promise<string> {
        const res = await t.http().post(`/workspaces/${workspaceId}/projects`).set(bearer(owner.accessToken))
            .send({ name: 'Live house', start: 'sample' });
        expectStatus(res, 201);
        return projectDetailDtoSchema.parse(res.body).project.id;
    }

    describe('handshake', () => {
        it('refuses a bad or missing token with connect_error', async () => {
            await expect(connect(t, 'not-a-token')).rejects.toThrow('unauthenticated');
            await expect(connect(t, undefined)).rejects.toThrow('unauthenticated');
            await expect(connect(t, `${owner.accessToken}x`)).rejects.toThrow('unauthenticated');
        });

        it('accepts a valid access token', async () => {
            const socket = await client(owner);
            expect(socket.connected).toBe(true);
        });
    });

    describe('project.join', () => {
        it('lets members join and answers presence.state with themselves', async () => {
            const projectId = await newProject();
            const socket = await client(viewer);
            const state = presenceStateEventSchema.parse(await joinProject(socket, projectId));
            expect(state.projectId).toBe(projectId);
            expect(state.users).toEqual([expect.objectContaining({ userId: viewer.userId, displayName: 'Viewer', levelId: null })]);
        });

        it('refuses outsiders, unknown projects and bad payloads', async () => {
            const projectId = await newProject();
            const socket = await client(outsider);
            expect(await socket.emitWithAck('project.join', { projectId })).toEqual({ ok: false, code: 'not_found' });
            expect(await socket.emitWithAck('project.join', { projectId: '0f0f0f0f-0000-4000-8000-0000000000aa' }))
                .toEqual({ ok: false, code: 'not_found' });
            expect(await socket.emitWithAck('project.join', { projectId: 'nope' })).toEqual({ ok: false, code: 'validation_failed' });

            // Not in the room: no events and no presence for the outsider.
            const docs = recordEvents(socket, 'doc.updated');
            expectStatus(await t.http().put(`/projects/${projectId}/docs/calc:fill`).set(bearer(owner.accessToken))
                .send({ data: SAMPLE_DOCS.fill.data, baseVersion: 0 }), 200);
            await sleep(150);
            expect(docs).toEqual([]);
            expect(await socket.emitWithAck('presence.update', { projectId, levelId: null })).toEqual({ ok: false, code: 'not_found' });
        });
    });

    describe('presence', () => {
        it('tracks joins, level updates, leaves and disconnects', async () => {
            const projectId = await newProject();
            const a = await client(owner);
            const b = await client(editor);
            await joinProject(a, projectId);

            const aSeesBoth = nextEvent(a, 'presence.state', sameUsers([owner.userId, editor.userId]));
            const bState = await joinProject(b, projectId);
            expect(userIds(bState)).toEqual([owner.userId, editor.userId].sort());
            await aSeesBoth;

            const aSeesLevel = nextEvent(a, 'presence.state', e => e.users.some(u => u.userId === editor.userId && u.levelId === LEVEL));
            expect(await b.emitWithAck('presence.update', { projectId, levelId: LEVEL })).toEqual({ ok: true });
            const withLevel = presenceStateEventSchema.parse(await aSeesLevel);
            expect(withLevel.users.find(u => u.userId === editor.userId)).toMatchObject({ displayName: 'Editor', levelId: LEVEL });
            expect(await b.emitWithAck('presence.update', { projectId, levelId: 'NOT A LEVEL' }))
                .toEqual({ ok: false, code: 'validation_failed' });

            const aAloneAfterLeave = nextEvent(a, 'presence.state', sameUsers([owner.userId]));
            expect(await b.emitWithAck('project.leave', { projectId })).toEqual({ ok: true });
            await aAloneAfterLeave;

            await joinProject(b, projectId);
            const aAloneAfterDisconnect = nextEvent(a, 'presence.state', sameUsers([owner.userId]));
            b.disconnect();
            await aAloneAfterDisconnect;
        });

        it('forgets a connection without a heartbeat for PRESENCE_TTL_MS', async () => {
            const presence = t.app.get(PresenceService);
            const projectId = await newProject();
            const a = await client(owner);
            const b = await client(editor);
            await joinProject(a, projectId);
            await joinProject(b, projectId);

            // A keeps beating, B goes silent.
            t.clock.advance(PRESENCE_TTL_MS - 15_000);
            expect(await a.emitWithAck('presence.update', { projectId, levelId: null })).toEqual({ ok: true });
            const expired = nextEvent(a, 'presence.state', sameUsers([owner.userId]));
            t.clock.advance(15_001);
            await presence.sweep();
            await expired;
            expect(presence.snapshot(asProjectId(projectId)).map(u => u.userId)).toEqual([owner.userId]);

            // B's next heartbeat brings it back (the socket is still in the room).
            const back = nextEvent(a, 'presence.state', sameUsers([owner.userId, editor.userId]));
            expect(await b.emitWithAck('presence.update', { projectId, levelId: null })).toEqual({ ok: true });
            await back;
        });
    });

    describe('live events', () => {
        it('sends A\'s document write to B as doc.updated with the new version, then project.updated', async () => {
            const projectId = await newProject();
            const a = await client(owner);
            const b = await client(editor);
            await joinProject(a, projectId);
            await joinProject(b, projectId);

            const docEvent = nextEvent(b, 'doc.updated', e => e.projectId === projectId);
            const projectEvent = nextEvent(b, 'project.updated', e => e.project.id === projectId);
            const res = await t.http().put(`/projects/${projectId}/docs/calc:fill`).set(bearer(owner.accessToken))
                .send({ data: SAMPLE_DOCS.fill.data, baseVersion: 0 });
            expectStatus(res, 200);

            const doc = docUpdatedEventSchema.parse(await docEvent);
            expect(doc.doc).toMatchObject({ docKey: 'calc:fill', version: 1, data: SAMPLE_DOCS.fill.data, updatedBy: owner.userId });
            const project = projectUpdatedEventSchema.parse(await projectEvent);
            expect(project.project.summary).toEqual((res.body as { project: { summary: unknown } }).project.summary);

            const second = nextEvent(b, 'doc.updated', e => e.doc.version === 2);
            expectStatus(await t.http().put(`/projects/${projectId}/docs/calc:fill`).set(bearer(editor.accessToken))
                .send({ data: null, baseVersion: 1 }), 200);
            expect((await second).doc).toMatchObject({ data: null, version: 2, updatedBy: editor.userId });
        });

        it('emits project.updated on rename and archive', async () => {
            const projectId = await newProject();
            const b = await client(viewer);
            await joinProject(b, projectId);

            const renamed = nextEvent(b, 'project.updated', e => e.project.name === 'Renamed live');
            expectStatus(await t.http().patch(`/projects/${projectId}`).set(bearer(owner.accessToken)).send({ name: 'Renamed live' }), 200);
            expect(projectUpdatedEventSchema.parse(await renamed).project).toMatchObject({ id: projectId, archivedAt: null });

            const archived = nextEvent(b, 'project.updated', e => e.project.archivedAt !== null);
            expectStatus(await t.http().patch(`/projects/${projectId}`).set(bearer(owner.accessToken)).send({ archived: true }), 200);
            await archived;

            // An unchanged value is a no-op: no event.
            const seen = recordEvents(b, 'project.updated');
            expectStatus(await t.http().patch(`/projects/${projectId}`).set(bearer(owner.accessToken)).send({ archived: true }), 200);
            await sleep(150);
            expect(seen).toEqual([]);
        });

        it('sends project.deleted and empties the room', async () => {
            const projectId = await newProject();
            const b = await client(viewer);
            await joinProject(b, projectId);

            const deleted = nextEvent(b, 'project.deleted');
            expectStatus(await t.http().delete(`/projects/${projectId}`).set(bearer(owner.accessToken)), 204);
            expect(projectDeletedEventSchema.parse(await deleted)).toEqual({ projectId });

            // The socket left the room: heartbeats for the project are refused and its presence is gone.
            expect(await b.emitWithAck('presence.update', { projectId, levelId: null })).toEqual({ ok: false, code: 'not_found' });
            expect(t.app.get(PresenceService).snapshot(asProjectId(projectId))).toEqual([]);
            // Re-joining a deleted project is refused.
            expect(await b.emitWithAck('project.join', { projectId })).toEqual({ ok: false, code: 'not_found' });
        });

        it('cuts off a user removed from the workspace at the next access re-check', async () => {
            const leaver = await register(t, 'Leaver');
            await addMember(t, owner, workspaceId, leaver, 'viewer');
            const projectId = await newProject();
            const a = await client(owner);
            const l = await client(leaver);
            await joinProject(a, projectId);
            await joinProject(l, projectId);

            expectStatus(await t.http().delete(`/workspaces/${workspaceId}/members/${leaver.userId}`).set(bearer(owner.accessToken)), 204);

            // Before the re-check is due the heartbeat still passes (both keep beating, so nobody expires).
            t.clock.advance(ACCESS_RECHECK_MS - 20_000);
            expect(await a.emitWithAck('presence.update', { projectId, levelId: null })).toEqual({ ok: true });
            expect(await l.emitWithAck('presence.update', { projectId, levelId: null })).toEqual({ ok: true });

            // At the re-check the heartbeat is refused and the socket is taken out of the room and the presence.
            t.clock.advance(20_000);
            const aAlone = nextEvent(a, 'presence.state', sameUsers([owner.userId]));
            expect(await l.emitWithAck('presence.update', { projectId, levelId: null })).toEqual({ ok: false, code: 'not_found' });
            await aAlone;

            const leaked = recordEvents(l, 'doc.updated');
            const delivered = nextEvent(a, 'doc.updated', e => e.projectId === projectId);
            expectStatus(await t.http().put(`/projects/${projectId}/docs/calc:fill`).set(bearer(owner.accessToken))
                .send({ data: SAMPLE_DOCS.fill.data, baseVersion: 0 }), 200);
            await delivered;
            await sleep(100);
            expect(leaked).toEqual([]);
            expect(await l.emitWithAck('project.join', { projectId })).toEqual({ ok: false, code: 'not_found' });
        });
    });
});
