// ─── Bus messages ⇄ PostgreSQL NOTIFY payloads (JSON, shorter than 8000 bytes) ───
import { z } from 'zod';
import {
    assignmentUpdatedEventSchema, docKeySchema, docUpdatedEventSchema, isoDateTimeSchema, levelIdSchema,
    projectUpdatedEventSchema, uuidSchema,
} from '@contrack/contract';
import { asProjectId, asUserId } from '../../../../shared/domain/ids';
import type { BusMessage, DocReferenceMessage } from '../../application/ports/realtime-bus.port';

export const NOTIFY_CHANNEL = 'contrack_realtime';
/** Above this a `doc.updated` travels as a reference (the receiver loads the document). */
export const LARGE_MESSAGE_BYTES = 7_000;
/** PostgreSQL rejects NOTIFY payloads of 8000 bytes or more (default build). */
export const MAX_NOTIFY_BYTES = 7_999;

const projectIdSchema = uuidSchema.transform(asProjectId);
const originSchema = z.string().min(1);

const busMessageSchema: z.ZodType<BusMessage, z.ZodTypeDef, unknown> = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('doc.updated'), origin: originSchema, event: docUpdatedEventSchema }),
    z.object({
        kind: z.literal('doc.reference'),
        origin: originSchema,
        projectId: projectIdSchema,
        docKey: docKeySchema,
        version: z.number().int().positive(),
    }),
    z.object({ kind: z.literal('project.updated'), origin: originSchema, event: projectUpdatedEventSchema }),
    z.object({ kind: z.literal('assignment.updated'), origin: originSchema, event: assignmentUpdatedEventSchema }),
    z.object({
        kind: z.literal('presence.sync'),
        origin: originSchema,
        projectId: projectIdSchema,
        connections: z.array(z.object({
            connectionId: z.string().min(1),
            userId: uuidSchema.transform(asUserId),
            displayName: z.string(),
            levelId: levelIdSchema.nullable(),
            seenAt: isoDateTimeSchema,
        })),
    }),
    z.object({ kind: z.literal('presence.hello'), origin: originSchema }),
]);

const byteLength = (text: string): number => Buffer.byteLength(text, 'utf8');

/**
 * The payload to NOTIFY. A large `doc.updated` becomes a `doc.reference`; anything else that does not fit gives
 * undefined (the caller logs and drops it).
 */
export function encodeNotifyPayload(message: BusMessage): string | undefined {
    const full = JSON.stringify(message);
    if (byteLength(full) <= LARGE_MESSAGE_BYTES) return full;
    if (message.kind === 'doc.updated') {
        const reference: DocReferenceMessage = {
            kind: 'doc.reference',
            origin: message.origin,
            projectId: asProjectId(message.event.projectId),
            docKey: message.event.doc.docKey,
            version: message.event.doc.version,
        };
        return JSON.stringify(reference);
    }
    return byteLength(full) <= MAX_NOTIFY_BYTES ? full : undefined;
}

/** A received payload, or undefined when it is not a valid bus message. */
export function decodeNotifyPayload(payload: string): BusMessage | undefined {
    let json: unknown;
    try {
        json = JSON.parse(payload);
    } catch {
        return undefined;
    }
    const parsed = busMessageSchema.safeParse(json);
    return parsed.success ? parsed.data : undefined;
}
