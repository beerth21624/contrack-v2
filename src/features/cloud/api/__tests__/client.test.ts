import { describe, expect, it } from 'vitest';
import type { AuthResponse } from '@/shared/contract';
import { ApiClient } from '../client';
import { ApiError } from '../errors';
import { createApi } from '../routes';

const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.co', displayName: 'สมชาย', createdAt: '2026-10-26T10:00:00.000Z' };
const auth = (token: string): AuthResponse => ({ accessToken: token, expiresIn: 900, user: USER });

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function deferred<T>() {
    let resolve: (v: T) => void = () => undefined;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
}

describe('ApiClient', () => {
    it('refreshes once for concurrent 401s and retries each request with the new token', async () => {
        const refreshGate = deferred<Response>();
        const seen: { url: string; auth: string | undefined }[] = [];
        let refreshCalls = 0;
        const client = new ApiClient({
            fetch: (url, init) => {
                const authHeader = (init.headers as Record<string, string>).Authorization;
                seen.push({ url, auth: authHeader });
                if (url === '/api/auth/refresh') {
                    refreshCalls += 1;
                    return refreshGate.promise;
                }
                if (authHeader === 'Bearer new') return Promise.resolve(json(200, { user: USER, workspaces: [] }));
                return Promise.resolve(json(401, { code: 'unauthenticated', message: 'expired' }));
            },
        });
        client.setAuth(auth('old'));
        const api = createApi(client);

        const all = Promise.all([api.me(), api.me(), api.me()]);
        // Let the three 401s come back before the refresh answers.
        await new Promise(r => setTimeout(r, 0));
        refreshGate.resolve(json(200, auth('new')));
        const results = await all;

        expect(refreshCalls).toBe(1);
        expect(results.every(r => r.user.id === USER.id)).toBe(true);
        expect(seen.filter(s => s.url === '/api/me' && s.auth === 'Bearer new')).toHaveLength(3);
        expect(client.accessToken).toBe('new');
    });

    it('a request that got its 401 after another one refreshed retries without refreshing again', async () => {
        let refreshCalls = 0;
        let first = true;
        const client = new ApiClient({
            fetch: (url, init) => {
                const authHeader = (init.headers as Record<string, string>).Authorization;
                if (url === '/api/auth/refresh') {
                    refreshCalls += 1;
                    return Promise.resolve(json(200, auth('new')));
                }
                if (authHeader === 'Bearer new') return Promise.resolve(json(200, { user: USER, workspaces: [] }));
                if (first) {
                    first = false;
                    // Meanwhile someone else refreshed the token.
                    client.setAuth(auth('new'));
                }
                return Promise.resolve(json(401, { code: 'unauthenticated', message: 'expired' }));
            },
        });
        client.setAuth(auth('old'));
        await createApi(client).me();
        expect(refreshCalls).toBe(0);
    });

    it('a refused refresh signs out and the request fails with 401', async () => {
        const changes: (AuthResponse | null)[] = [];
        const client = new ApiClient({
            fetch: (url) => Promise.resolve(url === '/api/auth/refresh'
                ? json(401, { code: 'invalid_token', message: 'reused' })
                : json(401, { code: 'unauthenticated', message: 'expired' })),
        });
        client.setAuth(auth('old'));
        client.onAuthChange(a => changes.push(a));
        await expect(createApi(client).me()).rejects.toMatchObject({ status: 401, code: 'unauthenticated' });
        expect(client.accessToken).toBeNull();
        expect(changes).toEqual([null]);
    });

    it('a refresh that cannot reach the server keeps the session', async () => {
        const client = new ApiClient({ fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
        client.setAuth(auth('old'));
        expect(await client.refresh()).toBeNull();
        expect(client.accessToken).toBe('old');
    });

    it('maps error bodies and network failures to ApiError', async () => {
        const conflict = new ApiClient({
            fetch: () => Promise.resolve(json(409, { code: 'email_taken', message: 'taken', details: { field: 'email' } })),
        });
        const err = await createApi(conflict).auth.register({ email: 'a@b.co', password: '12345678', displayName: 'x' })
            .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(ApiError);
        expect(err).toMatchObject({ status: 409, code: 'email_taken', message: 'taken', details: { field: 'email' } });

        const down = new ApiClient({ fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
        await expect(createApi(down).me()).rejects.toMatchObject({ status: 0, code: 'network_error' });

        const bad = new ApiClient({ fetch: () => Promise.resolve(json(200, { nope: true })) });
        await expect(createApi(bad).me()).rejects.toMatchObject({ code: 'invalid_response' });
    });

    it('public routes send no token and never refresh', async () => {
        const urls: string[] = [];
        const client = new ApiClient({
            fetch: (url, init) => {
                urls.push(url);
                expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
                return Promise.resolve(json(401, { code: 'invalid_credentials', message: 'no' }));
            },
        });
        client.setAuth(auth('old'));
        await expect(createApi(client).auth.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({ code: 'invalid_credentials' });
        expect(urls).toEqual(['/api/auth/login']);
    });

    it('remembers whether a refresh cookie may exist (a guest browser skips the start-up refresh)', async () => {
        let stored = false;
        const sessionHint = { read: () => stored, write: (v: boolean) => { stored = v; } };
        let refreshOk = true;
        const client = new ApiClient({
            sessionHint,
            fetch: (url) => Promise.resolve(url === '/api/auth/refresh' && refreshOk
                ? json(200, auth('new'))
                : url === '/api/auth/logout' ? new Response(null, { status: 204 }) : json(401, { code: 'invalid_token', message: 'no' })),
        });
        expect(client.mayHaveSession).toBe(false);

        await createApi(client).auth.login({ email: 'a@b.co', password: 'x' }).catch(() => undefined);
        expect(stored).toBe(false); // refused login: still nothing

        expect(await client.refresh()).not.toBeNull();
        expect(stored).toBe(true);
        expect(client.mayHaveSession).toBe(true);

        await createApi(client).auth.logout();
        expect(stored).toBe(false);
        expect(client.mayHaveSession).toBe(false);

        // A dead cookie while already signed out: forgotten too, so the next start does not ask again.
        stored = true;
        refreshOk = false;
        expect(await client.refresh()).toBeNull();
        expect(stored).toBe(false);

        // Offline: the hint stays.
        stored = true;
        const offline = new ApiClient({ sessionHint, fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
        expect(await offline.refresh()).toBeNull();
        expect(stored).toBe(true);
    });

    it('encodes doc keys and query strings', async () => {
        const urls: string[] = [];
        const client = new ApiClient({
            fetch: (url) => {
                urls.push(url);
                return Promise.resolve(json(200, []));
            },
        });
        const api = createApi(client);
        await api.projects.list('ws', { archived: true });
        await api.projects.activity('p', { limit: 10 });
        expect(urls).toEqual(['/api/workspaces/ws/projects?archived=true', '/api/projects/p/activity?limit=10']);
    });
});
