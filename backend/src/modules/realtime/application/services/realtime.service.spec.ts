import type {
    AssignmentUpdatedEvent, DocUpdatedEvent, ProjectDocDto, ProjectDto, ProjectUpdatedEvent,
} from '@contrack/contract';
import { ProjectDocLookup } from '../../../../shared/application/ports';
import { type ProjectId, asProjectId } from '../../../../shared/domain/ids';
import { InMemoryRealtimeBus } from '../../infrastructure/adapters/in-memory-realtime-bus.adapter';
import { RecordingBroadcaster } from '../../testing/realtime-fakes';
import type { BusMessage } from '../ports/realtime-bus.port';
import { RealtimeInstance } from '../ports/realtime-instance.port';
import { RealtimeService } from './realtime.service';

const P1 = asProjectId('11111111-1111-4111-8111-111111111111');
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROOM = `project:${P1}`;

function doc(version: number, data: unknown = { qty: version }): ProjectDocDto {
    return { docKey: 'calc:footing', data, version, updatedBy: USER, updatedAt: '2026-01-01T00:00:00.000Z' };
}

class FakeDocLookup extends ProjectDocLookup {
    readonly docs = new Map<string, ProjectDocDto>();
    readonly calls: [ProjectId, string][] = [];

    find(projectId: ProjectId, docKey: string): Promise<ProjectDocDto | undefined> {
        this.calls.push([projectId, docKey]);
        return Promise.resolve(this.docs.get(`${projectId}/${docKey}`));
    }
}

function setup() {
    const bus = new InMemoryRealtimeBus();
    const published: BusMessage[] = [];
    bus.subscribe(m => { published.push(m); });
    const docs = new FakeDocLookup();
    const make = (id: string) => {
        const broadcaster = new RecordingBroadcaster();
        const service = new RealtimeService(broadcaster, bus, new RealtimeInstance(id), docs);
        service.start();
        return { broadcaster, service };
    };
    return { bus, published, docs, a: make('instance-a'), b: make('instance-b') };
}

describe('RealtimeService', () => {
    it('fans a doc update out to the local room and publishes it on the bus', async () => {
        const { a, published } = setup();
        const event: DocUpdatedEvent = { projectId: P1, doc: doc(2) };

        await a.service.docUpdated(event);

        expect(a.broadcaster.emitted).toEqual([{ room: ROOM, event: 'doc.updated', payload: event }]);
        expect(published).toEqual([{ kind: 'doc.updated', origin: 'instance-a', event }]);
    });

    it('fans out messages of other instances and ignores its own', async () => {
        const { a, b } = setup();
        const event: DocUpdatedEvent = { projectId: P1, doc: doc(3) };

        await a.service.docUpdated(event);

        expect(a.broadcaster.of('doc.updated')).toHaveLength(1); // not again from the bus
        expect(b.broadcaster.emitted).toEqual([{ room: ROOM, event: 'doc.updated', payload: event }]);
    });

    it('fans out project and assignment updates to the project room', async () => {
        const { a, b } = setup();
        const project = { id: P1, name: 'House' } as unknown as ProjectDto;
        const projectEvent: ProjectUpdatedEvent = { project };
        const assignmentEvent: AssignmentUpdatedEvent = { projectId: P1, levelId: 'roof', assignment: null };

        await a.service.projectUpdated(projectEvent);
        await a.service.assignmentUpdated(assignmentEvent);

        for (const side of [a, b]) {
            expect(side.broadcaster.emitted).toEqual([
                { room: ROOM, event: 'project.updated', payload: projectEvent },
                { room: ROOM, event: 'assignment.updated', payload: assignmentEvent },
            ]);
        }
    });

    it('loads a referenced (too large) document before fanning it out', async () => {
        const { bus, b, docs } = setup();
        const stored = doc(5, { big: 'x'.repeat(10_000) });
        docs.docs.set(`${P1}/calc:footing`, stored);

        await bus.publish({ kind: 'doc.reference', origin: 'instance-c', projectId: P1, docKey: 'calc:footing', version: 5 });

        expect(docs.calls).toContainEqual([P1, 'calc:footing']);
        expect(b.broadcaster.emitted).toEqual([{ room: ROOM, event: 'doc.updated', payload: { projectId: P1, doc: stored } }]);
    });

    it('drops a reference when the document is gone or older than announced', async () => {
        const { bus, b, docs } = setup();
        await bus.publish({ kind: 'doc.reference', origin: 'instance-c', projectId: P1, docKey: 'calc:footing', version: 5 });
        docs.docs.set(`${P1}/calc:footing`, doc(4));
        await bus.publish({ kind: 'doc.reference', origin: 'instance-c', projectId: P1, docKey: 'calc:footing', version: 5 });
        expect(b.broadcaster.emitted).toEqual([]);
    });

    it('ignores its own references', async () => {
        const { bus, a, docs } = setup();
        await bus.publish({ kind: 'doc.reference', origin: 'instance-a', projectId: P1, docKey: 'calc:footing', version: 1 });
        expect(docs.calls.length).toBeLessThanOrEqual(1); // only instance-b looked it up
        expect(a.broadcaster.emitted).toEqual([]);
    });

    it('still fans out locally when the bus fails (the change is already committed)', async () => {
        const bus = new InMemoryRealtimeBus();
        jest.spyOn(bus, 'publish').mockRejectedValue(new Error('bus down'));
        const broadcaster = new RecordingBroadcaster();
        const service = new RealtimeService(broadcaster, bus, new RealtimeInstance('solo'), new FakeDocLookup());

        await expect(service.docUpdated({ projectId: P1, doc: doc(1) })).resolves.toBeUndefined();
        expect(broadcaster.of('doc.updated')).toHaveLength(1);
    });

    it('stops receiving after stop()', async () => {
        const { a, b } = setup();
        b.service.stop();
        await a.service.docUpdated({ projectId: P1, doc: doc(1) });
        expect(b.broadcaster.emitted).toEqual([]);
    });
});
