// ─── Realtime connection (Socket.IO): join the open project, receive its events, send presence ───
// No React here. The access token is read on every (re)connect, and a connection the server refused (expired
// token) is retried once with a freshly refreshed token.
import { io, type Socket } from 'socket.io-client';
import {
    PRESENCE_HEARTBEAT_MS, REALTIME_NAMESPACE, assignmentUpdatedEventSchema, docUpdatedEventSchema,
    presenceStateEventSchema, projectDeletedEventSchema, projectUpdatedEventSchema, type Ack, type AssignmentUpdatedEvent, type ClientToServerEvents,
    type DocUpdatedEvent, type PresenceStateEvent, type ProjectDeletedEvent, type ProjectUpdatedEvent, type ServerToClientEvents,
} from '@/shared/contract';

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface RealtimeHandlers {
    onDoc: (e: DocUpdatedEvent) => void;
    onProject: (e: ProjectUpdatedEvent) => void;
    onProjectDeleted: (e: ProjectDeletedEvent) => void;
    onPresence: (e: PresenceStateEvent) => void;
    onAssignment: (e: AssignmentUpdatedEvent) => void;
    onConnectionChange?: (connected: boolean) => void;
}

export interface RealtimeOptions {
    url: string;
    getToken: () => string | null;
    /** A new access token after the server refused the current one (null = signed out: stop). */
    refreshToken: () => Promise<string | null>;
    handlers: RealtimeHandlers;
    /** For tests. */
    connect?: (url: string, opts: { auth: (cb: (data: object) => void) => void }) => RealtimeSocket;
    heartbeatMs?: number;
}

/** The build-time default (NEXT_PUBLIC_REALTIME_URL, else localhost), used when /app-config cannot be read. */
export function realtimeUrl(): string {
    return (process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
}

let configured: Promise<string> | undefined;

/**
 * The Socket.IO origin from the server's env at run time (GET /app-config → REALTIME_URL), asked once per page load,
 * so one built image works in any environment; the build-time default when that answer is missing.
 */
export function loadRealtimeUrl(): Promise<string> {
    configured ??= fetch('/app-config', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() as Promise<unknown> : null))
        .then(body => {
            const url = typeof body === 'object' && body !== null && 'realtimeUrl' in body ? body.realtimeUrl : undefined;
            return typeof url === 'string' && url !== '' ? url.replace(/\/+$/, '') : realtimeUrl();
        })
        .catch(() => realtimeUrl());
    return configured;
}

export class RealtimeConnection {
    private readonly socket: RealtimeSocket;
    private projectId: string | null = null;
    private levelId: string | null = null;
    private heartbeat: ReturnType<typeof setInterval> | undefined;
    private refreshing = false;
    private closed = false;

    constructor(private readonly opts: RealtimeOptions) {
        const connect = opts.connect ?? ((url, o) => io(url, { ...o, transports: ['websocket', 'polling'] }) as RealtimeSocket);
        // auth as a function: socket.io calls it on every (re)connection, so a reconnect always carries the latest token.
        this.socket = connect(`${opts.url}${REALTIME_NAMESPACE}`, { auth: (cb) => { cb({ token: opts.getToken() ?? '' }); } });
        this.wire();
    }

    /** Join a project room (leaving the previous one); null = leave. */
    join(projectId: string | null): void {
        if (projectId === this.projectId) return;
        const prev = this.projectId;
        this.projectId = projectId;
        if (this.socket.connected) {
            if (prev !== null) this.socket.emit('project.leave', { projectId: prev }, () => undefined);
            if (projectId !== null) this.emitJoin(projectId);
        }
        this.restartHeartbeat();
    }

    /** The level this user is on (null = not on a level page). Sent now and with every heartbeat. */
    setLevel(levelId: string | null): void {
        const changed = levelId !== this.levelId;
        this.levelId = levelId;
        if (changed) this.sendPresence();
    }

    close(): void {
        this.closed = true;
        this.stopHeartbeat();
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }

    private wire(): void {
        const s = this.socket;
        s.on('connect', () => {
            this.opts.handlers.onConnectionChange?.(true);
            if (this.projectId !== null) this.emitJoin(this.projectId);
        });
        s.on('disconnect', (reason) => {
            this.opts.handlers.onConnectionChange?.(false);
            // The server dropped us (bad or expired token): socket.io does not retry this on its own.
            if (reason === 'io server disconnect') void this.reconnectWithFreshToken();
        });
        s.on('connect_error', () => {
            // A refused handshake is not retried automatically (`active` false); network errors are.
            if (!s.active) void this.reconnectWithFreshToken();
        });
        s.on('doc.updated', (e) => {
            const parsed = docUpdatedEventSchema.safeParse(e);
            if (parsed.success && parsed.data.projectId === this.projectId) this.opts.handlers.onDoc(parsed.data);
        });
        s.on('project.updated', (e) => {
            const parsed = projectUpdatedEventSchema.safeParse(e);
            if (parsed.success) this.opts.handlers.onProject(parsed.data);
        });
        s.on('project.deleted', (e) => {
            const parsed = projectDeletedEventSchema.safeParse(e);
            if (parsed.success) this.opts.handlers.onProjectDeleted(parsed.data);
        });
        s.on('presence.state', (e) => {
            const parsed = presenceStateEventSchema.safeParse(e);
            if (parsed.success && parsed.data.projectId === this.projectId) this.opts.handlers.onPresence(parsed.data);
        });
        s.on('assignment.updated', (e) => {
            const parsed = assignmentUpdatedEventSchema.safeParse(e);
            if (parsed.success && parsed.data.projectId === this.projectId) this.opts.handlers.onAssignment(parsed.data);
        });
    }

    private emitJoin(projectId: string): void {
        this.socket.emit('project.join', { projectId }, (ack: Ack) => {
            if (ack.ok && projectId === this.projectId) this.sendPresence();
            else if (!ack.ok) console.warn('realtime: could not join the project', ack.code);
        });
    }

    private sendPresence(): void {
        if (this.projectId === null || !this.socket.connected) return;
        this.socket.emit('presence.update', { projectId: this.projectId, levelId: this.levelId }, () => undefined);
    }

    private restartHeartbeat(): void {
        this.stopHeartbeat();
        if (this.projectId === null) return;
        this.heartbeat = setInterval(() => { this.sendPresence(); }, this.opts.heartbeatMs ?? PRESENCE_HEARTBEAT_MS);
    }

    private stopHeartbeat(): void {
        if (this.heartbeat !== undefined) clearInterval(this.heartbeat);
        this.heartbeat = undefined;
    }

    /** Read again after awaits (close may happen meanwhile). */
    private isClosed(): boolean {
        return this.closed;
    }

    private async reconnectWithFreshToken(): Promise<void> {
        if (this.refreshing || this.closed) return;
        this.refreshing = true;
        try {
            // A short pause so a server that keeps refusing is not hammered.
            await new Promise(r => setTimeout(r, 2_000));
            const token = await this.opts.refreshToken();
            if (token !== null && !this.isClosed()) this.socket.connect();
        } finally {
            this.refreshing = false;
        }
    }
}
