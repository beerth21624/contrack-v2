// ─── E2E: register, login, /me, refresh rotation (grace window and reuse), logout, the auth guard ───
import { JwtService } from '@nestjs/jwt';
import {
    REFRESH_COOKIE, authResponseSchema, meResponseSchema, workspaceDtoSchema,
} from '@contrack/contract';
import { REFRESH_REUSE_GRACE_MS } from '../../src/modules/identity/application/ports/auth-settings.port';
import {
    ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER,
} from '../../src/modules/identity/infrastructure/adapters/jwt-access-token.service';
import {
    COOKIE_PATH, PASSWORD, type TestApp, bearer, expectError, expectStatus, login, refreshCookieOf, register,
    setCookies, startApp, uniqueEmail,
} from '../support/e2e';

const SOME_ID = '0f0f0f0f-0000-4000-8000-000000000001';
const SOME_OTHER_ID = '0f0f0f0f-0000-4000-8000-000000000002';
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const ACCESS_TTL_SECONDS = 900;

describe('auth (e2e)', () => {
    let t: TestApp;

    beforeAll(async () => {
        t = await startApp();
    });

    afterAll(async () => {
        await t.close();
    });

    describe('POST /auth/register', () => {
        it('creates the user, a personal workspace with the owner role, and sets the refresh cookie', async () => {
            const email = uniqueEmail('Alice');
            const res = await t.http().post('/auth/register')
                .send({ email: `  ${email.toUpperCase()} `, password: PASSWORD, displayName: ' Alice ' });

            expectStatus(res, 201);
            const body = authResponseSchema.parse(res.body);
            expect(body.user.email).toBe(email);
            expect(body.user.displayName).toBe('Alice');
            expect(body.expiresIn).toBe(ACCESS_TTL_SECONDS);
            expect(JSON.stringify(res.body)).not.toContain('password');

            const cookie = refreshCookieOf(res);
            expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
            expect(cookie.attributes).toEqual(expect.arrayContaining([
                `Path=${COOKIE_PATH}`, 'HttpOnly', 'SameSite=Lax', `Max-Age=${REFRESH_TTL_SECONDS}`,
            ]));
            expect(cookie.attributes).not.toContain('Secure');
            // The refresh token never appears in the JSON body.
            expect(JSON.stringify(res.body)).not.toContain(cookie.value);

            const me = meResponseSchema.parse((await t.http().get('/me').set(bearer(body.accessToken))).body);
            expect(me.user).toEqual(body.user);
            expect(me.workspaces).toHaveLength(1);
            expect(me.workspaces[0]).toMatchObject({ kind: 'personal', role: 'owner' });

            const list = await t.http().get('/workspaces').set(bearer(body.accessToken));
            expectStatus(list, 200);
            const workspaces = workspaceDtoSchema.array().parse(list.body);
            expect(workspaces).toEqual([expect.objectContaining({ kind: 'personal', role: 'owner', memberCount: 1 })]);
        });

        it('marks the cookie Secure when COOKIE_SECURE=true', async () => {
            const secure = await startApp({ COOKIE_SECURE: 'true' });
            try {
                const res = await secure.http().post('/auth/register')
                    .send({ email: uniqueEmail('secure'), password: PASSWORD, displayName: 'S' });
                expectStatus(res, 201);
                expect(refreshCookieOf(res).attributes).toContain('Secure');
            } finally {
                await secure.close();
            }
        });

        it('refuses a taken e-mail (case-insensitive) with 409 email_taken', async () => {
            const email = uniqueEmail('taken');
            await register(t, 'Taken', email);
            const res = await t.http().post('/auth/register').send({ email: email.toUpperCase(), password: PASSWORD, displayName: 'X' });
            expectError(res, 409, 'email_taken');
        });

        it('validates the body with the contract (400 validation_failed)', async () => {
            const res = await t.http().post('/auth/register').send({ email: 'not-an-email', password: 'short', displayName: '' });
            expectError(res, 400, 'validation_failed');
        });
    });

    describe('POST /auth/login', () => {
        it('signs in with the right password and sets a new refresh cookie', async () => {
            const alice = await register(t, 'Alice');
            const res = await t.http().post('/auth/login').send({ email: alice.email.toUpperCase(), password: PASSWORD });
            expectStatus(res, 200);
            const body = authResponseSchema.parse(res.body);
            expect(body.user.id).toBe(alice.userId);
            expect(refreshCookieOf(res).pair).not.toBe(alice.cookie);
        });

        it('answers 401 invalid_credentials for a wrong password and for an unknown e-mail alike', async () => {
            const alice = await register(t, 'Alice');
            const wrong = await t.http().post('/auth/login').send({ email: alice.email, password: 'wrong password!' });
            const unknown = await t.http().post('/auth/login').send({ email: uniqueEmail('nobody'), password: PASSWORD });

            const a = expectError(wrong, 401, 'invalid_credentials');
            const b = expectError(unknown, 401, 'invalid_credentials');
            expect(a.message).toBe(b.message);
            expect(setCookies(wrong).some(c => c.startsWith(`${REFRESH_COOKIE}=`))).toBe(false);
            expect(setCookies(unknown).some(c => c.startsWith(`${REFRESH_COOKIE}=`))).toBe(false);
        });
    });

    describe('GET /me', () => {
        it('returns the user and their workspaces with roles', async () => {
            const alice = await register(t, 'Alice');
            const company = await t.http().post('/workspaces').set(bearer(alice.accessToken)).send({ name: 'Acme' });
            expectStatus(company, 201);

            const res = await t.http().get('/me').set(bearer(alice.accessToken));
            expectStatus(res, 200);
            const me = meResponseSchema.parse(res.body);
            expect(me.user).toMatchObject({ id: alice.userId, email: alice.email, displayName: 'Alice' });
            expect(me.workspaces).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: alice.personalWorkspaceId, kind: 'personal', role: 'owner' }),
                expect.objectContaining({ name: 'Acme', kind: 'company', role: 'owner' }),
            ]));
            expect(me.locale).toBe('th');
        });
    });

    describe('PATCH /me/preferences', () => {
        it('stores the UI language on the account: a new sign-in (another device) gets it from /me', async () => {
            const alice = await register(t, 'Alice');
            const res = await t.http().patch('/me/preferences').set(bearer(alice.accessToken)).send({ locale: 'en' });
            expectStatus(res, 200);
            expect(res.body).toEqual({ locale: 'en' });

            const other = await login(t, alice);
            const me = meResponseSchema.parse((await t.http().get('/me').set(bearer(other.accessToken))).body);
            expect(me.locale).toBe('en');
        });

        it('rejects an unknown locale and needs a signed-in user', async () => {
            const alice = await register(t, 'Alice');
            expectError(await t.http().patch('/me/preferences').set(bearer(alice.accessToken)).send({ locale: 'fr' }),
                400, 'validation_failed');
            expectError(await t.http().patch('/me/preferences').send({ locale: 'en' }), 401, 'unauthenticated');
        });
    });

    describe('POST /auth/refresh', () => {
        it('rotates the refresh token and issues a working access token', async () => {
            const alice = await register(t, 'Alice');
            const res = await t.http().post('/auth/refresh').set('Cookie', alice.cookie);
            expectStatus(res, 200);
            const body = authResponseSchema.parse(res.body);
            expect(body.user.id).toBe(alice.userId);

            const next = refreshCookieOf(res);
            expect(next.pair).not.toBe(alice.cookie);
            expect(next.attributes).toEqual(expect.arrayContaining([`Path=${COOKIE_PATH}`, 'HttpOnly', 'SameSite=Lax']));
            expectStatus(await t.http().get('/me').set(bearer(body.accessToken)), 200);

            // The successor rotates too.
            expectStatus(await t.http().post('/auth/refresh').set('Cookie', next.pair), 200);
        });

        it('answers 401 invalid_token without a cookie or with an unknown one', async () => {
            expectError(await t.http().post('/auth/refresh'), 401, 'invalid_token');
            const unknown = await t.http().post('/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=not-a-real-token`);
            expectError(unknown, 401, 'invalid_token');
            // The dead cookie is cleared with the same path.
            const cleared = refreshCookieOf(unknown);
            expect(cleared.value).toBe('');
            expect(cleared.attributes).toEqual(expect.arrayContaining([`Path=${COOKIE_PATH}`, expect.stringMatching(/^Expires=Thu, 01 Jan 1970/)]));
        });

        it('gives a sibling token for a token rotated inside the grace window (another tab)', async () => {
            const alice = await register(t, 'Alice');
            const first = await t.http().post('/auth/refresh').set('Cookie', alice.cookie);
            expectStatus(first, 200);
            const winner = refreshCookieOf(first).pair;

            t.clock.advance(REFRESH_REUSE_GRACE_MS - 1000);
            const second = await t.http().post('/auth/refresh').set('Cookie', alice.cookie);
            expectStatus(second, 200);
            const sibling = refreshCookieOf(second).pair;
            expect(sibling).not.toBe(winner);
            expect(authResponseSchema.parse(second.body).user.id).toBe(alice.userId);

            // Both tabs keep a working session.
            expectStatus(await t.http().post('/auth/refresh').set('Cookie', winner), 200);
            expectStatus(await t.http().post('/auth/refresh').set('Cookie', sibling), 200);
        });

        it('revokes the whole family when a rotated token is reused after the grace window', async () => {
            const alice = await register(t, 'Alice');
            const first = await t.http().post('/auth/refresh').set('Cookie', alice.cookie);
            expectStatus(first, 200);
            const successor = refreshCookieOf(first).pair;

            t.clock.advance(REFRESH_REUSE_GRACE_MS + 1000);
            const reuse = await t.http().post('/auth/refresh').set('Cookie', alice.cookie);
            expectError(reuse, 401, 'invalid_token');
            expect(refreshCookieOf(reuse).value).toBe('');

            // The legitimate successor is dead too: whoever holds a copy is signed out everywhere.
            expectError(await t.http().post('/auth/refresh').set('Cookie', successor), 401, 'invalid_token');
            // Signing in again starts a new family.
            const again = await t.http().post('/auth/login').send({ email: alice.email, password: PASSWORD });
            expectStatus(again, 200);
            expectStatus(await t.http().post('/auth/refresh').set('Cookie', refreshCookieOf(again).pair), 200);
        });
    });

    describe('POST /auth/logout', () => {
        it('revokes the family and clears the cookie', async () => {
            const alice = await register(t, 'Alice');
            const rotated = await t.http().post('/auth/refresh').set('Cookie', alice.cookie);
            expectStatus(rotated, 200);
            const current = refreshCookieOf(rotated).pair;

            const res = await t.http().post('/auth/logout').set('Cookie', current);
            expectStatus(res, 204);
            const cleared = refreshCookieOf(res);
            expect(cleared.value).toBe('');
            expect(cleared.attributes).toEqual(expect.arrayContaining([`Path=${COOKIE_PATH}`, 'HttpOnly', 'SameSite=Lax']));

            expectError(await t.http().post('/auth/refresh').set('Cookie', current), 401, 'invalid_token');
        });

        it('is idempotent without a cookie', async () => {
            expectStatus(await t.http().post('/auth/logout'), 204);
        });
    });

    describe('auth guard', () => {
        const PROTECTED: { method: 'get' | 'post' | 'patch' | 'put' | 'delete'; path: string }[] = [
            { method: 'get', path: '/me' },
            { method: 'get', path: '/workspaces' },
            { method: 'post', path: '/workspaces' },
            { method: 'get', path: `/workspaces/${SOME_ID}` },
            { method: 'patch', path: `/workspaces/${SOME_ID}` },
            { method: 'delete', path: `/workspaces/${SOME_ID}` },
            { method: 'get', path: `/workspaces/${SOME_ID}/members` },
            { method: 'patch', path: `/workspaces/${SOME_ID}/members/${SOME_OTHER_ID}` },
            { method: 'delete', path: `/workspaces/${SOME_ID}/members/${SOME_OTHER_ID}` },
            { method: 'get', path: `/workspaces/${SOME_ID}/invitations` },
            { method: 'post', path: `/workspaces/${SOME_ID}/invitations` },
            { method: 'delete', path: `/workspaces/${SOME_ID}/invitations/${SOME_OTHER_ID}` },
            { method: 'post', path: '/invitations/accept' },
            { method: 'get', path: `/workspaces/${SOME_ID}/projects` },
            { method: 'post', path: `/workspaces/${SOME_ID}/projects` },
            { method: 'get', path: `/projects/${SOME_ID}` },
            { method: 'patch', path: `/projects/${SOME_ID}` },
            { method: 'delete', path: `/projects/${SOME_ID}` },
            { method: 'put', path: `/projects/${SOME_ID}/docs/meta` },
            { method: 'get', path: `/projects/${SOME_ID}/revisions` },
            { method: 'post', path: `/projects/${SOME_ID}/revisions` },
            { method: 'get', path: `/projects/${SOME_ID}/revisions/${SOME_OTHER_ID}` },
            { method: 'get', path: `/projects/${SOME_ID}/assignments` },
            { method: 'put', path: `/projects/${SOME_ID}/assignments/project-info` },
            { method: 'get', path: `/projects/${SOME_ID}/activity` },
        ];

        let foreignToken: string;
        let expiredToken: string;

        beforeAll(async () => {
            const alice = await register(t, 'Guarded');
            foreignToken = await new JwtService({ secret: 'another-secret-another-secret-another-1' }).signAsync(
                { sub: alice.userId },
                { algorithm: 'HS256', issuer: ACCESS_TOKEN_ISSUER, audience: ACCESS_TOKEN_AUDIENCE, expiresIn: 600 },
            );
            expiredToken = alice.accessToken;
            t.clock.advance((ACCESS_TTL_SECONDS + 1) * 1000);
        });

        const BAD_AUTH: [string, (() => Record<string, string>)][] = [
            ['no Authorization header', () => ({})],
            ['a malformed token', () => bearer('not.a.jwt')],
            ['a token signed with another secret', () => bearer(foreignToken)],
            ['an expired token', () => bearer(expiredToken)],
            ['another scheme', () => ({ Authorization: `Basic ${expiredToken}` })],
        ];

        it.each(BAD_AUTH)('answers 401 unauthenticated on every protected route with %s', async (_label, headers) => {
            for (const route of PROTECTED) {
                const res = await t.http()[route.method](route.path).set(headers()).send({});
                if (res.status !== 401) throw new Error(`${route.method.toUpperCase()} ${route.path}: ${res.status}`);
                expectError(res, 401, 'unauthenticated');
            }
        });

        it('leaves the public routes open', async () => {
            expectStatus(await t.http().get('/health'), 200);
            expectError(await t.http().post('/auth/refresh'), 401, 'invalid_token');
            expectStatus(await t.http().post('/auth/logout'), 204);
        });
    });
});
