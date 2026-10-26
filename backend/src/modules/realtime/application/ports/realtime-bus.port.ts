// ─── Bus between server instances: every instance fans the messages out to its own sockets ───
import type { AssignmentUpdatedEvent, DocUpdatedEvent, ProjectUpdatedEvent } from '@contrack/contract';
import type { ProjectId, UserId } from '../../../../shared/domain/ids';

interface FromInstance {
    /** Instance that published the message; an instance ignores its own messages. */
    readonly origin: string;
}

export interface DocUpdatedMessage extends FromInstance {
    readonly kind: 'doc.updated';
    readonly event: DocUpdatedEvent;
}

/**
 * A `doc.updated` whose document is too large for the transport (PostgreSQL NOTIFY: 8 kB). The receiving instance
 * loads the document (ProjectDocLookup) before fanning it out.
 */
export interface DocReferenceMessage extends FromInstance {
    readonly kind: 'doc.reference';
    readonly projectId: ProjectId;
    readonly docKey: string;
    readonly version: number;
}

export interface ProjectUpdatedMessage extends FromInstance {
    readonly kind: 'project.updated';
    readonly event: ProjectUpdatedEvent;
}

export interface AssignmentUpdatedMessage extends FromInstance {
    readonly kind: 'assignment.updated';
    readonly event: AssignmentUpdatedEvent;
}

/** One connection held by the publishing instance (JSON-friendly: the time is an ISO string). */
export interface SharedPresence {
    readonly connectionId: string;
    readonly userId: UserId;
    readonly displayName: string;
    readonly levelId: string | null;
    readonly seenAt: string;
}

/** Everything the origin instance holds in a project right now (replaces what it reported before). */
export interface PresenceSyncMessage extends FromInstance {
    readonly kind: 'presence.sync';
    readonly projectId: ProjectId;
    readonly connections: readonly SharedPresence[];
}

/** A starting instance asks the others to send their presence. */
export interface PresenceHelloMessage extends FromInstance {
    readonly kind: 'presence.hello';
}

export type BusMessage =
    | DocUpdatedMessage
    | DocReferenceMessage
    | ProjectUpdatedMessage
    | AssignmentUpdatedMessage
    | PresenceSyncMessage
    | PresenceHelloMessage;

export type BusHandler = (message: BusMessage) => void | Promise<void>;

/** Removes a subscription. */
export type Unsubscribe = () => void;

export abstract class RealtimeBus {
    /** Sends a message to every instance (the sender's own subscribers included). */
    abstract publish(message: BusMessage): Promise<void>;
    abstract subscribe(handler: BusHandler): Unsubscribe;
    abstract close(): Promise<void>;
}
