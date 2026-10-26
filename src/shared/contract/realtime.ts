// ─── Shared realtime contract (Socket.IO): event names and payloads, both directions ───
import { z } from 'zod';
import { uuidSchema } from './common';
import { levelAssignmentDtoSchema, levelIdSchema, projectDocDtoSchema, projectDtoSchema } from './projects';

/** Socket.IO namespace of the realtime gateway. */
export const REALTIME_NAMESPACE = '/realtime';
/** Clients send a presence heartbeat at this interval; the server forgets a client after 3 missed beats. */
export const PRESENCE_HEARTBEAT_MS = 15_000;
export const PRESENCE_TTL_MS = PRESENCE_HEARTBEAT_MS * 3;

// client → server
export const joinProjectSchema = z.object({ projectId: uuidSchema });
export const leaveProjectSchema = z.object({ projectId: uuidSchema });
export const presenceUpdateSchema = z.object({ projectId: uuidSchema, levelId: levelIdSchema.nullable() });
export type JoinProject = z.infer<typeof joinProjectSchema>;
export type LeaveProject = z.infer<typeof leaveProjectSchema>;
export type PresenceUpdate = z.infer<typeof presenceUpdateSchema>;

/** Acknowledgement of a client → server event. */
export type Ack = { ok: true } | { ok: false; code: 'unauthenticated' | 'not_found' | 'validation_failed' };

// server → client
export const presenceEntrySchema = z.object({
    userId: uuidSchema,
    displayName: z.string(),
    levelId: levelIdSchema.nullable(),
    /** ISO time of the user's last heartbeat. */
    seenAt: z.string(),
});
export type PresenceEntry = z.infer<typeof presenceEntrySchema>;

export const docUpdatedEventSchema = z.object({ projectId: uuidSchema, doc: projectDocDtoSchema });
export const projectUpdatedEventSchema = z.object({ project: projectDtoSchema });
export const presenceStateEventSchema = z.object({ projectId: uuidSchema, users: z.array(presenceEntrySchema) });
export const assignmentUpdatedEventSchema = z.object({
    projectId: uuidSchema,
    levelId: levelIdSchema,
    assignment: levelAssignmentDtoSchema.nullable(),
});
export type DocUpdatedEvent = z.infer<typeof docUpdatedEventSchema>;
export type ProjectUpdatedEvent = z.infer<typeof projectUpdatedEventSchema>;
export type PresenceStateEvent = z.infer<typeof presenceStateEventSchema>;
export type AssignmentUpdatedEvent = z.infer<typeof assignmentUpdatedEventSchema>;

export interface ServerToClientEvents {
    'doc.updated': (e: DocUpdatedEvent) => void;
    'project.updated': (e: ProjectUpdatedEvent) => void;
    'presence.state': (e: PresenceStateEvent) => void;
    'assignment.updated': (e: AssignmentUpdatedEvent) => void;
}

export interface ClientToServerEvents {
    'project.join': (e: JoinProject, ack: (a: Ack) => void) => void;
    'project.leave': (e: LeaveProject, ack: (a: Ack) => void) => void;
    'presence.update': (e: PresenceUpdate, ack: (a: Ack) => void) => void;
}

/** Handshake auth payload: `io(url, { auth: { token } })`. */
export const socketAuthSchema = z.object({ token: z.string().min(1) });
