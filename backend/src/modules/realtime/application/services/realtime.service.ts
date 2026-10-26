// ─── Fan-out of project events: to this instance's sockets at once, then to the other instances over the bus ───
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { AssignmentUpdatedEvent, DocUpdatedEvent, ProjectUpdatedEvent } from '@contrack/contract';
import { ProjectDocLookup, RealtimePublisher } from '../../../../shared/application/ports';
import { asProjectId } from '../../../../shared/domain/ids';
import { projectRoom } from '../../domain/policies/room-naming.policy';
import { Broadcaster } from '../ports/broadcaster.port';
import { type BusMessage, type DocReferenceMessage, RealtimeBus, type Unsubscribe } from '../ports/realtime-bus.port';
import { RealtimeInstance } from '../ports/realtime-instance.port';
import { errorMessage } from './error-message';

@Injectable()
export class RealtimeService extends RealtimePublisher implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RealtimeService.name);
    private unsubscribe: Unsubscribe | undefined;

    constructor(
        private readonly broadcaster: Broadcaster,
        private readonly bus: RealtimeBus,
        private readonly instance: RealtimeInstance,
        private readonly docs: ProjectDocLookup,
    ) {
        super();
    }

    onModuleInit(): void {
        this.start();
    }

    onModuleDestroy(): void {
        this.stop();
    }

    /** Starts listening to the other instances. */
    start(): void {
        this.unsubscribe ??= this.bus.subscribe(message => this.receive(message));
    }

    stop(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }

    async docUpdated(event: DocUpdatedEvent): Promise<void> {
        this.emitDoc(event);
        await this.share({ kind: 'doc.updated', origin: this.instance.id, event });
    }

    async projectUpdated(event: ProjectUpdatedEvent): Promise<void> {
        this.emitProject(event);
        await this.share({ kind: 'project.updated', origin: this.instance.id, event });
    }

    async assignmentUpdated(event: AssignmentUpdatedEvent): Promise<void> {
        this.emitAssignment(event);
        await this.share({ kind: 'assignment.updated', origin: this.instance.id, event });
    }

    /** A message from the bus: fanned out to this instance's sockets unless this instance sent it. */
    async receive(message: BusMessage): Promise<void> {
        if (message.origin === this.instance.id) return;
        try {
            switch (message.kind) {
                case 'doc.updated':
                    this.emitDoc(message.event);
                    return;
                case 'doc.reference':
                    await this.resolveReference(message);
                    return;
                case 'project.updated':
                    this.emitProject(message.event);
                    return;
                case 'assignment.updated':
                    this.emitAssignment(message.event);
                    return;
                case 'presence.sync':
                case 'presence.hello':
                    return; // PresenceService
            }
        } catch (error) {
            this.logger.error(`Could not fan out ${message.kind}: ${errorMessage(error)}`);
        }
    }

    /** The document was too large for the bus: load it (same database) and fan it out. */
    private async resolveReference(message: DocReferenceMessage): Promise<void> {
        const doc = await this.docs.find(message.projectId, message.docKey);
        // Gone, or older than announced (should not happen after commit): nothing worth sending.
        if (doc === undefined || doc.version < message.version) return;
        this.emitDoc({ projectId: message.projectId, doc });
    }

    private emitDoc(event: DocUpdatedEvent): void {
        this.broadcaster.emit(projectRoom(asProjectId(event.projectId)), 'doc.updated', event);
    }

    private emitProject(event: ProjectUpdatedEvent): void {
        this.broadcaster.emit(projectRoom(asProjectId(event.project.id)), 'project.updated', event);
    }

    private emitAssignment(event: AssignmentUpdatedEvent): void {
        this.broadcaster.emit(projectRoom(asProjectId(event.projectId)), 'assignment.updated', event);
    }

    /** The change is committed and already sent locally: a bus failure is logged, never turned into a failed request. */
    private async share(message: BusMessage): Promise<void> {
        try {
            await this.bus.publish(message);
        } catch (error) {
            this.logger.error(`Could not publish ${message.kind} on the realtime bus: ${errorMessage(error)}`);
        }
    }
}
