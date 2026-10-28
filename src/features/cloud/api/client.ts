// ─── Typed fetch wrapper for the backend (via the Next rewrite /api → backend) ───
// The access token lives in memory only. The refresh token is an httpOnly cookie the browser sends to /api/auth/*.
// On a 401 the client refreshes once (single flight: concurrent 401s share one refresh) and retries the request.
// The cookie cannot be read from script, so the client remembers whether it has one (SessionHint): a guest browser
// then skips the start-up refresh instead of getting a 401 that the browser logs as a console error on every page.
import type { ZodType, ZodTypeDef } from 'zod';
import { authResponseSchema, type AuthResponse } from '@/shared/contract';
import { ApiError, errorFromBody } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Schema<T> = ZodType<T, ZodTypeDef, unknown>;
type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

/** Whether this browser may hold a refresh cookie: set by every sign-in or refresh, cleared by sign-out or a refused refresh. */
export interface SessionHint {
    read(): boolean;
    write(present: boolean): void;
}

const SESSION_HINT_KEY = 'contrack-session';

/** The hint in localStorage (shared by the tabs, like the cookie). Unreadable storage = "may have one", so nothing is lost. */
export const browserSessionHint: SessionHint = {
    read: () => {
        try {
            return typeof localStorage === 'undefined' || localStorage.getItem(SESSION_HINT_KEY) === '1';
        } catch {
            return true;
        }
    },
    write: (present) => {
        try {
            if (typeof localStorage === 'undefined') return;
            if (present) localStorage.setItem(SESSION_HINT_KEY, '1');
            else localStorage.removeItem(SESSION_HINT_KEY);
        } catch {
            // private mode: every start asks the server
        }
    },
};

export interface ApiClientOptions {
    /** Prefix of every path (default `/api`, rewritten by Next to the backend). */
    baseUrl?: string;
    fetch?: FetchFn;
    /** Remembers whether a refresh cookie may exist (default: nothing remembered, one always may). */
    sessionHint?: SessionHint;
}

export interface RequestOptions<T> {
    body?: unknown;
    /** Contract schema of the response body; omitted = no body expected (204). */
    schema?: Schema<T>;
    query?: Record<string, string | number | undefined>;
    /** false for the public auth routes: no bearer token and no refresh-and-retry. Default true. */
    auth?: boolean;
    signal?: AbortSignal;
}

/** Called whenever the signed-in state changes: a new token (login, refresh) or none (logout, refresh refused). */
export type AuthListener = (auth: AuthResponse | null) => void;

export class ApiClient {
    private token: string | null = null;
    private refreshing: Promise<AuthResponse | null> | null = null;
    private readonly listeners = new Set<AuthListener>();
    private readonly baseUrl: string;
    private readonly fetchFn: FetchFn;
    private readonly hint: SessionHint | undefined;

    constructor(options: ApiClientOptions = {}) {
        this.baseUrl = (options.baseUrl ?? '/api').replace(/\/+$/, '');
        this.fetchFn = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
        this.hint = options.sessionHint;
    }

    get accessToken(): string | null {
        return this.token;
    }

    /** False when this browser surely has no refresh cookie (never signed in here, signed out, or the server refused it). */
    get mayHaveSession(): boolean {
        return this.token !== null || (this.hint?.read() ?? true);
    }

    onAuthChange(listener: AuthListener): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    /** Store (or drop) the session from an AuthResponse and tell listeners. */
    setAuth(auth: AuthResponse | null): void {
        this.token = auth?.accessToken ?? null;
        this.hint?.write(auth !== null);
        for (const l of this.listeners) l(auth);
    }

    /**
     * Exchange the refresh cookie for a new access token. Concurrent calls share one request.
     * Returns null when there is no valid session (the client is then signed out) or the server cannot be reached
     * (the current state is kept).
     */
    refresh(): Promise<AuthResponse | null> {
        this.refreshing ??= this.doRefresh().finally(() => { this.refreshing = null; });
        return this.refreshing;
    }

    private async doRefresh(): Promise<AuthResponse | null> {
        try {
            const auth = await this.request('POST', '/auth/refresh', { schema: authResponseSchema, auth: false });
            this.setAuth(auth);
            return auth;
        } catch (e) {
            if (e instanceof ApiError && !e.isNetwork) {
                // No valid cookie: remembered even when already signed out, so the next start does not ask again.
                this.hint?.write(false);
                if (this.token !== null) this.setAuth(null);
            }
            return null;
        }
    }

    async request<T = undefined>(method: HttpMethod, path: string, options: RequestOptions<T> = {}): Promise<T> {
        const auth = options.auth ?? true;
        const sentToken = auth ? this.token : null;
        let res = await this.send(method, path, options, sentToken);
        if (res.status === 401 && auth) {
            // Someone else may have refreshed while this request was out: just retry with the new token.
            const token = this.token !== null && this.token !== sentToken ? this.token : (await this.refresh())?.accessToken;
            if (token !== undefined) res = await this.send(method, path, options, token);
        }
        return this.parse(res, options.schema);
    }

    private async send<T>(method: HttpMethod, path: string, options: RequestOptions<T>, token: string | null): Promise<Response> {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (options.body !== undefined) headers['Content-Type'] = 'application/json';
        if (token !== null) headers.Authorization = `Bearer ${token}`;
        try {
            return await this.fetchFn(this.url(path, options.query), {
                method,
                headers,
                body: options.body === undefined ? undefined : JSON.stringify(options.body),
                credentials: 'same-origin',
                signal: options.signal,
            });
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') throw e;
            throw new ApiError(0, 'network_error', e instanceof Error ? e.message : 'network error');
        }
    }

    private url(path: string, query: RequestOptions<unknown>['query']): string {
        const params = Object.entries(query ?? {}).filter((e): e is [string, string | number] => e[1] !== undefined);
        const qs = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
        return `${this.baseUrl}${path}${qs === '' ? '' : `?${qs}`}`;
    }

    private async parse<T>(res: Response, schema: Schema<T> | undefined): Promise<T> {
        const text = await res.text().catch(() => '');
        let body: unknown = undefined;
        if (text !== '') {
            try {
                body = JSON.parse(text) as unknown;
            } catch {
                if (res.ok) throw new ApiError(res.status, 'invalid_response', 'response is not JSON');
            }
        }
        if (!res.ok) throw errorFromBody(res.status, body, res.statusText === '' ? `HTTP ${String(res.status)}` : res.statusText);
        if (!schema) return undefined as T;
        const parsed = schema.safeParse(body);
        if (!parsed.success) throw new ApiError(res.status, 'invalid_response', 'response does not match the contract', parsed.error.flatten());
        return parsed.data;
    }
}

/** The app's one client (token in memory for the page's lifetime). */
export const apiClient = new ApiClient({ sessionHint: browserSessionHint });
