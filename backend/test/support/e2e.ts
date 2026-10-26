// ─── E2E support: the whole app on an ephemeral port (in-memory persistence), HTTP and Socket.IO helpers ───
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { type Socket, io } from 'socket.io-client';
import request from 'supertest';
import type { Response } from 'supertest';
import {
    type AuthResponse, type ClientToServerEvents, type CreateInvitationRequest, type ErrorCode, type ErrorResponse,
    REALTIME_NAMESPACE, REFRESH_COOKIE, type ServerToClientEvents, type WorkspaceDto, authResponseSchema,
    createInvitationResponseSchema, errorResponseSchema, meResponseSchema, workspaceDtoSchema,
} from '@contrack/contract';
import { createApp } from '../../src/bootstrap';
import type { Env } from '../../src/shared/infrastructure/config/env';
import { testEnv } from '../../src/shared/infrastructure/config/env';
import { FixedClock } from '../../src/shared/infrastructure/system';

/** The cookie path the e2e apps use (the browser would call the API directly). */
export const COOKIE_PATH = '/auth';

export interface TestApp {
    app: INestApplication;
    /** http://127.0.0.1:<port> */
    url: string;
    clock: FixedClock;
    http: () => ReturnType<typeof request>;
    close: () => Promise<void>;
}

/** Boots the app (FixedClock, in-memory persistence) and listens on an ephemeral port. */
export async function startApp(overrides: Partial<Record<keyof Env, string>> = {}): Promise<TestApp> {
    const clock = new FixedClock(new Date('2026-03-01T09:00:00.000Z'));
    const app = await createApp({ env: testEnv({ REFRESH_COOKIE_PATH: COOKIE_PATH, ...overrides }), clock });
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as Server;
    const { port } = server.address() as AddressInfo;
    const sockets = new Set<Socket>();
    trackedSockets.set(app, sockets);
    return {
        app,
        url: `http://127.0.0.1:${port}`,
        clock,
        http: () => request(server),
        close: async () => {
            for (const s of sockets) s.disconnect();
            await app.close();
        },
    };
}

const trackedSockets = new WeakMap<INestApplication, Set<Socket>>();

let sequence = 0;
/** A unique e-mail per call (the in-memory stores live as long as the app). */
export function uniqueEmail(name: string): string {
    sequence += 1;
    return `${name.toLowerCase()}.${sequence}.${Date.now().toString(36)}@example.com`;
}

export const PASSWORD = 'correct horse battery staple';

export interface Session {
    accessToken: string;
    userId: string;
    email: string;
    displayName: string;
    /** `contrack_rt=<token>` as sent back in a Cookie header. */
    cookie: string;
    personalWorkspaceId: string;
}

export const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

/** Set-Cookie headers of a response (always an array). */
export function setCookies(res: Response): string[] {
    const raw: unknown = res.headers['set-cookie'];
    if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
    return typeof raw === 'string' ? [raw] : [];
}

/** The refresh cookie set by a response: its `name=value` pair and all its attributes. */
export function refreshCookieOf(res: Response): { pair: string; value: string; attributes: string[] } {
    const header = setCookies(res).find(c => c.startsWith(`${REFRESH_COOKIE}=`));
    if (header === undefined) throw new Error(`no ${REFRESH_COOKIE} cookie in ${JSON.stringify(setCookies(res))}`);
    const [pair = '', ...attributes] = header.split(';').map(p => p.trim());
    return { pair, value: pair.slice(REFRESH_COOKIE.length + 1), attributes };
}

/** The error body (fails the test when it is not an ErrorResponse) after checking status and code. */
export function expectError(res: Response, status: number, code: ErrorCode): ErrorResponse {
    if (res.status !== status) {
        throw new Error(`expected ${status} ${code}, got ${res.status} ${JSON.stringify(res.body)}`);
    }
    const body = errorResponseSchema.parse(res.body);
    expect(body.code).toBe(code);
    return body;
}

/** Fails with the response body when the status is not the expected one (clearer than a bare toBe). */
export function expectStatus(res: Response, status: number): void {
    if (res.status !== status) throw new Error(`expected ${status}, got ${res.status} ${JSON.stringify(res.body)}`);
}

export async function register(t: TestApp, name: string, email = uniqueEmail(name)): Promise<Session> {
    const res = await t.http().post('/auth/register').send({ email, password: PASSWORD, displayName: name });
    expectStatus(res, 201);
    const body: AuthResponse = authResponseSchema.parse(res.body);
    const me = meResponseSchema.parse((await t.http().get('/me').set(bearer(body.accessToken))).body);
    const personal = me.workspaces.find(w => w.kind === 'personal');
    if (personal === undefined) throw new Error('no personal workspace after register');
    return {
        accessToken: body.accessToken,
        userId: body.user.id,
        email: body.user.email,
        displayName: body.user.displayName,
        cookie: refreshCookieOf(res).pair,
        personalWorkspaceId: personal.id,
    };
}

/** Signs in again (new access token, e.g. after the clock moved past the access-token TTL). */
export async function login(t: TestApp, s: Session): Promise<Session> {
    const res = await t.http().post('/auth/login').send({ email: s.email, password: PASSWORD });
    expectStatus(res, 200);
    const body = authResponseSchema.parse(res.body);
    return { ...s, accessToken: body.accessToken, cookie: refreshCookieOf(res).pair };
}

export async function createCompany(t: TestApp, owner: Session, name = 'Company'): Promise<WorkspaceDto> {
    const res = await t.http().post('/workspaces').set(bearer(owner.accessToken)).send({ name });
    expectStatus(res, 201);
    return workspaceDtoSchema.parse(res.body);
}

export async function invite(
    t: TestApp, by: Session, workspaceId: string, email: string, role: CreateInvitationRequest['role'],
): Promise<string> {
    const res = await t.http().post(`/workspaces/${workspaceId}/invitations`).set(bearer(by.accessToken)).send({ email, role });
    expectStatus(res, 201);
    return createInvitationResponseSchema.parse(res.body).token;
}

/** Invites and accepts: the user becomes a member with `role`. */
export async function addMember(
    t: TestApp, owner: Session, workspaceId: string, member: Session, role: CreateInvitationRequest['role'],
): Promise<void> {
    const token = await invite(t, owner, workspaceId, member.email, role);
    const res = await t.http().post('/invitations/accept').set(bearer(member.accessToken)).send({ token });
    expectStatus(res, 200);
}

// ── Socket.IO ──

export type RealtimeClient = Socket<ServerToClientEvents, ClientToServerEvents>;

/** A socket that is not connected yet (connect with `open`). */
function newSocket(t: TestApp, token: string | undefined): RealtimeClient {
    const socket: RealtimeClient = io(`${t.url}${REALTIME_NAMESPACE}`, {
        auth: token === undefined ? {} : { token },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
    });
    trackedSockets.get(t.app)?.add(socket);
    return socket;
}

/** Connects with the token; rejects with the connect_error. */
export function connect(t: TestApp, token: string | undefined): Promise<RealtimeClient> {
    const socket = newSocket(t, token);
    return new Promise((resolve, reject) => {
        socket.once('connect', () => { resolve(socket); });
        socket.once('connect_error', error => {
            socket.disconnect();
            reject(error);
        });
    });
}

type EventPayload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

/**
 * The next `event` matching `predicate`. Start waiting BEFORE triggering the event (it may arrive at once).
 */
export function nextEvent<E extends keyof ServerToClientEvents>(
    socket: RealtimeClient,
    event: E,
    predicate: (payload: EventPayload<E>) => boolean = () => true,
    timeoutMs = 3000,
): Promise<EventPayload<E>> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, listener as never);
            reject(new Error(`timed out waiting for ${event}`));
        }, timeoutMs);
        const listener = (payload: EventPayload<E>): void => {
            if (!predicate(payload)) return;
            clearTimeout(timer);
            socket.off(event, listener as never);
            resolve(payload);
        };
        socket.on(event, listener as never);
    });
}

/** Collects every `event` the socket receives (for asserting that something did NOT arrive). */
export function recordEvents<E extends keyof ServerToClientEvents>(socket: RealtimeClient, event: E): EventPayload<E>[] {
    const seen: EventPayload<E>[] = [];
    socket.on(event, ((payload: EventPayload<E>) => { seen.push(payload); }) as never);
    return seen;
}

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Joins a project and waits for the presence.state that follows the ack. */
export async function joinProject(socket: RealtimeClient, projectId: string): Promise<EventPayload<'presence.state'>> {
    const state = nextEvent(socket, 'presence.state', e => e.projectId === projectId);
    const ack = await socket.timeout(3000).emitWithAck('project.join', { projectId });
    if (!ack.ok) throw new Error(`join refused: ${ack.code}`);
    return state;
}
