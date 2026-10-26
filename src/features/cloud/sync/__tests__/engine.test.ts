import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject, type Project } from '@/domain/project';
import { applyDoc } from '@/domain/sync';
import type { ProjectDocDto, ProjectDto, PutDocRequest, PutDocResponse } from '@/shared/contract';
import { ApiError } from '../../api/errors';
import {
    SyncEngine, type NetworkState, type PersistedQueue, type QueueStorage, type SyncEvent, type SyncStore,
} from '../engine';

const USER = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const WS = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-10-26T10:00:00.000Z';

function doc(docKey: string, data: unknown, version: number): ProjectDocDto {
    return { docKey, data, version, updatedBy: USER, updatedAt: NOW };
}

const projectDto: ProjectDto = {
    id: PROJECT, workspaceId: WS, name: 'บ้านทดสอบ', start: 'sample', engineVersion: 'excel-v5', schemaVersion: 1,
    summary: { constructionTotal: 0, preConstructionTotal: 0, levelsDone: 0, levelsTotal: 1 },
    createdBy: USER, createdAt: NOW, updatedAt: NOW, archivedAt: null,
};

/** The working copy: a plain object with synchronous subscribers (like zustand). */
function fakeStore(initial: Project) {
    let project = initial;
    const listeners = new Set<(p: Project) => void>();
    const store: SyncStore & { edit: (fn: (p: Project) => Project) => void } = {
        getProject: () => project,
        setProject: (p) => { project = p; for (const l of listeners) l(p); },
        subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
        edit: (fn) => { store.setProject(fn(project)); },
    };
    return store;
}

interface Call { docKey: string; body: PutDocRequest; resolve: (r: PutDocResponse) => void; reject: (e: unknown) => void }

/** Transport whose answers the test gives by hand (or automatically: success with version + 1). */
function fakeTransport(auto = true) {
    const calls: Call[] = [];
    const versions = new Map<string, number>();
    return {
        calls,
        transport: {
            putDoc: (docKey: string, body: PutDocRequest) => new Promise<PutDocResponse>((resolve, reject) => {
                calls.push({ docKey, body, resolve, reject });
                if (auto) {
                    const v = (versions.get(docKey) ?? body.baseVersion) + 1;
                    versions.set(docKey, v);
                    resolve({ doc: doc(docKey, body.data, v), project: projectDto });
                }
            }),
        },
    };
}

function memoryQueue(): QueueStorage & { value: PersistedQueue | null } {
    const q: QueueStorage & { value: PersistedQueue | null } = {
        value: null,
        load: () => (q.value ? structuredClone(q.value) : null),
        save: (v) => { q.value = structuredClone(v); },
    };
    return q;
}

function fakeNetwork(online: boolean) {
    const listeners = new Set<(o: boolean) => void>();
    let state = online;
    const net: NetworkState & { set: (o: boolean) => void } = {
        isOnline: () => state,
        subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
        set: (o) => { state = o; for (const l of listeners) l(o); },
    };
    return net;
}

const setFill = (data: unknown) => (p: Project) => applyDoc(p, 'calc:fill', data);
const fillOf = (s: SyncStore) => s.getProject().calculators.fill;

describe('SyncEngine', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    function setup(opts: { auto?: boolean; initialDocs?: ProjectDocDto[]; online?: boolean; storage?: ReturnType<typeof memoryQueue> } = {}) {
        const initialDocs = opts.initialDocs ?? [];
        let start = createProject('sample');
        for (const d of initialDocs) start = applyDoc(start, d.docKey, d.data);
        const store = fakeStore(start);
        const { calls, transport } = fakeTransport(opts.auto ?? true);
        const events: SyncEvent[] = [];
        const network = fakeNetwork(opts.online ?? true);
        const storage = opts.storage ?? memoryQueue();
        const engine = new SyncEngine({
            store, transport, initialDocs, storage, network, onEvent: (e) => { events.push(e); },
        });
        engine.start();
        return { store, calls, events, engine, network, storage };
    }

    it('debounces each document ~600 ms after its last edit', async () => {
        const { store, calls } = setup();
        store.edit(setFill({ width: 1 }));
        await vi.advanceTimersByTimeAsync(599);
        expect(calls).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.docKey).toBe('calc:fill');
        expect(calls[0]?.body).toEqual({ data: { width: 1 }, baseVersion: 0 });
    });

    it('coalesces edits of the same document into one write with the latest data', async () => {
        const { store, calls } = setup();
        store.edit(setFill({ width: 1 }));
        await vi.advanceTimersByTimeAsync(300);
        store.edit(setFill({ width: 2 }));
        await vi.advanceTimersByTimeAsync(300);
        store.edit(setFill({ width: 3 }));
        await vi.advanceTimersByTimeAsync(599);
        expect(calls).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls.map(c => c.body.data)).toEqual([{ width: 3 }]);
    });

    it('sends different documents separately, and null for a removed document', async () => {
        const { store, calls } = setup({ initialDocs: [doc('calc:fill', { width: 9 }, 2)] });
        store.edit(p => applyDoc(applyDoc(p, 'calc:fill', null), 'boq:R13', { qty: 5 }));
        await vi.advanceTimersByTimeAsync(600);
        const byKey = Object.fromEntries(calls.map(c => [c.docKey, c.body]));
        expect(byKey['calc:fill']).toEqual({ data: null, baseVersion: 2 });
        expect(byKey['boq:R13']).toEqual({ data: { qty: 5 }, baseVersion: 0 });
    });

    it('keeps baseVersion in step with the server versions', async () => {
        const { store, calls, engine } = setup({ initialDocs: [doc('calc:fill', { width: 9 }, 3)] });
        store.edit(setFill({ width: 1 }));
        await vi.advanceTimersByTimeAsync(600);
        expect(calls[0]?.body.baseVersion).toBe(3);
        expect(engine.versionOf('calc:fill')).toBe(4);
        store.edit(setFill({ width: 2 }));
        await vi.advanceTimersByTimeAsync(600);
        expect(calls[1]?.body.baseVersion).toBe(4);
        expect(engine.getStatus()).toEqual({ state: 'saved', count: 0 });
    });

    it('an edit made while the write is out is sent again on the new version', async () => {
        const { store, calls, engine } = setup({ auto: false });
        store.edit(setFill({ width: 1 }));
        await vi.advanceTimersByTimeAsync(600);
        expect(calls).toHaveLength(1);
        store.edit(setFill({ width: 2 }));
        expect(engine.getStatus().state).toBe('saving');
        calls[0]?.resolve({ doc: doc('calc:fill', { width: 1 }, 1), project: projectDto });
        await vi.advanceTimersByTimeAsync(0);
        expect(calls).toHaveLength(2);
        expect(calls[1]?.body).toEqual({ data: { width: 2 }, baseVersion: 1 });
    });

    it('409: applies the server document without sending it back, and tells the user', async () => {
        const { store, calls, events, engine } = setup({ auto: false, initialDocs: [doc('calc:fill', { width: 9 }, 3)] });
        store.edit(setFill({ width: 1 }));
        await vi.advanceTimersByTimeAsync(600);
        calls[0]?.reject(new ApiError(409, 'version_conflict', 'conflict', { current: doc('calc:fill', { width: 42 }, 7) }));
        await vi.advanceTimersByTimeAsync(5_000);
        expect(fillOf(store)).toEqual({ width: 42 });
        expect(calls).toHaveLength(1); // no echo
        expect(engine.versionOf('calc:fill')).toBe(7);
        expect(engine.hasPending('calc:fill')).toBe(false);
        expect(events.some(e => e.type === 'conflict' && e.docKey === 'calc:fill')).toBe(true);
        store.edit(setFill({ width: 43 }));
        await vi.advanceTimersByTimeAsync(600);
        expect(calls[1]?.body.baseVersion).toBe(7);
    });

    it('409 without details reads the current document from the server', async () => {
        const store = fakeStore(createProject('sample'));
        const engine = new SyncEngine({
            store,
            initialDocs: [],
            transport: {
                putDoc: () => Promise.reject(new ApiError(409, 'version_conflict', 'conflict')),
                fetchDoc: () => Promise.resolve(doc('calc:fill', { width: 5 }, 2)),
            },
        });
        engine.start();
        store.setProject(setFill({ width: 1 })(store.getProject()));
        await vi.advanceTimersByTimeAsync(600);
        expect(fillOf(store)).toEqual({ width: 5 });
        expect(engine.versionOf('calc:fill')).toBe(2);
    });

    it('422: reverts the document to the last server version and does not resend', async () => {
        const { store, calls, events, engine } = setup({ auto: false, initialDocs: [doc('calc:fill', { width: 9 }, 3)] });
        store.edit(setFill({ width: -1 }));
        await vi.advanceTimersByTimeAsync(600);
        calls[0]?.reject(new ApiError(422, 'unprocessable', 'does not compute'));
        await vi.advanceTimersByTimeAsync(5_000);
        expect(fillOf(store)).toEqual({ width: 9 });
        expect(calls).toHaveLength(1);
        expect(engine.versionOf('calc:fill')).toBe(3);
        expect(events.some(e => e.type === 'rejected')).toBe(true);
        expect(engine.getStatus()).toEqual({ state: 'saved', count: 0 });
    });

    it('422 on a new document resets it to the default', async () => {
        const { store, calls } = setup({ auto: false });
        store.edit(setFill({ width: -1 }));
        await vi.advanceTimersByTimeAsync(600);
        calls[0]?.reject(new ApiError(422, 'unprocessable', 'no'));
        await vi.advanceTimersByTimeAsync(0);
        expect(fillOf(store)).toBeUndefined();
    });

    it('retries network errors with backoff', async () => {
        const { store, calls, engine } = setup({ auto: false });
        store.edit(setFill({ width: 1 }));
        await vi.advanceTimersByTimeAsync(600);
        calls[0]?.reject(new ApiError(0, 'network_error', 'down'));
        await vi.advanceTimersByTimeAsync(0);
        expect(engine.getStatus()).toEqual({ state: 'pending', count: 1 });
        await vi.advanceTimersByTimeAsync(999);
        expect(calls).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls).toHaveLength(2);
        calls[1]?.reject(new ApiError(503, 'internal', 'busy'));
        await vi.advanceTimersByTimeAsync(1_999);
        expect(calls).toHaveLength(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls).toHaveLength(3);
        calls[2]?.resolve({ doc: doc('calc:fill', { width: 1 }, 1), project: projectDto });
        await vi.advanceTimersByTimeAsync(0);
        expect(engine.getStatus()).toEqual({ state: 'saved', count: 0 });
    });

    it('offline: queues (and saves the queue), then sends when back online', async () => {
        const { store, calls, engine, network, storage } = setup({ online: false });
        store.edit(setFill({ width: 1 }));
        store.edit(p => applyDoc(p, 'boq:R13', { qty: 2 }));
        await vi.advanceTimersByTimeAsync(10_000);
        expect(calls).toHaveLength(0);
        expect(engine.getStatus()).toEqual({ state: 'offline', count: 2 });
        expect(Object.keys(storage.value?.pending ?? {}).sort()).toEqual(['boq:R13', 'calc:fill']);
        network.set(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(calls.map(c => c.docKey).sort()).toEqual(['boq:R13', 'calc:fill']);
        expect(engine.getStatus()).toEqual({ state: 'saved', count: 0 });
        expect(storage.value?.pending).toEqual({});
    });

    it('a saved queue survives a reload: re-applied to the project and sent with its own baseVersion', async () => {
        const storage = memoryQueue();
        const first = setup({ online: false, storage, initialDocs: [doc('calc:fill', { width: 9 }, 3)] });
        first.store.edit(setFill({ width: 1 }));
        await vi.advanceTimersByTimeAsync(1_000);
        first.engine.dispose();

        // Reload: the server now has version 5 (someone else wrote meanwhile).
        const second = setup({ storage, initialDocs: [doc('calc:fill', { width: 7 }, 5)] });
        expect(fillOf(second.store)).toEqual({ width: 1 });
        await vi.advanceTimersByTimeAsync(0);
        expect(second.calls).toHaveLength(1);
        expect(second.calls[0]?.body).toEqual({ data: { width: 1 }, baseVersion: 3 });
    });

    it('edited and edited back before the debounce: nothing is sent', async () => {
        const { store, calls } = setup({ initialDocs: [doc('calc:fill', { width: 9 }, 3)] });
        store.edit(setFill({ width: 1 }));
        store.edit(setFill({ width: 9 }));
        await vi.advanceTimersByTimeAsync(600);
        expect(calls).toHaveLength(0);
    });

    describe('remote documents', () => {
        it('a newer version with no local edit is applied and never re-sent', async () => {
            const { store, calls, engine } = setup({ initialDocs: [doc('calc:fill', { width: 9 }, 3)] });
            expect(engine.applyRemoteDoc(doc('calc:fill', { width: 20 }, 4))).toBe(true);
            expect(fillOf(store)).toEqual({ width: 20 });
            await vi.advanceTimersByTimeAsync(5_000);
            expect(calls).toHaveLength(0);
            expect(engine.versionOf('calc:fill')).toBe(4);
        });

        it('an older or equal version is ignored (e.g. the echo of our own write)', () => {
            const { store, engine } = setup({ initialDocs: [doc('calc:fill', { width: 9 }, 3)] });
            expect(engine.applyRemoteDoc(doc('calc:fill', { width: 1 }, 3))).toBe(false);
            expect(engine.applyRemoteDoc(doc('calc:fill', { width: 1 }, 2))).toBe(false);
            expect(fillOf(store)).toEqual({ width: 9 });
        });

        it('with a local edit waiting, the remote doc is left for the 409 to settle', async () => {
            const { store, calls, engine } = setup({ auto: false, initialDocs: [doc('calc:fill', { width: 9 }, 3)] });
            store.edit(setFill({ width: 1 }));
            expect(engine.applyRemoteDoc(doc('calc:fill', { width: 20 }, 4))).toBe(false);
            expect(fillOf(store)).toEqual({ width: 1 });
            await vi.advanceTimersByTimeAsync(600);
            expect(calls[0]?.body.baseVersion).toBe(3);
            calls[0]?.reject(new ApiError(409, 'version_conflict', 'c', { current: doc('calc:fill', { width: 20 }, 4) }));
            await vi.advanceTimersByTimeAsync(0);
            expect(fillOf(store)).toEqual({ width: 20 });
        });

        it('a remote doc for another key does not touch pending edits', async () => {
            const { store, calls, engine } = setup();
            store.edit(setFill({ width: 1 }));
            engine.applyRemoteDoc(doc('boq:R13', { qty: 8 }, 1));
            expect(store.getProject().boqOverrides.R13).toEqual({ qty: 8 });
            await vi.advanceTimersByTimeAsync(600);
            expect(calls.map(c => c.docKey)).toEqual(['calc:fill']);
        });
    });

    it('reports status changes', async () => {
        const { store, engine } = setup({ auto: false });
        const seen: string[] = [];
        engine.onStatus(s => seen.push(`${s.state}:${String(s.count)}`));
        store.edit(setFill({ width: 1 }));
        expect(seen).toEqual(['saving:1']);
        await vi.advanceTimersByTimeAsync(600);
        expect(engine.getStatus()).toEqual({ state: 'saving', count: 1 });
    });

    it('discard drops the queue (deleted project)', async () => {
        const { store, calls, engine, storage } = setup({ online: false });
        store.edit(setFill({ width: 1 }));
        expect(Object.keys(storage.value?.pending ?? {})).toHaveLength(1);
        engine.discard();
        expect(storage.value?.pending).toEqual({});
        store.edit(setFill({ width: 2 }));
        await vi.advanceTimersByTimeAsync(5_000);
        expect(calls).toHaveLength(0);
    });
});
