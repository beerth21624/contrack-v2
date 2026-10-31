// ─── Sync engine: the working copy of a cloud project ⇄ its documents on the server ───
// Framework-free (no React, no zustand, no fetch): the store, the transport, the timers and the network state are
// injected, so the rules below are unit-tested with fakes.
//
// Rules
// - Every store change is diffed against the last state the engine saw (`diffDocs`); each changed document is queued
//   with its latest data (edits to the same document coalesce) and sent ~600 ms after its last edit.
// - A write carries `baseVersion` = the server version the edit was made on (0 = the document is new).
//   Success → the new version is recorded. Edited again while the request was out → sent again on the new version.
// - 409 `version_conflict` → the server's document (`details.current`) replaces the local one and the local edit is
//   dropped (someone else changed it first). Applied without being sent back.
// - 409 `details.reason = 'baseline_locked'` (the BOQ was locked by a baseline) → the document and every other waiting
//   BOQ document (calculators, BOQ lines, journey) go back to the server version and are dropped, never retried;
//   `locked` is emitted for each document so the app can turn the BOQ read-only.
// - Other refusals (422 cannot compute, 403, 404, archived …) → the document goes back to the last server version.
// - No answer (offline, server down, 5xx, 429, 401) → retried with exponential backoff; while the browser is offline
//   nothing is sent and everything is sent when it comes back online.
// - Documents applied by the engine itself (remote events, conflicts, reverts, restored queue) are never re-sent.
import { applyDoc, diffDocs, parseDocKey, stableStringify } from '@/domain/sync';
import type { Project } from '@/domain/project';
import {
    versionConflictDetailsSchema, type ProjectDocDto, type ProjectDto, type PutDocRequest, type PutDocResponse,
} from '@/shared/contract';
import { isApiError, isRetryable } from '../api/errors';

export interface SyncTransport {
    putDoc: (docKey: string, body: PutDocRequest) => Promise<PutDocResponse>;
    /** Used only when a 409 does not carry the current document: read it from the server instead. */
    fetchDoc?: (docKey: string) => Promise<ProjectDocDto | null>;
}

/** The working copy (a zustand store in the app, a plain object in tests). */
export interface SyncStore {
    getProject: () => Project;
    /** Replace the working copy (must notify subscribers synchronously). */
    setProject: (project: Project) => void;
    subscribe: (listener: (project: Project) => void) => () => void;
}

export interface PendingDoc {
    data: unknown;
    baseVersion: number;
}

/** The queue as saved between page loads (per cloud project). */
export interface PersistedQueue {
    pending: Record<string, PendingDoc>;
}

export interface QueueStorage {
    load: () => PersistedQueue | null;
    save: (queue: PersistedQueue) => void;
}

export interface NetworkState {
    isOnline: () => boolean;
    subscribe: (listener: (online: boolean) => void) => () => void;
}

export interface Timers {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
}

export type SyncState = 'saved' | 'saving' | 'pending' | 'offline';

export interface SyncStatus {
    state: SyncState;
    /** Documents not yet accepted by the server. */
    count: number;
}

export type SyncEvent =
    | { type: 'saved'; doc: ProjectDocDto; project: ProjectDto }
    | { type: 'conflict'; docKey: string; current: ProjectDocDto | null }
    | { type: 'rejected'; docKey: string; error: unknown }
    | { type: 'remote'; doc: ProjectDocDto }
    | { type: 'locked'; docKey: string };

export type ErrorKind = 'conflict' | 'rejected' | 'retry';

export interface SyncEngineOptions {
    store: SyncStore;
    transport: SyncTransport;
    /** The documents as loaded from the server (versions + data). */
    initialDocs: readonly ProjectDocDto[];
    storage?: QueueStorage;
    network?: NetworkState;
    timers?: Timers;
    debounceMs?: number;
    retryBaseMs?: number;
    retryMaxMs?: number;
    onEvent?: (event: SyncEvent) => void;
}

export const SYNC_DEBOUNCE_MS = 600;
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

type Phase = 'debounce' | 'flight' | 'retry' | 'waiting-online';

interface Entry extends PendingDoc {
    phase: Phase;
    timer: unknown;
    attempt: number;
}

/** Documents a baseline lock refuses (the server's `isBaselineDoc`): calculators, BOQ lines and journey marks. */
export function isBaselineLockedDoc(docKey: string): boolean {
    return docKey.startsWith('calc:') || docKey.startsWith('boq:') || docKey === 'journey';
}

/** 409 of a write refused because the BOQ is locked by a baseline. */
export function isBaselineLockedError(error: unknown): boolean {
    if (!isApiError(error) || error.status !== 409) return false;
    const d = error.details;
    return d !== null && typeof d === 'object' && (d as { reason?: unknown }).reason === 'baseline_locked';
}

export function classifyError(error: unknown): ErrorKind {
    if (isApiError(error) && error.code === 'version_conflict') return 'conflict';
    if (isApiError(error) && !isRetryable(error)) return 'rejected';
    return 'retry';
}

const ALWAYS_ONLINE: NetworkState = { isOnline: () => true, subscribe: () => () => undefined };
const GLOBAL_TIMERS: Timers = {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (h) => { globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>); },
};

const same = (a: unknown, b: unknown) => stableStringify(a ?? null) === stableStringify(b ?? null);

export class SyncEngine {
    private readonly versions = new Map<string, number>();
    /** Last data the server holds per document (what a refused edit goes back to). */
    private readonly serverData = new Map<string, unknown>();
    private readonly pending = new Map<string, Entry>();
    private readonly statusListeners = new Set<(s: SyncStatus) => void>();
    private readonly unsubscribers: (() => void)[] = [];
    private readonly opts: Required<Omit<SyncEngineOptions, 'storage' | 'onEvent' | 'initialDocs'>>
        & Pick<SyncEngineOptions, 'storage' | 'onEvent'>;
    private shadow: Project;
    private applying = false;
    private online: boolean;
    private started = false;
    private disposed = false;
    private lastStatus = '';

    constructor(options: SyncEngineOptions) {
        this.opts = {
            store: options.store,
            transport: options.transport,
            storage: options.storage,
            network: options.network ?? ALWAYS_ONLINE,
            timers: options.timers ?? GLOBAL_TIMERS,
            debounceMs: options.debounceMs ?? SYNC_DEBOUNCE_MS,
            retryBaseMs: options.retryBaseMs ?? RETRY_BASE_MS,
            retryMaxMs: options.retryMaxMs ?? RETRY_MAX_MS,
            onEvent: options.onEvent,
        };
        for (const d of options.initialDocs) {
            this.versions.set(d.docKey, d.version);
            this.serverData.set(d.docKey, d.data);
        }
        this.shadow = options.store.getProject();
        this.online = this.opts.network.isOnline();
    }

    /** Start watching the store. Edits saved in the queue by an earlier page load are re-applied and sent. */
    start(): void {
        if (this.started || this.disposed) return;
        this.started = true;
        this.shadow = this.opts.store.getProject();
        this.unsubscribers.push(this.opts.store.subscribe(p => { this.onStoreChange(p); }));
        this.unsubscribers.push(this.opts.network.subscribe(online => { this.onNetwork(online); }));
        const saved = this.opts.storage?.load();
        for (const [docKey, doc] of Object.entries(saved?.pending ?? {})) {
            if (!parseDocKey(docKey)) continue;
            this.applyLocal(docKey, doc.data);
            this.pending.set(docKey, { data: doc.data, baseVersion: doc.baseVersion, phase: 'debounce', timer: undefined, attempt: 0 });
            this.schedule(docKey, 0);
        }
        this.emitStatus();
    }

    /** Stop (timers and subscriptions). Unsent edits stay in the saved queue for the next time the project opens. */
    dispose(): void {
        if (this.isDisposed()) return;
        this.disposed = true;
        for (const e of this.pending.values()) this.opts.timers.clearTimeout(e.timer);
        for (const u of this.unsubscribers.splice(0)) u();
        this.statusListeners.clear();
    }

    /** The project is gone (deleted): forget every unsent edit, including the saved queue, and stop. */
    discard(): void {
        if (this.isDisposed()) return;
        for (const e of this.pending.values()) this.opts.timers.clearTimeout(e.timer);
        this.pending.clear();
        this.persist();
        this.dispose();
    }

    getStatus(): SyncStatus {
        const count = this.pending.size;
        if (!this.online) return { state: 'offline', count };
        if (count === 0) return { state: 'saved', count };
        const busy = [...this.pending.values()].some(e => e.phase === 'debounce' || e.phase === 'flight');
        return { state: busy ? 'saving' : 'pending', count };
    }

    onStatus(listener: (s: SyncStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => { this.statusListeners.delete(listener); };
    }

    /** A method, not the field: it is read again after every await (dispose may happen meanwhile). */
    private isDisposed(): boolean {
        return this.disposed;
    }

    /** Server version known for a document (0 = none). */
    versionOf(docKey: string): number {
        return this.versions.get(docKey) ?? 0;
    }

    hasPending(docKey: string): boolean {
        return this.pending.has(docKey);
    }

    pendingKeys(): string[] {
        return [...this.pending.keys()];
    }

    /**
     * A document another member saved (realtime `doc.updated`). Applied when it is newer than what we know and we
     * have no local edit of it waiting; with a local edit waiting the server answers our write with 409 and the
     * conflict rule settles it. Returns whether it was applied.
     */
    applyRemoteDoc(doc: ProjectDocDto): boolean {
        if (this.disposed || doc.version <= this.versionOf(doc.docKey) || this.pending.has(doc.docKey)) return false;
        this.versions.set(doc.docKey, doc.version);
        this.serverData.set(doc.docKey, doc.data);
        this.applyLocal(doc.docKey, doc.data);
        this.opts.onEvent?.({ type: 'remote', doc });
        return true;
    }

    /** Resolves when nothing is being sent or about to be sent (or after `timeoutMs`). */
    whenSettled(timeoutMs: number): Promise<void> {
        return new Promise(resolve => {
            if (this.disposed || this.getStatus().state !== 'saving') {
                resolve();
                return;
            }
            let timer: unknown = undefined;
            let unsubscribe: () => void = () => undefined;
            const done = () => {
                unsubscribe();
                this.opts.timers.clearTimeout(timer);
                resolve();
            };
            unsubscribe = this.onStatus(s => { if (s.state !== 'saving') done(); });
            timer = this.opts.timers.setTimeout(done, timeoutMs);
        });
    }

    /** Send everything waiting now (skips the debounce). */
    flushAll(): void {
        for (const key of this.pending.keys()) this.schedule(key, 0);
    }

    // ── internals ──

    private onStoreChange(next: Project): void {
        if (this.isDisposed()) return;
        const prev = this.shadow;
        this.shadow = next;
        if (this.applying || prev === next) return;
        const changes = diffDocs(prev, next);
        if (changes.length === 0) return;
        for (const c of changes) this.enqueue(c.docKey, c.data);
        this.persist();
        this.emitStatus();
    }

    private onNetwork(online: boolean): void {
        if (this.isDisposed()) return;
        this.online = online;
        if (online) {
            for (const e of this.pending.values()) e.attempt = 0;
            this.flushAll();
        }
        this.emitStatus();
    }

    private enqueue(docKey: string, data: unknown): void {
        const e = this.pending.get(docKey);
        if (e) {
            e.data = data;
            e.attempt = 0;
            if (e.phase === 'flight') return; // sent again on the new version when the answer comes back
        } else {
            this.pending.set(docKey, { data, baseVersion: this.versionOf(docKey), phase: 'debounce', timer: undefined, attempt: 0 });
        }
        this.schedule(docKey, this.opts.debounceMs);
    }

    private schedule(docKey: string, delay: number, phase: Phase = 'debounce'): void {
        const e = this.pending.get(docKey);
        if (!e || e.phase === 'flight' || this.disposed) return;
        this.opts.timers.clearTimeout(e.timer);
        e.phase = phase;
        e.timer = this.opts.timers.setTimeout(() => {
            e.timer = undefined;
            void this.send(docKey);
        }, delay);
    }

    private async send(docKey: string): Promise<void> {
        const e = this.pending.get(docKey);
        if (!e || e.phase === 'flight' || this.disposed) return;
        if (!this.online) {
            e.phase = 'waiting-online';
            this.emitStatus();
            return;
        }
        // Edited and edited back: nothing to send.
        if (e.baseVersion === this.versionOf(docKey) && same(e.data, this.serverData.get(docKey))) {
            this.pending.delete(docKey);
            this.persist();
            this.emitStatus();
            return;
        }
        const sent = e.data;
        e.phase = 'flight';
        this.emitStatus();
        try {
            const res = await this.opts.transport.putDoc(docKey, { data: sent ?? null, baseVersion: e.baseVersion });
            if (this.isDisposed()) return;
            this.versions.set(docKey, res.doc.version);
            this.serverData.set(docKey, res.doc.data);
            e.attempt = 0;
            e.phase = 'debounce';
            if (this.pending.get(docKey) === e && same(e.data, sent)) {
                this.pending.delete(docKey);
            } else {
                e.baseVersion = res.doc.version;
                this.schedule(docKey, 0);
            }
            this.opts.onEvent?.({ type: 'saved', doc: res.doc, project: res.project });
        } catch (error) {
            if (this.isDisposed()) return;
            e.phase = 'debounce';
            await this.onSendError(docKey, e, error);
            if (this.isDisposed()) return;
        }
        this.persist();
        this.emitStatus();
    }

    private async onSendError(docKey: string, e: Entry, error: unknown): Promise<void> {
        if (isBaselineLockedError(error)) {
            this.pending.delete(docKey);
            this.applyLocal(docKey, this.serverData.get(docKey) ?? null);
            this.opts.onEvent?.({ type: 'locked', docKey });
            // The other BOQ edits waiting would be refused the same way: drop them now (one in flight answers itself).
            for (const [key, other] of [...this.pending]) {
                if (other.phase === 'flight' || !isBaselineLockedDoc(key)) continue;
                this.opts.timers.clearTimeout(other.timer);
                this.pending.delete(key);
                this.applyLocal(key, this.serverData.get(key) ?? null);
            }
            return;
        }
        const kind = classifyError(error);
        if (kind === 'retry') {
            e.attempt += 1;
            const delay = Math.min(this.opts.retryBaseMs * 2 ** (e.attempt - 1), this.opts.retryMaxMs);
            this.schedule(docKey, delay, 'retry');
            return;
        }
        this.pending.delete(docKey);
        if (kind === 'rejected') {
            this.applyLocal(docKey, this.serverData.get(docKey) ?? null);
            this.opts.onEvent?.({ type: 'rejected', docKey, error });
            return;
        }
        let current: ProjectDocDto | null | undefined = undefined;
        const details = isApiError(error) ? versionConflictDetailsSchema.safeParse(error.details) : undefined;
        if (details?.success) current = details.data.current;
        else if (this.opts.transport.fetchDoc) current = await this.opts.transport.fetchDoc(docKey).catch(() => undefined);
        if (this.isDisposed()) return;
        if (current === undefined) {
            // The server did not say what it has: go back to what we last knew.
            this.applyLocal(docKey, this.serverData.get(docKey) ?? null);
            this.opts.onEvent?.({ type: 'conflict', docKey, current: null });
            return;
        }
        if (current === null) this.versions.delete(docKey);
        else this.versions.set(docKey, current.version);
        this.serverData.set(docKey, current?.data ?? null);
        this.applyLocal(docKey, current?.data ?? null);
        this.opts.onEvent?.({ type: 'conflict', docKey, current });
    }

    /** Put a document into the working copy without treating it as a local edit. */
    private applyLocal(docKey: string, data: unknown): void {
        this.applying = true;
        try {
            this.opts.store.setProject(applyDoc(this.opts.store.getProject(), docKey, data));
        } finally {
            this.applying = false;
        }
        this.shadow = this.opts.store.getProject();
    }

    private persist(): void {
        if (!this.opts.storage || this.disposed) return;
        const pending = Object.fromEntries(
            [...this.pending].map(([k, e]): [string, PendingDoc] => [k, { data: e.data, baseVersion: e.baseVersion }]),
        );
        this.opts.storage.save({ pending });
    }

    private emitStatus(): void {
        if (this.isDisposed()) return;
        const status = this.getStatus();
        const key = `${status.state}:${String(status.count)}`;
        if (key === this.lastStatus) return;
        this.lastStatus = key;
        for (const l of this.statusListeners) l(status);
    }
}
