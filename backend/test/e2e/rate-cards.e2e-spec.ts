// ─── E2E: the workspace rate-card library (list, create, update, archive) over HTTP, in-memory persistence ───
import { z } from 'zod';
import {
    MAX_ACTIVE_RATE_CARDS, type RateCardDto, type Role, rateCardConflictDetailsSchema, rateCardDtoSchema,
} from '@contrack/contract';
import {
    type Session, type TestApp, addMember, bearer, createCompany, expectError, expectStatus, register, startApp,
} from '../support/e2e';

const UNKNOWN_ID = '00000000-0000-4000-8000-0000000000ff';

describe('rate cards (e2e)', () => {
    let t: TestApp;
    let owner: Session;
    let admin: Session;
    let estimator: Session;
    let viewer: Session;
    let outsider: Session;
    let workspaceId: string;
    let otherWorkspaceId: string;
    const as: Partial<Record<Role, Session>> = {};

    beforeAll(async () => {
        t = await startApp();
        owner = await register(t, 'Owner');
        admin = await register(t, 'Admin');
        estimator = await register(t, 'Estimator');
        viewer = await register(t, 'Viewer');
        outsider = await register(t, 'Outsider');
        workspaceId = (await createCompany(t, owner, 'Acme')).id;
        otherWorkspaceId = (await createCompany(t, outsider, 'Other Co')).id;
        await addMember(t, owner, workspaceId, admin, 'admin');
        await addMember(t, owner, workspaceId, estimator, 'estimator');
        await addMember(t, owner, workspaceId, viewer, 'viewer');
        Object.assign(as, { owner, admin, estimator, viewer });
    });

    afterAll(async () => {
        await t.close();
    });

    const base = (ws = workspaceId) => `/workspaces/${ws}/rate-cards`;
    const list = (s: Session, ws = workspaceId) => t.http().get(base(ws)).set(bearer(s.accessToken));
    const create = (s: Session, body: Record<string, unknown>, ws = workspaceId) =>
        t.http().post(base(ws)).set(bearer(s.accessToken)).send(body);
    const patch = (s: Session, id: string, body: Record<string, unknown>, ws = workspaceId) =>
        t.http().patch(`${base(ws)}/${id}`).set(bearer(s.accessToken)).send(body);
    const archive = (s: Session, id: string, ws = workspaceId) => t.http().delete(`${base(ws)}/${id}`).set(bearer(s.accessToken));

    let nameSeq = 0;
    async function newCard(body: Record<string, unknown> = {}, by: Session = owner, ws = workspaceId): Promise<RateCardDto> {
        nameSeq += 1;
        const res = await create(by, { name: `card ${nameSeq}`, skilledRate: 800, labourerRate: 500, ...body }, ws);
        expectStatus(res, 201);
        return rateCardDtoSchema.parse(res.body);
    }

    async function listed(s: Session = owner, ws = workspaceId): Promise<RateCardDto[]> {
        const res = await list(s, ws);
        expectStatus(res, 200);
        return z.array(rateCardDtoSchema).parse(res.body);
    }

    describe('auth', () => {
        it('every route needs a signed-in user', async () => {
            expectError(await t.http().get(base()), 401, 'unauthenticated');
            expectError(await t.http().post(base()).send({ name: 'A', skilledRate: 1, labourerRate: 1 }), 401, 'unauthenticated');
            expectError(await t.http().patch(`${base()}/${UNKNOWN_ID}`).send({ skilledRate: 1 }), 401, 'unauthenticated');
            expectError(await t.http().delete(`${base()}/${UNKNOWN_ID}`), 401, 'unauthenticated');
            expectError(await t.http().get(base()).set(bearer('not-a-token')), 401, 'unauthenticated');
        });
    });

    describe('create and list', () => {
        it('creates a card (201) that the whole workspace then sees, in creation order', async () => {
            const res = await create(owner, { name: '  ทีมไฟฟ้า ช่างพงษ์ ', skilledRate: 1200, labourerRate: 650, note: 'งานไฟฟ้า' });
            expectStatus(res, 201);
            const card = rateCardDtoSchema.parse(res.body);
            expect(card).toMatchObject({
                workspaceId, name: 'ทีมไฟฟ้า ช่างพงษ์', skilledRate: 1200, labourerRate: 650, note: 'งานไฟฟ้า',
                createdBy: owner.userId, archivedAt: null,
            });
            expect(card.createdAt).toBe(t.clock.now().toISOString());
            for (const s of [owner, admin, estimator, viewer]) {
                expect((await listed(s)).map(c => c.id)).toContain(card.id);
            }
            t.clock.advance(1000); // the app's clock is fixed: equal times would be ordered by (random) id
            const later = await newCard();
            const ids = (await listed()).map(c => c.id);
            expect(ids.indexOf(card.id)).toBeLessThan(ids.indexOf(later.id));
        });

        it('a missing or blank note is null', async () => {
            expect((await newCard()).note).toBeNull();
            expect((await newCard({ note: '   ' })).note).toBeNull();
            expect((await newCard({ note: null })).note).toBeNull();
        });

        it('refuses a duplicate active name (ignoring case) with name_taken details', async () => {
            await newCard({ name: 'Duplicate Me' });
            const res = await create(owner, { name: 'duplicate me', skilledRate: 1, labourerRate: 1 });
            const body = expectError(res, 409, 'conflict');
            expect(rateCardConflictDetailsSchema.parse(body.details)).toEqual({ reason: 'name_taken', name: 'duplicate me' });
        });
    });

    describe('validation', () => {
        it.each<[string, Record<string, unknown>]>([
            ['no name', { skilledRate: 1, labourerRate: 1 }],
            ['a blank name', { name: '   ', skilledRate: 1, labourerRate: 1 }],
            ['a 61-character name', { name: 'x'.repeat(61), skilledRate: 1, labourerRate: 1 }],
            ['a negative rate', { name: 'A', skilledRate: -1, labourerRate: 1 }],
            ['a rate over 100,000', { name: 'A', skilledRate: 1, labourerRate: 100_001 }],
            ['a fractional rate', { name: 'A', skilledRate: 800.5, labourerRate: 1 }],
            ['a rate given as a string', { name: 'A', skilledRate: '800', labourerRate: 1 }],
            ['a missing rate', { name: 'A', skilledRate: 1 }],
            ['a note over 500 characters', { name: 'A', skilledRate: 1, labourerRate: 1, note: 'x'.repeat(501) }],
        ])('create refuses %s (400)', async (_what, body) => {
            expectError(await create(owner, body), 400, 'validation_failed');
        });

        it('accepts the bounds: 60-character name, rates 0 and 100,000', async () => {
            const card = await newCard({ name: 'ช'.repeat(60), skilledRate: 0, labourerRate: 100_000 });
            expect(card).toMatchObject({ skilledRate: 0, labourerRate: 100_000 });
        });

        it('update refuses an empty body and invalid values (400)', async () => {
            const card = await newCard();
            expectError(await patch(owner, card.id, {}), 400, 'validation_failed');
            expectError(await patch(owner, card.id, { name: '' }), 400, 'validation_failed');
            expectError(await patch(owner, card.id, { skilledRate: 100_001 }), 400, 'validation_failed');
            expectError(await patch(owner, card.id, { labourerRate: 1.25 }), 400, 'validation_failed');
        });

        it('a malformed id is a 404 like an unknown one', async () => {
            expectError(await patch(owner, 'not-a-uuid', { skilledRate: 1 }), 404, 'not_found');
            expectError(await archive(owner, 'not-a-uuid'), 404, 'not_found');
            expectError(await list(owner, 'not-a-uuid'), 404, 'not_found');
        });
    });

    describe('update', () => {
        it('changes the rates, renames and clears the note; unchanged fields stay', async () => {
            const card = await newCard({ name: 'ชุด B', skilledRate: 1000, labourerRate: 600, note: 'หลังคา' });
            t.clock.advance(60_000);
            const res = await patch(owner, card.id, { name: 'ชุด B (2026)', labourerRate: 650, note: null });
            expectStatus(res, 200);
            const updated = rateCardDtoSchema.parse(res.body);
            expect(updated).toMatchObject({ id: card.id, name: 'ชุด B (2026)', skilledRate: 1000, labourerRate: 650, note: null });
            expect(updated.updatedAt).toBe(t.clock.now().toISOString());
            expect((await listed()).find(c => c.id === card.id)).toEqual(updated);
        });

        it('refuses renaming onto another active card (409 name_taken)', async () => {
            await newCard({ name: 'Rename Target' });
            const card = await newCard();
            const body = expectError(await patch(owner, card.id, { name: 'RENAME TARGET' }), 409, 'conflict');
            expect(rateCardConflictDetailsSchema.parse(body.details).reason).toBe('name_taken');
        });
    });

    describe('archive', () => {
        it('204; the card leaves the list, its name is free again, a second archive is still 204', async () => {
            const card = await newCard({ name: 'To Archive' });
            expectStatus(await archive(owner, card.id), 204);
            expect((await listed()).map(c => c.id)).not.toContain(card.id);
            expectStatus(await archive(owner, card.id), 204);
            expect((await newCard({ name: 'to archive' })).name).toBe('to archive');
            // An archived card cannot be edited.
            expectError(await patch(owner, card.id, { skilledRate: 1 }), 404, 'not_found');
        });

        it('an unknown card is 404', async () => {
            expectError(await archive(owner, UNKNOWN_ID), 404, 'not_found');
        });
    });

    describe('permissions per role', () => {
        it.each<[Role, number]>([['owner', 201], ['admin', 201], ['estimator', 201], ['viewer', 403]])(
            '%s create → %s',
            async (role, status) => {
                const res = await create(as[role]!, { name: `by ${role}`, skilledRate: 900, labourerRate: 550 });
                if (status === 201) expectStatus(res, 201);
                else expectError(res, status, 'forbidden');
            },
        );

        it.each<[Role, number]>([['owner', 200], ['admin', 200], ['estimator', 403], ['viewer', 403]])(
            '%s update → %s',
            async (role, status) => {
                const card = await newCard();
                const res = await patch(as[role]!, card.id, { skilledRate: 999 });
                if (status === 200) expectStatus(res, 200);
                else expectError(res, status, 'forbidden');
            },
        );

        it.each<[Role, number]>([['owner', 204], ['admin', 204], ['estimator', 403], ['viewer', 403]])(
            '%s archive → %s',
            async (role, status) => {
                const card = await newCard();
                const res = await archive(as[role]!, card.id);
                if (status === 204) expectStatus(res, 204);
                else expectError(res, status, 'forbidden');
            },
        );

        it('an estimator may not edit even the card they created', async () => {
            const card = await newCard({}, estimator);
            expectError(await patch(estimator, card.id, { skilledRate: 1 }), 403, 'forbidden');
            expectError(await archive(estimator, card.id), 403, 'forbidden');
        });
    });

    describe('tenant isolation', () => {
        it('a non-member gets 404 on every route of the workspace', async () => {
            const card = await newCard();
            expectError(await list(outsider), 404, 'not_found');
            expectError(await create(outsider, { name: 'x', skilledRate: 1, labourerRate: 1 }), 404, 'not_found');
            expectError(await patch(outsider, card.id, { skilledRate: 1 }), 404, 'not_found');
            expectError(await archive(outsider, card.id), 404, 'not_found');
        });

        it("another workspace's card is 404 through this workspace, and stays untouched", async () => {
            const foreign = await newCard({ name: 'Foreign card' }, outsider, otherWorkspaceId);
            expect((await listed()).map(c => c.id)).not.toContain(foreign.id);
            expectError(await patch(owner, foreign.id, { skilledRate: 1 }), 404, 'not_found');
            expectError(await archive(owner, foreign.id), 404, 'not_found');
            expect(await listed(outsider, otherWorkspaceId)).toEqual([foreign]);
        });

        it('the same name may exist in two workspaces', async () => {
            await newCard({ name: 'Shared Name' });
            expect((await newCard({ name: 'Shared Name' }, outsider, otherWorkspaceId)).name).toBe('Shared Name');
        });

        it('a personal workspace has its own library', async () => {
            const card = await newCard({ name: 'Mine' }, viewer, viewer.personalWorkspaceId);
            expect((await listed(viewer, viewer.personalWorkspaceId)).map(c => c.id)).toEqual([card.id]);
        });
    });

    describe('limit', () => {
        it(`keeps at most ${MAX_ACTIVE_RATE_CARDS} active cards (409 limit_reached); archiving one makes room`, async () => {
            const ws = (await createCompany(t, owner, 'Limit Co')).id;
            const first = await newCard({}, owner, ws);
            for (let i = 1; i < MAX_ACTIVE_RATE_CARDS; i += 1) await newCard({}, owner, ws);
            const body = expectError(await create(owner, { name: 'one too many', skilledRate: 1, labourerRate: 1 }, ws), 409, 'conflict');
            expect(rateCardConflictDetailsSchema.parse(body.details)).toEqual({ reason: 'limit_reached', limit: MAX_ACTIVE_RATE_CARDS });
            expectStatus(await archive(owner, first.id, ws), 204);
            expectStatus(await create(owner, { name: 'one too many', skilledRate: 1, labourerRate: 1 }, ws), 201);
            expect(await listed(owner, ws)).toHaveLength(MAX_ACTIVE_RATE_CARDS);
        });
    });
});
