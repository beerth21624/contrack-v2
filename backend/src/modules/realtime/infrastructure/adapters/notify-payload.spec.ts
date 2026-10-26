import type { ProjectDocDto } from '@contrack/contract';
import { asProjectId, asUserId } from '../../../../shared/domain/ids';
import type { BusMessage } from '../../application/ports/realtime-bus.port';
import { LARGE_MESSAGE_BYTES, MAX_NOTIFY_BYTES, decodeNotifyPayload, encodeNotifyPayload } from './notify-payload';

const P1 = asProjectId('11111111-1111-4111-8111-111111111111');
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const doc = (data: unknown): ProjectDocDto => ({
    docKey: 'calc:footing', data, version: 7, updatedBy: USER, updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('NOTIFY payloads', () => {
    it('round-trips a small doc.updated as is', () => {
        const message: BusMessage = { kind: 'doc.updated', origin: 'i1', event: { projectId: P1, doc: doc({ qty: 1 }) } };
        const payload = encodeNotifyPayload(message);
        expect(payload).toBeDefined();
        expect(decodeNotifyPayload(payload!)).toEqual(message);
    });

    it('round-trips project.deleted', () => {
        const message: BusMessage = { kind: 'project.deleted', origin: 'i1', event: { projectId: P1 } };
        expect(decodeNotifyPayload(encodeNotifyPayload(message)!)).toEqual(message);
    });

    it('turns a large doc.updated into a reference', () => {
        const message: BusMessage = {
            kind: 'doc.updated', origin: 'i1', event: { projectId: P1, doc: doc({ text: 'é'.repeat(LARGE_MESSAGE_BYTES) }) },
        };
        const payload = encodeNotifyPayload(message)!;
        expect(Buffer.byteLength(payload)).toBeLessThan(MAX_NOTIFY_BYTES);
        expect(decodeNotifyPayload(payload)).toEqual({
            kind: 'doc.reference', origin: 'i1', projectId: P1, docKey: 'calc:footing', version: 7,
        });
    });

    it('drops other messages that cannot fit', () => {
        const connections = Array.from({ length: 200 }, (_, i) => ({
            connectionId: `socket-${i}`, userId: asUserId(USER), displayName: 'A long display name', levelId: null,
            seenAt: '2026-01-01T00:00:00.000Z',
        }));
        expect(encodeNotifyPayload({ kind: 'presence.sync', origin: 'i1', projectId: P1, connections })).toBeUndefined();
    });

    it('rejects payloads that are not bus messages', () => {
        expect(decodeNotifyPayload('not json')).toBeUndefined();
        expect(decodeNotifyPayload(JSON.stringify({ kind: 'nope', origin: 'i1' }))).toBeUndefined();
        expect(decodeNotifyPayload(JSON.stringify({ kind: 'doc.reference', origin: 'i1', projectId: 'x', docKey: 'meta', version: 1 })))
            .toBeUndefined();
    });
});
