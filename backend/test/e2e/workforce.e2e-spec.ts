// ─── E2E: crews and people (business module `workforce`) over HTTP, in-memory persistence ───
// People, crews, crew assignments, project supervisors, task waits (W2); wages hidden by role; tenant isolation; the
// module switch.
import { z } from 'zod';
import {
    type CrewAssignmentDto, type CrewDto, type PersonDto, type Role, crewAssignmentDtoSchema, crewDtoSchema, personDtoSchema,
    platformModulesDtoSchema, projectDetailDtoSchema, projectSupervisorsDtoSchema, projectTaskLagsDtoSchema, rateCardDtoSchema,
    workforceConflictDetailsSchema, workspaceTaskLagsDtoSchema,
} from '@contrack/contract';
import {
    type Session, type TestApp, addMember, bearer, createCompany, expectError, expectStatus, register, startApp,
} from '../support/e2e';

const UNKNOWN_ID = '00000000-0000-4000-8000-0000000000ff';
/** The e2e clock is 2026-03-01 09:00 UTC = 16:00 in Bangkok. */
const TODAY = '2026-03-01';

describe('workforce (e2e)', () => {
    let t: TestApp;
    let owner: Session;
    let admin: Session;
    let estimator: Session;
    let viewer: Session;
    let outsider: Session;
    let ws: string;
    let otherWs: string;
    let projectId: string;
    let otherProjectId: string;
    let foreignProjectId: string;
    let cardId: string;
    const as: Record<Role, Session> = {} as Record<Role, Session>;

    beforeAll(async () => {
        t = await startApp();
        owner = await register(t, 'Owner');
        admin = await register(t, 'Admin');
        estimator = await register(t, 'Estimator');
        viewer = await register(t, 'Viewer');
        outsider = await register(t, 'Outsider');
        ws = (await createCompany(t, owner, 'บริษัท ตัวอย่าง')).id;
        otherWs = (await createCompany(t, outsider, 'Other Co')).id;
        // The module is offered by the platform (testEnv) and switched on by each company owner.
        for (const [w, s] of [[ws, owner], [otherWs, outsider]] as const) {
            expectStatus(await t.http().put(`/workspaces/${w}/modules/workforce`).set(bearer(s.accessToken)).send({ enabled: true }), 200);
        }
        await addMember(t, owner, ws, admin, 'admin');
        await addMember(t, owner, ws, estimator, 'estimator');
        await addMember(t, owner, ws, viewer, 'viewer');
        Object.assign(as, { owner, admin, estimator, viewer });
        projectId = await newProject(owner, ws, 'บ้านคุณวิชัย');
        otherProjectId = await newProject(owner, ws, 'บ้านคุณสมศรี');
        foreignProjectId = await newProject(outsider, otherWs, 'Theirs');
        const card = await t.http().post(`/workspaces/${ws}/rate-cards`).set(bearer(owner.accessToken))
            .send({ name: 'ชุด A งานทั่วไป', skilledRate: 800, labourerRate: 500 });
        expectStatus(card, 201);
        cardId = rateCardDtoSchema.parse(card.body).id;
    });

    afterAll(async () => {
        await t.close();
    });

    async function newProject(s: Session, workspaceId: string, name: string): Promise<string> {
        const res = await t.http().post(`/workspaces/${workspaceId}/projects`).set(bearer(s.accessToken)).send({ name, start: 'blank' });
        expectStatus(res, 201);
        return projectDetailDtoSchema.parse(res.body).project.id;
    }

    const req = (s: Session) => ({
        get: (path: string) => t.http().get(path).set(bearer(s.accessToken)),
        post: (path: string, body: unknown) => t.http().post(path).set(bearer(s.accessToken)).send(body as object),
        patch: (path: string, body: unknown) => t.http().patch(path).set(bearer(s.accessToken)).send(body as object),
        put: (path: string, body: unknown) => t.http().put(path).set(bearer(s.accessToken)).send(body as object),
        del: (path: string) => t.http().delete(path).set(bearer(s.accessToken)),
    });
    const people = (w = ws) => `/workspaces/${w}/people`;
    const crews = (w = ws) => `/workspaces/${w}/crews`;
    const assignments = (w = ws) => `/workspaces/${w}/crew-assignments`;
    const supervisors = (p = projectId) => `/projects/${p}/supervisors`;
    const taskLags = (p = projectId) => `/projects/${p}/task-lags`;
    const wsTaskLags = (w = ws) => `/workspaces/${w}/task-lags`;

    let seq = 0;
    async function newPerson(body: Record<string, unknown> = {}, by: Session = owner, w = ws): Promise<PersonDto> {
        seq += 1;
        const res = await req(by).post(people(w), { name: `ช่าง ${seq}`, role: 'skilled', employment: 'daily', ...body });
        expectStatus(res, 201);
        return personDtoSchema.parse(res.body);
    }
    async function newCrew(body: Record<string, unknown> = {}, by: Session = owner, w = ws): Promise<CrewDto> {
        seq += 1;
        const res = await req(by).post(crews(w), { name: `ทีม ${seq}`, trade: 'structure', skilledCount: 2, labourerCount: 3, ...body });
        expectStatus(res, 201);
        return crewDtoSchema.parse(res.body);
    }
    async function newAssignment(crewId: string, body: Record<string, unknown> = {}, by: Session = owner): Promise<CrewAssignmentDto> {
        const res = await req(by).post(assignments(), { projectId, taskId: '1.5', crewId, start: TODAY, end: '2026-03-10', ...body });
        expectStatus(res, 201);
        return crewAssignmentDtoSchema.parse(res.body);
    }
    async function listPeople(s: Session): Promise<PersonDto[]> {
        const res = await req(s).get(people());
        expectStatus(res, 200);
        return z.array(personDtoSchema).parse(res.body);
    }
    async function listCrews(s: Session): Promise<CrewDto[]> {
        const res = await req(s).get(crews());
        expectStatus(res, 200);
        return z.array(crewDtoSchema).parse(res.body);
    }

    describe('platform and auth', () => {
        it('GET /platform/modules is public and lists workforce', async () => {
            const res = await t.http().get('/platform/modules');
            expectStatus(res, 200);
            expect(platformModulesDtoSchema.parse(res.body).modules).toContain('workforce');
        });

        it('every route needs a signed-in user', async () => {
            for (const res of [
                await t.http().get(people()), await t.http().post(crews()).send({}), await t.http().get(assignments()),
                await t.http().patch(`${crews()}/${UNKNOWN_ID}`).send({ note: 'x' }), await t.http().get(supervisors()),
                await t.http().put(supervisors()).send({ personIds: [] }), await t.http().get(taskLags()),
                await t.http().put(taskLags()).send({ lags: [] }), await t.http().get(wsTaskLags()),
            ]) expectError(res, 401, 'unauthenticated');
        });
    });

    describe('people', () => {
        it('creates (201) and lists them oldest first; duplicate names are allowed', async () => {
            const res = await req(owner).post(people(), {
                name: ' สมชาย ใจกล้า ', nickname: 'ชาย', phone: '081-234-5678', role: 'foreman', employment: 'permanent',
                trades: ['structure'], dailyWage: 1200,
            });
            expectStatus(res, 201);
            const p = personDtoSchema.parse(res.body);
            expect(p).toMatchObject({
                workspaceId: ws, name: 'สมชาย ใจกล้า', nickname: 'ชาย', phone: '081-234-5678', role: 'foreman', employment: 'permanent',
                trades: ['structure'], dailyWage: 1200, wagesHidden: false, note: null, archivedAt: null,
            });
            t.clock.advance(1000);
            const twin = await newPerson({ name: 'สมชาย ใจกล้า' });
            const ids = (await listPeople(viewer)).map(x => x.id);
            expect(ids.indexOf(p.id)).toBeLessThan(ids.indexOf(twin.id));
        });

        it('a daily wage is shown to owner/admin only', async () => {
            const p = await newPerson({ dailyWage: 950 });
            const shown: Record<Role, boolean> = { owner: true, admin: true, estimator: false, viewer: false };
            for (const role of ['owner', 'admin', 'estimator', 'viewer'] as const) {
                const dto = (await listPeople(as[role])).find(x => x.id === p.id);
                expect(dto?.dailyWage).toBe(shown[role] ? 950 : null);
                expect(dto?.wagesHidden).toBe(!shown[role]);
            }
        });

        it('only owner/admin manage people', async () => {
            const p = await newPerson();
            for (const s of [estimator, viewer]) {
                expectError(await req(s).post(people(), { name: 'x', role: 'skilled', employment: 'daily' }), 403, 'forbidden');
                expectError(await req(s).patch(`${people()}/${p.id}`, { note: 'x' }), 403, 'forbidden');
                expectError(await req(s).del(`${people()}/${p.id}`), 403, 'forbidden');
            }
            const res = await req(admin).patch(`${people()}/${p.id}`, { note: 'ขยัน', dailyWage: null });
            expectStatus(res, 200);
            expect(personDtoSchema.parse(res.body)).toMatchObject({ note: 'ขยัน', dailyWage: null });
        });

        it('validation: bad fields → 400; nothing to update → 400', async () => {
            const p = await newPerson();
            for (const body of [
                { name: '', role: 'skilled', employment: 'daily' }, { name: 'x', role: 'boss', employment: 'daily' },
                { name: 'x', role: 'skilled', employment: 'daily', dailyWage: 100_001 },
                { name: 'x', role: 'skilled', employment: 'daily', phone: 'call me' },
                { name: 'x', role: 'skilled', employment: 'daily', trades: ['welding'] },
            ]) expectError(await req(owner).post(people(), body), 400, 'validation_failed');
            expectError(await req(owner).patch(`${people()}/${p.id}`, {}), 400, 'validation_failed');
        });

        it('archive: 204, gone from the list, removed from crews and supervisors; again → 204', async () => {
            const leader = await newPerson();
            const member = await newPerson();
            const crew = await newCrew({ leaderId: leader.id, memberIds: [leader.id, member.id] });
            expectStatus(await req(owner).put(supervisors(), { personIds: [leader.id] }), 200);
            expectStatus(await req(owner).del(`${people()}/${leader.id}`), 204);
            expect((await listPeople(owner)).map(p => p.id)).not.toContain(leader.id);
            const after = (await listCrews(owner)).find(c => c.id === crew.id);
            expect(after).toMatchObject({ leaderId: null, memberIds: [member.id] });
            expect(projectSupervisorsDtoSchema.parse((await req(owner).get(supervisors())).body).personIds).toEqual([]);
            expectStatus(await req(owner).del(`${people()}/${leader.id}`), 204);
            expectError(await req(owner).patch(`${people()}/${leader.id}`, { note: 'x' }), 404, 'not_found');
        });

        it('archive while a crew of theirs is still assigned → 409 in_use', async () => {
            const member = await newPerson();
            const crew = await newCrew({ memberIds: [member.id] });
            const a = await newAssignment(crew.id, { start: '2026-02-20', end: TODAY });
            const body = expectError(await req(owner).del(`${people()}/${member.id}`), 409, 'conflict');
            expect(workforceConflictDetailsSchema.parse(body.details)).toEqual({ reason: 'in_use', assignments: 1 });
            expectStatus(await req(owner).patch(`${assignments()}/${a.id}`, { end: '2026-02-28', start: '2026-02-20' }), 200);
            expectStatus(await req(owner).del(`${people()}/${member.id}`), 204);
        });
    });

    describe('crews', () => {
        it('creates a crew priced from the rate card; cost shown to owner/admin/estimator, hidden from viewers', async () => {
            const leader = await newPerson();
            const crew = await newCrew({ name: 'ทีมก่อฉาบช่างแดง', trade: 'masonry', leaderId: leader.id, rateCardId: cardId, skilledCount: 3, labourerCount: 2 });
            expect(crew).toMatchObject({ trade: 'masonry', leaderId: leader.id, rateCardId: cardId, dailyCost: 3400, wagesHidden: false });
            const shown: Record<Role, boolean> = { owner: true, admin: true, estimator: true, viewer: false };
            for (const role of ['owner', 'admin', 'estimator', 'viewer'] as const) {
                const dto = (await listCrews(as[role])).find(c => c.id === crew.id);
                expect(dto?.dailyCost).toBe(shown[role] ? 3400 : null);
                expect(dto?.wagesHidden).toBe(!shown[role]);
            }
            const override = await newCrew({ dailyCostOverride: 5000, rateCardId: cardId });
            expect(override.dailyCost).toBe(5000);
            const viewed = (await listCrews(viewer)).find(c => c.id === override.id);
            expect(viewed).toMatchObject({ dailyCost: null, dailyCostOverride: null, wagesHidden: true });
            expect((await newCrew()).dailyCost).toBeNull();
        });

        it('names are unique among active crews, ignoring case → 409 name_taken', async () => {
            const crew = await newCrew({ name: 'ทีมหลังคา Roof' });
            const body = expectError(await req(owner).post(crews(), { name: 'ทีมหลังคา ROOF', trade: 'roofing', skilledCount: 1, labourerCount: 1 }), 409, 'conflict');
            expect(workforceConflictDetailsSchema.parse(body.details)).toEqual({ reason: 'name_taken', name: 'ทีมหลังคา ROOF' });
            expectStatus(await req(owner).del(`${crews()}/${crew.id}`), 204);
            await newCrew({ name: 'ทีมหลังคา ROOF' });
        });

        it('leader, members and rate card must be active and of this workspace → 422', async () => {
            const foreign = await newPerson({}, outsider, otherWs);
            const base = { name: 'x', trade: 'plumbing', skilledCount: 1, labourerCount: 1 };
            for (const extra of [{ leaderId: foreign.id }, { memberIds: [foreign.id] }, { rateCardId: UNKNOWN_ID }, { leaderId: UNKNOWN_ID }]) {
                expectError(await req(owner).post(crews(), { ...base, ...extra }), 422, 'unprocessable');
            }
        });

        it('only owner/admin manage crews; PATCH replaces members; validation', async () => {
            const crew = await newCrew();
            for (const s of [estimator, viewer]) {
                expectError(await req(s).post(crews(), { name: 'x', trade: 'misc', skilledCount: 1, labourerCount: 1 }), 403, 'forbidden');
                expectError(await req(s).patch(`${crews()}/${crew.id}`, { note: 'x' }), 403, 'forbidden');
                expectError(await req(s).del(`${crews()}/${crew.id}`), 403, 'forbidden');
            }
            const m = await newPerson();
            const res = await req(admin).patch(`${crews()}/${crew.id}`, { memberIds: [m.id], skilledCount: 4, rateCardId: cardId });
            expectStatus(res, 200);
            expect(crewDtoSchema.parse(res.body)).toMatchObject({ memberIds: [m.id], skilledCount: 4, dailyCost: 4 * 800 + 3 * 500 });
            expectError(await req(owner).post(crews(), { name: 'x', trade: 'x', skilledCount: 1, labourerCount: 1 }), 400, 'validation_failed');
            expectError(await req(owner).post(crews(), { name: 'x', trade: 'misc', skilledCount: 201, labourerCount: 1 }), 400, 'validation_failed');
            expectError(await req(owner).patch(`${crews()}/${crew.id}`, {}), 400, 'validation_failed');
        });

        it('archive with an assignment ending today or later → 409 in_use; past assignments do not block', async () => {
            const crew = await newCrew();
            await newAssignment(crew.id, { start: '2026-01-01', end: '2026-02-28' });
            const open = await newAssignment(crew.id, { start: '2026-03-01', end: '2026-03-03' });
            const body = expectError(await req(owner).del(`${crews()}/${crew.id}`), 409, 'conflict');
            expect(workforceConflictDetailsSchema.parse(body.details)).toEqual({ reason: 'in_use', assignments: 1 });
            expectStatus(await req(estimator).del(`${assignments()}/${open.id}`), 204);
            expectStatus(await req(owner).del(`${crews()}/${crew.id}`), 204);
            expect((await listCrews(owner)).map(c => c.id)).not.toContain(crew.id);
        });
    });

    describe('crew assignments', () => {
        it('estimators assign; overlapping assignments of one crew are allowed; viewers read only', async () => {
            const crew = await newCrew();
            const a = await newAssignment(crew.id, { taskId: '4.1', start: '2026-03-05', end: '2026-03-20' }, estimator);
            expect(a).toMatchObject({ workspaceId: ws, projectId, taskId: '4.1', crewId: crew.id, createdBy: estimator.userId, note: null });
            const b = await newAssignment(crew.id, { projectId: otherProjectId, taskId: '5.1', start: '2026-03-15', end: '2026-03-25' });
            expectError(await req(viewer).post(assignments(), { projectId, taskId: '1.1', crewId: crew.id, start: TODAY, end: TODAY }), 403, 'forbidden');
            const res = await req(viewer).get(`${assignments()}?crewId=${crew.id}&from=2026-03-18&to=2026-03-19`);
            expectStatus(res, 200);
            expect(z.array(crewAssignmentDtoSchema).parse(res.body).map(x => x.id)).toEqual([a.id, b.id]);
            const one = await req(viewer).get(`${assignments()}?projectId=${otherProjectId}`);
            expect(z.array(crewAssignmentDtoSchema).parse(one.body).map(x => x.id)).toEqual([b.id]);
            const none = await req(viewer).get(`${assignments()}?crewId=${crew.id}&from=2026-03-26`);
            expect(none.body).toEqual([]);
        });

        it('PATCH moves days / crew; start after end → 400; DELETE → 204', async () => {
            const crew = await newCrew();
            const other = await newCrew();
            const a = await newAssignment(crew.id);
            const res = await req(estimator).patch(`${assignments()}/${a.id}`, { crewId: other.id, end: '2026-03-12', note: 'เลื่อน' });
            expectStatus(res, 200);
            expect(crewAssignmentDtoSchema.parse(res.body)).toMatchObject({ crewId: other.id, start: TODAY, end: '2026-03-12', note: 'เลื่อน' });
            expectError(await req(owner).patch(`${assignments()}/${a.id}`, { start: '2026-03-13' }), 400, 'validation_failed');
            expectError(await req(owner).post(assignments(), { projectId, taskId: '1.1', crewId: crew.id, start: '2026-03-02', end: TODAY }), 400, 'validation_failed');
            expectError(await req(owner).post(assignments(), { projectId, taskId: '10', crewId: crew.id, start: TODAY, end: TODAY }), 400, 'validation_failed');
            expectError(await req(owner).get(`${assignments()}?from=2026-3-1`), 400, 'validation_failed');
            expectStatus(await req(owner).del(`${assignments()}/${a.id}`), 204);
            expectError(await req(owner).del(`${assignments()}/${a.id}`), 404, 'not_found');
        });

        it('the project must be of this workspace (404) and not archived (409); the crew active (422)', async () => {
            const crew = await newCrew();
            const base = { taskId: '1.1', crewId: crew.id, start: TODAY, end: TODAY };
            expectError(await req(owner).post(assignments(), { ...base, projectId: foreignProjectId }), 404, 'not_found');
            expectError(await req(owner).post(assignments(), { ...base, projectId: UNKNOWN_ID }), 404, 'not_found');
            const archivedProject = await newProject(owner, ws, 'เก็บถาวร');
            expectStatus(await req(owner).patch(`/projects/${archivedProject}`, { archived: true }), 200);
            expectError(await req(owner).post(assignments(), { ...base, projectId: archivedProject }), 409, 'conflict');
            const gone = await newCrew();
            expectStatus(await req(owner).del(`${crews()}/${gone.id}`), 204);
            expectError(await req(owner).post(assignments(), { ...base, projectId, crewId: gone.id }), 422, 'unprocessable');
        });

        it('deleting a project deletes its assignments, supervisors and task waits', async () => {
            const doomed = await newProject(owner, ws, 'จะลบ');
            const crew = await newCrew();
            const p = await newPerson();
            const a = await newAssignment(crew.id, { projectId: doomed });
            expectStatus(await req(owner).put(supervisors(doomed), { personIds: [p.id] }), 200);
            expectStatus(await req(owner).put(taskLags(doomed), { lags: [{ taskId: '1.5', days: 10 }] }), 200);
            expectStatus(await req(owner).del(`/projects/${doomed}`), 204);
            const left = z.array(crewAssignmentDtoSchema).parse((await req(owner).get(assignments())).body);
            expect(left.map(x => x.id)).not.toContain(a.id);
            expectError(await req(owner).get(supervisors(doomed)), 404, 'not_found');
            expectError(await req(owner).get(taskLags(doomed)), 404, 'not_found');
            const board = workspaceTaskLagsDtoSchema.parse((await req(owner).get(wsTaskLags())).body);
            expect(board.map(x => x.projectId)).not.toContain(doomed);
            // The crew and the person are free again.
            expectStatus(await req(owner).del(`${crews()}/${crew.id}`), 204);
        });
    });

    describe('supervisors', () => {
        it('PUT by estimator, GET by viewer; people must be active and of the workspace (422)', async () => {
            const a = await newPerson({ role: 'supervisor', name: 'คุณประเสริฐ ช่างแก้ว' });
            const b = await newPerson({ role: 'engineer' });
            const res = await req(estimator).put(supervisors(), { personIds: [a.id, b.id] });
            expectStatus(res, 200);
            expect(projectSupervisorsDtoSchema.parse(res.body)).toEqual({ projectId, personIds: [a.id, b.id] });
            expect(projectSupervisorsDtoSchema.parse((await req(viewer).get(supervisors())).body).personIds).toEqual([a.id, b.id]);
            expectError(await req(viewer).put(supervisors(), { personIds: [] }), 403, 'forbidden');
            const foreign = await newPerson({}, outsider, otherWs);
            expectError(await req(owner).put(supervisors(), { personIds: [foreign.id] }), 422, 'unprocessable');
            expectError(await req(owner).put(supervisors(), { personIds: ['not-a-uuid'] }), 400, 'validation_failed');
        });
    });

    describe('task lags (ช่วงรอ)', () => {
        const plaster = { taskId: '5.1', days: 21, note: 'ช่วงฝนตก ปูนแห้งช้า' };
        const footing = { taskId: '1.5', days: 10, note: 'ฝนตกระหว่างบ่ม' };

        it('a new project has none; PUT replaces all (task order, blank note → null); every role reads', async () => {
            const p = await newProject(owner, ws, 'บ้านช่วงรอ');
            expect(projectTaskLagsDtoSchema.parse((await req(viewer).get(taskLags(p))).body)).toEqual({ projectId: p, lags: [] });
            const res = await req(estimator).put(taskLags(p), { lags: [plaster, { taskId: '1.10', days: 0, note: '  ' }, footing] });
            expectStatus(res, 200);
            const stored = [footing, { taskId: '1.10', days: 0, note: null }, plaster];
            expect(projectTaskLagsDtoSchema.parse(res.body)).toEqual({ projectId: p, lags: stored });
            for (const role of ['owner', 'admin', 'estimator', 'viewer'] as const) {
                expect(projectTaskLagsDtoSchema.parse((await req(as[role]).get(taskLags(p))).body).lags).toEqual(stored);
            }
            // Replace-all: what is left out goes.
            const replaced = await req(admin).put(taskLags(p), { lags: [{ taskId: '1.5', days: 8 }] });
            expect(projectTaskLagsDtoSchema.parse(replaced.body).lags).toEqual([{ taskId: '1.5', days: 8, note: null }]);
            expect(projectTaskLagsDtoSchema.parse((await req(owner).put(taskLags(p), { lags: [] })).body).lags).toEqual([]);
            expect(projectTaskLagsDtoSchema.parse((await req(owner).get(taskLags(p))).body).lags).toEqual([]);
        });

        it.each<[Role, number]>([['owner', 200], ['admin', 200], ['estimator', 200], ['viewer', 403]])(
            'PUT as %s → %i',
            async (role, status) => {
                const res = await req(as[role]).put(taskLags(), { lags: [footing] });
                if (status === 200) expectStatus(res, 200);
                else expectError(res, status, 'forbidden');
            },
        );

        it('validation: days out of range or fractional, duplicate taskId, bad taskId, long note, missing body → 400', async () => {
            for (const lags of [
                [{ taskId: '1.5', days: -1 }], [{ taskId: '1.5', days: 91 }], [{ taskId: '1.5', days: 2.5 }], [{ taskId: '1.5', days: '7' }],
                [footing, { taskId: '1.5', days: 3 }],
                [{ taskId: '1', days: 1 }], [{ taskId: '0.1', days: 1 }], [{ taskId: '1.0', days: 1 }], [{ taskId: '1.100', days: 1 }],
                [{ taskId: 'ฐานราก', days: 1 }], [{ taskId: 15, days: 1 }],
                [{ taskId: '1.5', days: 1, note: 'x'.repeat(201) }],
            ]) expectError(await req(owner).put(taskLags(), { lags }), 400, 'validation_failed');
            expectError(await req(owner).put(taskLags(), {}), 400, 'validation_failed');
            expectStatus(await req(owner).put(taskLags(), { lags: [{ taskId: '9.99', days: 90, note: null }, { taskId: '1.1', days: 0 }] }), 200);
        });

        it('an archived project: PUT → 409 conflict, GET still reads; left out of the workspace list', async () => {
            const p = await newProject(owner, ws, 'บ้านเก็บถาวร');
            expectStatus(await req(owner).put(taskLags(p), { lags: [footing] }), 200);
            expectStatus(await req(owner).patch(`/projects/${p}`, { archived: true }), 200);
            expectError(await req(owner).put(taskLags(p), { lags: [] }), 409, 'conflict');
            expect(projectTaskLagsDtoSchema.parse((await req(viewer).get(taskLags(p))).body).lags).toEqual([footing]);
            const board = workspaceTaskLagsDtoSchema.parse((await req(owner).get(wsTaskLags())).body);
            expect(board.map(x => x.projectId)).not.toContain(p);
            expectStatus(await req(owner).patch(`/projects/${p}`, { archived: false }), 200);
            const back = workspaceTaskLagsDtoSchema.parse((await req(owner).get(wsTaskLags())).body);
            expect(back).toContainEqual({ projectId: p, lags: [footing] });
        });

        it('workspace list: the projects with overrides only, each in task order; every role reads', async () => {
            const a = await newProject(owner, ws, 'บ้านกระดาน A');
            const b = await newProject(owner, ws, 'บ้านกระดาน B');
            const none = await newProject(owner, ws, 'บ้านไม่มีช่วงรอ');
            expectStatus(await req(owner).put(taskLags(a), { lags: [plaster, footing] }), 200);
            expectStatus(await req(owner).put(taskLags(b), { lags: [{ taskId: '2.4', days: 21 }] }), 200);
            expectStatus(await req(owner).put(taskLags(none), { lags: [] }), 200);
            for (const role of ['owner', 'admin', 'estimator', 'viewer'] as const) {
                const res = await req(as[role]).get(wsTaskLags());
                expectStatus(res, 200);
                const board = workspaceTaskLagsDtoSchema.parse(res.body);
                expect(board).toContainEqual({ projectId: a, lags: [footing, plaster] });
                expect(board).toContainEqual({ projectId: b, lags: [{ taskId: '2.4', days: 21, note: null }] });
                expect(board.map(x => x.projectId)).not.toContain(none);
                expect(board.every(x => x.lags.length > 0)).toBe(true);
                expect(board.map(x => x.projectId)).toEqual([...board.map(x => x.projectId)].sort());
            }
        });
    });

    describe('tenant isolation', () => {
        it('a non-member gets 404 on every route; ids of another workspace are 404 too', async () => {
            const p = await newPerson();
            const c = await newCrew();
            const a = await newAssignment(c.id);
            const o = req(outsider);
            for (const res of [
                await o.get(people()), await o.get(crews()), await o.get(assignments()),
                await o.post(people(), { name: 'x', role: 'skilled', employment: 'daily' }),
                await o.patch(`${people()}/${p.id}`, { note: 'x' }), await o.del(`${crews()}/${c.id}`),
                await o.patch(`${assignments()}/${a.id}`, { note: 'x' }), await o.get(supervisors()),
                await o.put(supervisors(), { personIds: [] }), await o.get(taskLags()), await o.put(taskLags(), { lags: [] }),
                await o.get(wsTaskLags()), await req(owner).get(taskLags(foreignProjectId)),
                await req(owner).put(taskLags(foreignProjectId), { lags: [] }), await req(owner).get(wsTaskLags(otherWs)),
                await req(owner).get(taskLags(UNKNOWN_ID)), await req(owner).put(taskLags('not-a-uuid'), { lags: [] }),
            ]) expectError(res, 404, 'not_found');
            // Their board never shows our projects.
            expectStatus(await o.put(taskLags(foreignProjectId), { lags: [{ taskId: '1.5', days: 4 }] }), 200);
            expect(workspaceTaskLagsDtoSchema.parse((await o.get(wsTaskLags(otherWs))).body))
                .toEqual([{ projectId: foreignProjectId, lags: [{ taskId: '1.5', days: 4, note: null }] }]);
            expect(workspaceTaskLagsDtoSchema.parse((await req(owner).get(wsTaskLags())).body).map(x => x.projectId))
                .not.toContain(foreignProjectId);
            // Through their own workspace: our ids do not exist there.
            expectError(await o.patch(`${people(otherWs)}/${p.id}`, { note: 'x' }), 404, 'not_found');
            expectError(await o.del(`${crews(otherWs)}/${c.id}`), 404, 'not_found');
            expectError(await o.del(`${assignments(otherWs)}/${a.id}`), 404, 'not_found');
            expect((await o.get(people(otherWs))).body).not.toContainEqual(expect.objectContaining({ id: p.id }));
            expectError(await req(owner).patch(`${people()}/not-a-uuid`, { note: 'x' }), 404, 'not_found');
        });
    });

    describe('switched off for the workspace', () => {
        it('the owner switches it off: every route of that workspace answers 404 module_disabled, data kept', async () => {
            const c = await newCrew();
            const off = `/workspaces/${ws}/modules/workforce`;
            expectStatus(await req(owner).put(off, { enabled: false }), 200);
            try {
                for (const res of [
                    await req(owner).get(people()), await req(owner).get(crews()), await req(viewer).get(assignments()),
                    await req(owner).post(people(), { name: 'x', role: 'skilled', employment: 'daily' }),
                    await req(owner).get(supervisors()), await req(owner).get(taskLags()), await req(owner).get(wsTaskLags()),
                ]) expectError(res, 404, 'module_disabled');
                // Another company that has it on is not affected.
                expectStatus(await req(outsider).get(crews(otherWs)), 200);
            } finally {
                expectStatus(await req(owner).put(off, { enabled: true }), 200);
            }
            expect((await listCrews(owner)).map(x => x.id)).toContain(c.id);
        });
    });
});

describe('workforce switched off (e2e)', () => {
    let t: TestApp;
    let owner: Session;
    let ws: string;

    beforeAll(async () => {
        t = await startApp({ MODULES_ENABLED: '' });
        owner = await register(t, 'Owner');
        ws = (await createCompany(t, owner, 'Co')).id;
    });

    afterAll(async () => {
        await t.close();
    });

    it('GET /platform/modules lists nothing', async () => {
        expect(platformModulesDtoSchema.parse((await t.http().get('/platform/modules')).body)).toEqual({ modules: [] });
    });

    it('every workforce route answers 404 module_disabled, signed in or not; the rest of the API works', async () => {
        const auth = bearer(owner.accessToken);
        for (const res of [
            await t.http().get(`/workspaces/${ws}/people`).set(auth),
            await t.http().post(`/workspaces/${ws}/people`).set(auth).send({ name: 'x', role: 'skilled', employment: 'daily' }),
            await t.http().patch(`/workspaces/${ws}/crews/${UNKNOWN_ID}`).set(auth).send({ note: 'x' }),
            await t.http().delete(`/workspaces/${ws}/crews/${UNKNOWN_ID}`).set(auth),
            await t.http().get(`/workspaces/${ws}/crew-assignments`).set(auth),
            await t.http().get(`/projects/${UNKNOWN_ID}/supervisors`).set(auth),
            await t.http().put(`/projects/${UNKNOWN_ID}/supervisors`).set(auth).send({ personIds: [] }),
            await t.http().get(`/projects/${UNKNOWN_ID}/task-lags`).set(auth),
            await t.http().put(`/projects/${UNKNOWN_ID}/task-lags`).set(auth).send({ lags: [] }),
            await t.http().get(`/workspaces/${ws}/task-lags`).set(auth),
            await t.http().get(`/workspaces/${ws}/task-lags`),
            await t.http().get(`/workspaces/${ws}/people`),
        ]) expectError(res, 404, 'module_disabled');
        expectStatus(await t.http().get(`/workspaces/${ws}/rate-cards`).set(auth), 200);
        expectStatus(await t.http().get(`/workspaces/${ws}/projects`).set(auth), 200);
    });
});
