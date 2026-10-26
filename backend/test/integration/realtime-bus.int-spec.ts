// ─── Integration: PostgresRealtimeBus (LISTEN / NOTIFY) between two instances on one database ───
import type { PresenceStateEvent } from '@contrack/contract';
import { projectDocToDto, projectToDto } from '../../src/modules/projects/application/project-dto.mapper';
import { ProjectDoc } from '../../src/modules/projects/domain/entities/project-doc.entity';
import { DrizzleProjectDocRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-project-doc.repository';
import { DrizzleProjectRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-project.repository';
import { RepositoryProjectDocLookup } from '../../src/modules/projects/infrastructure/adapters/project-directory.adapter';
import type { BusMessage } from '../../src/modules/realtime/application/ports/realtime-bus.port';
import { RealtimeInstance } from '../../src/modules/realtime/application/ports/realtime-instance.port';
import { PresenceService } from '../../src/modules/realtime/application/services/presence.service';
import { RealtimeService } from '../../src/modules/realtime/application/services/realtime.service';
import { projectRoom } from '../../src/modules/realtime/domain/policies/room-naming.policy';
import { LARGE_MESSAGE_BYTES } from '../../src/modules/realtime/infrastructure/adapters/notify-payload';
import { PostgresRealtimeBus } from '../../src/modules/realtime/infrastructure/adapters/postgres-realtime-bus.adapter';
import { ManualScheduler, RecordingBroadcaster } from '../../src/modules/realtime/testing/realtime-fakes';
import type { DatabaseContext } from '../../src/shared/infrastructure/database/database';
import { FixedClock } from '../../src/shared/infrastructure/system';
import { TEST_DATABASE_URL, describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, eventually, seedProject, seedUser, seedWorkspace } from '../support/seed';

/** One server instance: its own bus connection, broadcaster, realtime and presence services. */
async function instance(ctx: DatabaseContext, id: string) {
    const bus = new PostgresRealtimeBus({ connectionString: TEST_DATABASE_URL, pool: ctx.pool });
    await bus.start();
    const broadcaster = new RecordingBroadcaster();
    const me = new RealtimeInstance(id);
    const clock = new FixedClock(T0);
    const presence = new PresenceService(clock, broadcaster, bus, me, new ManualScheduler());
    const docs = new RepositoryProjectDocLookup(new DrizzleProjectRepository(ctx), new DrizzleProjectDocRepository(ctx));
    const realtime = new RealtimeService(broadcaster, bus, me, docs, presence);
    const received: BusMessage[] = [];
    bus.subscribe(message => { received.push(message); });
    return { bus, broadcaster, presence, realtime, received };
}

describeIfDatabase('PostgresRealtimeBus (integration)', db => {
    async function seed(ctx: DatabaseContext) {
        const owner = await seedUser(ctx, 'Owner');
        const ws = await seedWorkspace(ctx, owner);
        const project = await seedProject(ctx, ws, owner);
        return { owner, ws, project };
    }

    it('delivers a message published by one instance to the other (and to itself)', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { project } = await seed(ctx);
        const a = await instance(ctx, 'instance-a');
        const b = await instance(ctx, 'instance-b');
        try {
            const message: BusMessage = { kind: 'project.updated', origin: 'instance-a', event: { project: projectToDto(project) } };
            await a.bus.publish(message);
            await eventually(() => b.received.length > 0 && a.received.length > 0, 5000, 'NOTIFY delivery');
            expect(b.received).toEqual([message]);
            expect(a.received).toEqual([message]);
        } finally {
            await a.bus.close();
            await b.bus.close();
        }
    });

    it('fans a project event out on the other instance only (an instance ignores its own messages)', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { project } = await seed(ctx);
        const a = await instance(ctx, 'instance-a');
        const b = await instance(ctx, 'instance-b');
        a.realtime.start();
        b.realtime.start();
        try {
            await a.realtime.projectUpdated({ project: projectToDto(project) });
            await eventually(() => b.broadcaster.of('project.updated').length === 1, 5000, 'project.updated on instance b');
            expect(b.broadcaster.last('project.updated')).toEqual({
                room: projectRoom(project.id), event: 'project.updated', payload: { project: projectToDto(project) },
            });
            // Locally once (sent directly), not a second time from its own NOTIFY.
            await eventually(() => a.received.length === 1, 5000, 'own NOTIFY');
            expect(a.broadcaster.of('project.updated')).toHaveLength(1);

            await a.realtime.projectDeleted({ projectId: project.id });
            await eventually(() => b.broadcaster.cleared.includes(projectRoom(project.id)), 5000, 'room cleared on b');
            expect(b.broadcaster.last('project.deleted')?.payload).toEqual({ projectId: project.id });
        } finally {
            a.realtime.stop();
            b.realtime.stop();
            await a.bus.close();
            await b.bus.close();
        }
    });

    it('sends a large document as a reference that the other instance resolves from the database', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { owner, ws, project } = await seed(ctx);
        const bigData = { width: 10, length: 12, height: 0.5, note: 'ไทย'.repeat(4000) };
        const doc = ProjectDoc.write({
            projectId: project.id, workspaceId: ws, docKey: 'calc:fill', data: bigData, baseVersion: 0, updatedBy: owner, now: T0,
        });
        expect(await new DrizzleProjectDocRepository(ctx).write(doc, 0)).toBe('written');
        const event = { projectId: project.id, doc: projectDocToDto(doc) };
        expect(Buffer.byteLength(JSON.stringify(event), 'utf8')).toBeGreaterThan(LARGE_MESSAGE_BYTES);

        const a = await instance(ctx, 'instance-a');
        const b = await instance(ctx, 'instance-b');
        a.realtime.start();
        b.realtime.start();
        try {
            await a.realtime.docUpdated(event);

            await eventually(() => b.broadcaster.of('doc.updated').length === 1, 5000, 'resolved doc.updated on instance b');
            expect(b.received).toEqual([{
                kind: 'doc.reference', origin: 'instance-a', projectId: project.id, docKey: 'calc:fill', version: 1,
            }]);
            const delivered = b.broadcaster.last('doc.updated');
            expect(delivered?.room).toBe(projectRoom(project.id));
            expect(delivered?.payload).toEqual(event);
            // The sender fanned out the full event locally.
            expect(a.broadcaster.last('doc.updated')?.payload).toEqual(event);
        } finally {
            a.realtime.stop();
            b.realtime.stop();
            await a.bus.close();
            await b.bus.close();
        }
    });

    it('shares presence: a viewer on instance A shows up in the presence.state instance B sends', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const { owner, project } = await seed(ctx);
        const a = await instance(ctx, 'instance-a');
        const b = await instance(ctx, 'instance-b');
        await a.presence.start();
        await b.presence.start();
        try {
            await a.presence.join({ connectionId: 'socket-1', userId: owner, displayName: 'Owner' }, project.id);
            const seenByB = (): boolean => b.broadcaster.of('presence.state')
                .some(e => (e.payload as PresenceStateEvent).users.some(u => u.userId === owner));
            await eventually(seenByB, 5000, 'presence.state on instance b');
            expect(b.presence.snapshot(project.id)).toEqual([
                expect.objectContaining({ userId: owner, displayName: 'Owner', levelId: null }),
            ]);

            await a.presence.disconnect('socket-1');
            await eventually(() => b.presence.snapshot(project.id).length === 0, 5000, 'presence gone on instance b');
        } finally {
            a.presence.stop();
            b.presence.stop();
            await a.bus.close();
            await b.bus.close();
        }
    });
});
