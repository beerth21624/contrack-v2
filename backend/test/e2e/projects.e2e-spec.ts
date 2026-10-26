// ─── E2E: projects, documents (optimistic concurrency), revisions, level assignments, activity, delete ───
import {
    MAX_DOC_BYTES, type ProjectDto, activityDtoSchema, levelAssignmentDtoSchema, projectDetailDtoSchema, projectDtoSchema,
    putDocResponseSchema, revisionDetailDtoSchema, revisionDtoSchema, versionConflictDetailsSchema,
} from '@contrack/contract';
import { JOURNEY_LEVELS } from '@contrack/domain/journey/levels';
import { computeProject, createProject, type ProjectStart } from '@contrack/domain/project';
import { type DocEntry, docsToProject, isDocKey, projectSummary } from '@contrack/domain/sync';
import { BREAKING_DOC, SAMPLE_DOCS } from '../../src/modules/projects/testing/projects-test-kit';
import {
    type Session, type TestApp, addMember, bearer, connect, createCompany, expectError, expectStatus, joinProject,
    nextEvent, register, startApp,
} from '../support/e2e';

const SAMPLE_TOTAL = computeProject(createProject('sample')).boq.constructionTotal;
const BLANK_TOTAL = computeProject(createProject('blank')).boq.constructionTotal;

/** What the shared engine says the documents add up to (the server must store exactly this). */
function expectedSummary(start: ProjectStart, docs: readonly { docKey: string; data: unknown }[]) {
    const entries: DocEntry[] = docs.map(d => {
        if (!isDocKey(d.docKey)) throw new Error(`bad key ${d.docKey}`);
        return { docKey: d.docKey, data: d.data };
    });
    return projectSummary(docsToProject(start, entries));
}

describe('projects (e2e)', () => {
    let t: TestApp;
    let owner: Session;
    let admin: Session;
    let estimator: Session;
    let viewer: Session;
    let outsider: Session;
    let workspaceId: string;

    beforeAll(async () => {
        t = await startApp();
        owner = await register(t, 'Owner');
        admin = await register(t, 'Admin');
        estimator = await register(t, 'Estimator');
        viewer = await register(t, 'Viewer');
        outsider = await register(t, 'Outsider');
        workspaceId = (await createCompany(t, owner, 'Acme')).id;
        await addMember(t, owner, workspaceId, admin, 'admin');
        await addMember(t, owner, workspaceId, estimator, 'estimator');
        await addMember(t, owner, workspaceId, viewer, 'viewer');
    });

    afterAll(async () => {
        await t.close();
    });

    async function createProjectAs(as: Session, body: Record<string, unknown>, ws = workspaceId) {
        const res = await t.http().post(`/workspaces/${ws}/projects`).set(bearer(as.accessToken)).send(body);
        expectStatus(res, 201);
        return projectDetailDtoSchema.parse(res.body);
    }

    const newProject = async (start: ProjectStart = 'sample', name = 'House'): Promise<ProjectDto> =>
        (await createProjectAs(owner, { name, start })).project;

    const putDoc = (as: Session, projectId: string, docKey: string, data: unknown, baseVersion: number) =>
        t.http().put(`/projects/${projectId}/docs/${docKey}`).set(bearer(as.accessToken)).send({ data, baseVersion });

    const patch = (as: Session, projectId: string, body: Record<string, unknown>) =>
        t.http().patch(`/projects/${projectId}`).set(bearer(as.accessToken)).send(body);

    describe('create', () => {
        it('creates a blank project with the blank totals and only its seeded BOQ header (meta)', async () => {
            const { project, docs } = await createProjectAs(owner, { name: '  Blank house ', start: 'blank' });
            expect(project).toMatchObject({
                workspaceId, name: 'Blank house', start: 'blank', engineVersion: 'excel-v5', createdBy: owner.userId, archivedAt: null,
            });
            expect(docs).toEqual([expect.objectContaining({
                docKey: 'meta', data: { projectName: 'Blank house' }, version: 1, updatedBy: owner.userId,
            })]);
            expect(project.summary).toEqual({
                constructionTotal: BLANK_TOTAL, preConstructionTotal: expect.any(Number) as number,
                levelsDone: 0, levelsTotal: JOURNEY_LEVELS.length,
            });
        });

        it('creates a sample project whose total is the shared engine\'s Excel v5 sample total', async () => {
            const { project } = await createProjectAs(owner, { name: 'Sample', start: 'sample' });
            expect(project.summary.constructionTotal).toBe(SAMPLE_TOTAL);
            expect(project.summary).toEqual(expectedSummary('sample', []));

            const list = await t.http().get(`/workspaces/${workspaceId}/projects`).set(bearer(viewer.accessToken));
            expectStatus(list, 200);
            expect(projectDtoSchema.array().parse(list.body)).toEqual(expect.arrayContaining([project]));
        });

        it('uploads the documents of a guest project (version 1 each) and stores their summary', async () => {
            const docs = Object.values(SAMPLE_DOCS);
            const { project, docs: stored } = await createProjectAs(estimator, { name: 'Guest upload', start: 'sample', docs });
            expect(stored.map(d => d.docKey).sort()).toEqual(docs.map(d => d.docKey).sort());
            for (const d of stored) {
                expect(d).toMatchObject({ version: 1, updatedBy: estimator.userId });
                expect(d.data).toEqual(docs.find(x => x.docKey === d.docKey)?.data);
            }
            expect(project.summary).toEqual(expectedSummary('sample', docs));
            expect(project.summary.levelsDone).toBe(3);
            expect(project.summary.constructionTotal).not.toBe(SAMPLE_TOTAL);

            const detail = await t.http().get(`/projects/${project.id}`).set(bearer(viewer.accessToken));
            expectStatus(detail, 200);
            expect(projectDetailDtoSchema.parse(detail.body).docs).toHaveLength(docs.length);
        });

        it('refuses an upload with a bad, duplicated or breaking document (422) and stores nothing', async () => {
            const before = await t.http().get(`/workspaces/${workspaceId}/projects`).set(bearer(owner.accessToken));
            const send = (docs: unknown[]) => t.http().post(`/workspaces/${workspaceId}/projects`).set(bearer(owner.accessToken))
                .send({ name: 'Bad upload', start: 'sample', docs });

            expectError(await send([{ docKey: 'calc:no-such-calculator', data: {} }]), 422, 'unprocessable');
            expectError(await send([SAMPLE_DOCS.fill, SAMPLE_DOCS.fill]), 422, 'unprocessable');
            expectError(await send([BREAKING_DOC]), 422, 'unprocessable');
            expectError(await send([{ docKey: 'meta', data: { colour: 'red' } }]), 422, 'unprocessable');

            const after = await t.http().get(`/workspaces/${workspaceId}/projects`).set(bearer(owner.accessToken));
            expect(after.body).toEqual(before.body);
        });

        it('refuses viewers (403), outsiders and other tenants (404)', async () => {
            const body = { name: 'X', start: 'blank' };
            expectError(await t.http().post(`/workspaces/${workspaceId}/projects`).set(bearer(viewer.accessToken)).send(body), 403, 'forbidden');
            expectError(await t.http().post(`/workspaces/${workspaceId}/projects`).set(bearer(outsider.accessToken)).send(body), 404, 'not_found');
            expectError(await t.http().get(`/workspaces/${workspaceId}/projects`).set(bearer(outsider.accessToken)), 404, 'not_found');
            // A member of the workspace cannot reach another tenant's workspace either.
            expectError(await t.http().post(`/workspaces/${outsider.personalWorkspaceId}/projects`).set(bearer(owner.accessToken))
                .send(body), 404, 'not_found');
        });
    });

    describe('PUT /projects/:id/docs/:docKey', () => {
        it('writes a new document, updates it, refuses a stale baseVersion (409 version_conflict) and resets it', async () => {
            const project = await newProject('sample');
            const v1Data = SAMPLE_DOCS.fill.data;
            const first = await putDoc(estimator, project.id, 'calc:fill', v1Data, 0);
            expectStatus(first, 200);
            const v1 = putDocResponseSchema.parse(first.body);
            expect(v1.doc).toMatchObject({ docKey: 'calc:fill', data: v1Data, version: 1, updatedBy: estimator.userId });
            expect(v1.project.summary).toEqual(expectedSummary('sample', [{ docKey: 'calc:fill', data: v1Data }]));

            const v2Data = { width: 20, length: 12, height: 0.5 };
            const second = await putDoc(estimator, project.id, 'calc:fill', v2Data, 1);
            expectStatus(second, 200);
            const v2 = putDocResponseSchema.parse(second.body);
            expect(v2.doc).toMatchObject({ data: v2Data, version: 2 });
            expect(v2.project.summary).toEqual(expectedSummary('sample', [{ docKey: 'calc:fill', data: v2Data }]));
            expect(new Date(v2.project.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(project.updatedAt).getTime());

            // Another tab still edits version 1: refused, with the server's current document.
            for (const stale of [1, 0, 5]) {
                const conflict = expectError(await putDoc(admin, project.id, 'calc:fill', { width: 1, length: 1, height: 1 }, stale),
                    409, 'version_conflict');
                const details = versionConflictDetailsSchema.parse(conflict.details);
                expect(details.current).toMatchObject({ docKey: 'calc:fill', data: v2Data, version: 2, updatedBy: estimator.userId });
            }
            // A conflict on a document that does not exist yet carries current: null.
            const missing = expectError(await putDoc(owner, project.id, 'calc:paint', {}, 3), 409, 'version_conflict');
            expect(versionConflictDetailsSchema.parse(missing.details)).toEqual({ current: null });

            // Reset to the default: data null, the version keeps growing, totals back to the sample.
            const reset = await putDoc(owner, project.id, 'calc:fill', null, 2);
            expectStatus(reset, 200);
            const v3 = putDocResponseSchema.parse(reset.body);
            expect(v3.doc).toMatchObject({ data: null, version: 3, updatedBy: owner.userId });
            expect(v3.project.summary.constructionTotal).toBe(SAMPLE_TOTAL);

            const detail = projectDetailDtoSchema.parse((await t.http().get(`/projects/${project.id}`).set(bearer(viewer.accessToken))).body);
            expect(detail.project.summary).toEqual(v3.project.summary);
            expect(detail.docs.find(d => d.docKey === 'calc:fill')).toEqual(v3.doc);
        });

        it('updates the seeded meta document from version 1', async () => {
            const project = await newProject('sample', 'Header');
            expectError(await putDoc(owner, project.id, 'meta', { ownerName: 'A' }, 0), 409, 'version_conflict');
            const res = await putDoc(owner, project.id, 'meta', { projectName: 'Header', ownerName: 'A' }, 1);
            expectStatus(res, 200);
            expect(putDocResponseSchema.parse(res.body).doc).toMatchObject({ version: 2, data: { projectName: 'Header', ownerName: 'A' } });
        });

        it('accepts an URL-encoded document key', async () => {
            const project = await newProject('sample');
            const res = await putDoc(owner, project.id, encodeURIComponent('boq:R13'), SAMPLE_DOCS.r13.data, 0);
            expectStatus(res, 200);
            expect(putDocResponseSchema.parse(res.body).doc.docKey).toBe('boq:R13');
        });

        it('refuses an unknown or malformed key, invalid or oversize data and data that breaks computing (422)', async () => {
            const project = await newProject('sample');
            expectError(await putDoc(owner, project.id, 'calc:no-such-calculator', {}, 0), 422, 'unprocessable');
            expectError(await putDoc(owner, project.id, 'boq:NO-SUCH-LINE', { qty: 1 }, 0), 422, 'unprocessable');
            expectError(await putDoc(owner, project.id, 'bogus', {}, 0), 422, 'unprocessable');
            expectError(await putDoc(owner, project.id, 'meta', { colour: 'red' }, 0), 422, 'unprocessable');
            expectError(await putDoc(owner, project.id, 'boq:R13', { qty: 'many' }, 0), 422, 'unprocessable');
            expectError(await putDoc(owner, project.id, 'journey', { 'no-such-level': 'done' }, 0), 422, 'unprocessable');
            expectError(await putDoc(owner, project.id, BREAKING_DOC.docKey, BREAKING_DOC.data, 0), 422, 'unprocessable');

            const oversize = expectError(await putDoc(owner, project.id, 'calc:fill', { note: 'x'.repeat(MAX_DOC_BYTES) }, 0),
                422, 'unprocessable');
            expect(oversize.details).toMatchObject({ docKey: 'calc:fill', maxBytes: MAX_DOC_BYTES });

            // A missing data field is a contract violation (null is the only way to reset).
            expectError(await t.http().put(`/projects/${project.id}/docs/meta`).set(bearer(owner.accessToken))
                .send({ baseVersion: 0 }), 400, 'validation_failed');

            // Nothing was stored.
            const detail = projectDetailDtoSchema.parse((await t.http().get(`/projects/${project.id}`).set(bearer(owner.accessToken))).body);
            expect(detail.docs.map(d => d.docKey)).toEqual(['meta']);
            expect(detail.project.summary.constructionTotal).toBe(SAMPLE_TOTAL);
        });

        // Regression: the JSON body parser kept express' 100 kB default, so documents between 100 kB and
        // MAX_DOC_BYTES (256 kB) could not be saved and an oversize one answered 500 instead of 422.
        it('accepts a document just under MAX_DOC_BYTES (larger than express\' default 100 kB body limit)', async () => {
            const project = await newProject('sample');
            const data = { note: 'x'.repeat(MAX_DOC_BYTES - 100) };
            const res = await putDoc(owner, project.id, 'calc:fill', data, 0);
            expectStatus(res, 200);
            expect(putDocResponseSchema.parse(res.body).doc).toMatchObject({ version: 1, data });
        });

        it('answers a malformed JSON body with 400 and a body over the parser limit with 413 (ErrorResponse, not 500)', async () => {
            const project = await newProject('sample');
            const malformed = await t.http().put(`/projects/${project.id}/docs/calc:fill`).set(bearer(owner.accessToken))
                .set('Content-Type', 'application/json').send('{"data": {');
            expectError(malformed, 400, 'validation_failed');

            const huge = await t.http().put(`/projects/${project.id}/docs/calc:fill`).set(bearer(owner.accessToken))
                .send({ data: { note: 'x'.repeat(16 * 1024 * 1024) }, baseVersion: 0 });
            expectError(huge, 413, 'validation_failed');
        });

        it('refuses viewers (403), outsiders (404) and archived projects (409)', async () => {
            const project = await newProject('sample');
            expectError(await putDoc(viewer, project.id, 'calc:fill', SAMPLE_DOCS.fill.data, 0), 403, 'forbidden');
            expectError(await putDoc(outsider, project.id, 'calc:fill', SAMPLE_DOCS.fill.data, 0), 404, 'not_found');

            expectStatus(await patch(owner, project.id, { archived: true }), 200);
            expectError(await putDoc(owner, project.id, 'calc:fill', SAMPLE_DOCS.fill.data, 0), 409, 'conflict');
            expectStatus(await patch(owner, project.id, { archived: false }), 200);
            expectStatus(await putDoc(owner, project.id, 'calc:fill', SAMPLE_DOCS.fill.data, 0), 200);
        });
    });

    describe('rename and archive', () => {
        it('renames (projects.edit) and archives / restores (projects.archive)', async () => {
            const project = await newProject('blank', 'Old name');
            const renamed = await patch(estimator, project.id, { name: ' New name ' });
            expectStatus(renamed, 200);
            expect(projectDtoSchema.parse(renamed.body)).toMatchObject({ id: project.id, name: 'New name', archivedAt: null });

            const archived = await patch(estimator, project.id, { archived: true });
            expectStatus(archived, 200);
            const archivedDto = projectDtoSchema.parse(archived.body);
            expect(archivedDto.archivedAt).not.toBeNull();

            const active = projectDtoSchema.array().parse((await t.http().get(`/workspaces/${workspaceId}/projects`)
                .set(bearer(owner.accessToken))).body);
            expect(active.map(p => p.id)).not.toContain(project.id);
            const inArchive = projectDtoSchema.array().parse((await t.http().get(`/workspaces/${workspaceId}/projects?archived=true`)
                .set(bearer(owner.accessToken))).body);
            expect(inArchive.map(p => p.id)).toContain(project.id);

            // An archived project cannot be renamed, unless the same request restores it.
            expectError(await patch(owner, project.id, { name: 'Nope' }), 409, 'conflict');
            const restored = await patch(owner, project.id, { name: 'Restored', archived: false });
            expectStatus(restored, 200);
            expect(projectDtoSchema.parse(restored.body)).toMatchObject({ name: 'Restored', archivedAt: null });
        });

        it('answers 403 to a viewer, 404 to a non-member and to another tenant', async () => {
            const project = await newProject('blank');
            expectError(await patch(viewer, project.id, { name: 'V' }), 403, 'forbidden');
            expectError(await patch(viewer, project.id, { archived: true }), 403, 'forbidden');
            expectError(await patch(outsider, project.id, { name: 'O' }), 404, 'not_found');
            expectError(await patch(outsider, project.id, { archived: true }), 404, 'not_found');
            expectError(await t.http().get(`/projects/${project.id}`).set(bearer(outsider.accessToken)), 404, 'not_found');

            // Cross-tenant: the outsider's own project is just as invisible to the owner of Acme.
            const theirs = (await createProjectAs(outsider, { name: 'Theirs', start: 'blank' }, outsider.personalWorkspaceId)).project;
            expectError(await t.http().get(`/projects/${theirs.id}`).set(bearer(owner.accessToken)), 404, 'not_found');
            expectError(await patch(owner, theirs.id, { name: 'Mine now' }), 404, 'not_found');
            expectError(await putDoc(owner, theirs.id, 'meta', { ownerName: 'x' }, 0), 404, 'not_found');
            expectError(await t.http().delete(`/projects/${theirs.id}`).set(bearer(owner.accessToken)), 404, 'not_found');

            // Unknown and malformed ids look the same.
            expectError(await t.http().get('/projects/0f0f0f0f-0000-4000-8000-0000000000ff').set(bearer(owner.accessToken)), 404, 'not_found');
            expectError(await t.http().get('/projects/not-a-uuid').set(bearer(owner.accessToken)), 404, 'not_found');
        });

        it('validates the body (400 for an empty update)', async () => {
            const project = await newProject('blank');
            expectError(await patch(owner, project.id, {}), 400, 'validation_failed');
        });
    });

    describe('revisions', () => {
        it('snapshots the project with its totals; a duplicate label is 409 conflict', async () => {
            const project = await newProject('sample');
            expectStatus(await putDoc(owner, project.id, 'calc:fill', SAMPLE_DOCS.fill.data, 0), 200);
            const current = projectDtoSchema.parse((await patch(owner, project.id, { name: 'With fill' })).body);

            const created = await t.http().post(`/projects/${project.id}/revisions`).set(bearer(estimator.accessToken))
                .send({ label: ' R1 ', note: ' first issue ' });
            expectStatus(created, 201);
            const r1 = revisionDtoSchema.parse(created.body);
            expect(r1).toMatchObject({ projectId: project.id, label: 'R1', note: 'first issue', createdBy: estimator.userId });
            expect(r1.totals).toEqual(current.summary);

            const detail = await t.http().get(`/projects/${project.id}/revisions/${r1.id}`).set(bearer(viewer.accessToken));
            expectStatus(detail, 200);
            const full = revisionDetailDtoSchema.parse(detail.body);
            const snapshot = full.snapshot as ReturnType<typeof createProject>;
            expect(snapshot.calculators).toEqual({ fill: SAMPLE_DOCS.fill.data });
            expect(computeProject(snapshot).boq.constructionTotal).toBe(r1.totals.constructionTotal);

            // Later edits do not change the revision.
            expectStatus(await putDoc(owner, project.id, 'calc:fill', null, 1), 200);
            const r2 = revisionDtoSchema.parse((await t.http().post(`/projects/${project.id}/revisions`)
                .set(bearer(owner.accessToken)).send({ label: 'R2' })).body);
            expect(r2.totals.constructionTotal).toBe(SAMPLE_TOTAL);
            expect(r2.note).toBeNull();

            expectError(await t.http().post(`/projects/${project.id}/revisions`).set(bearer(owner.accessToken))
                .send({ label: 'R1' }), 409, 'conflict');
            expectError(await t.http().post(`/projects/${project.id}/revisions`).set(bearer(viewer.accessToken))
                .send({ label: 'R3' }), 403, 'forbidden');

            const list = await t.http().get(`/projects/${project.id}/revisions`).set(bearer(viewer.accessToken));
            expectStatus(list, 200);
            const revisions = revisionDtoSchema.array().parse(list.body);
            expect(revisions.map(r => r.label).sort()).toEqual(['R1', 'R2']);
            expect(revisions.find(r => r.id === r1.id)).toEqual(r1);
        });

        it('hides revisions from outsiders (404)', async () => {
            const project = await newProject('blank');
            const r = revisionDtoSchema.parse((await t.http().post(`/projects/${project.id}/revisions`)
                .set(bearer(owner.accessToken)).send({ label: 'R1' })).body);
            expectError(await t.http().get(`/projects/${project.id}/revisions`).set(bearer(outsider.accessToken)), 404, 'not_found');
            expectError(await t.http().get(`/projects/${project.id}/revisions/${r.id}`).set(bearer(outsider.accessToken)), 404, 'not_found');
        });
    });

    describe('assignments', () => {
        const LEVEL = JOURNEY_LEVELS[0]?.id ?? '';
        const OTHER_LEVEL = JOURNEY_LEVELS[1]?.id ?? '';

        const assign = (as: Session, projectId: string, levelId: string, userId: string | null) =>
            t.http().put(`/projects/${projectId}/assignments/${levelId}`).set(bearer(as.accessToken)).send({ userId });

        it('assigns a member to a level, replaces and removes the assignment', async () => {
            const project = await newProject('sample');
            const res = await assign(admin, project.id, LEVEL, estimator.userId);
            expectStatus(res, 200);
            const a = levelAssignmentDtoSchema.parse(res.body);
            expect(a).toMatchObject({ levelId: LEVEL, userId: estimator.userId, assignedBy: admin.userId });

            const list = await t.http().get(`/projects/${project.id}/assignments`).set(bearer(viewer.accessToken));
            expect(levelAssignmentDtoSchema.array().parse(list.body)).toEqual([a]);

            const replaced = levelAssignmentDtoSchema.parse((await assign(owner, project.id, LEVEL, viewer.userId)).body);
            expect(replaced.userId).toBe(viewer.userId);

            const removed = await assign(owner, project.id, LEVEL, null);
            expectStatus(removed, 200);
            expect(removed.body).toBeNull();
            expect(removed.text).toBe('null');
            expect((await t.http().get(`/projects/${project.id}/assignments`).set(bearer(owner.accessToken))).body).toEqual([]);
        });

        it('refuses a non-member assignee and an unknown level (422), and members without levels.assign (403)', async () => {
            const project = await newProject('sample');
            expectError(await assign(owner, project.id, LEVEL, outsider.userId), 422, 'unprocessable');
            expectError(await assign(owner, project.id, 'no-such-level', estimator.userId), 422, 'unprocessable');
            expectError(await assign(owner, project.id, 'BAD_LEVEL', estimator.userId), 422, 'unprocessable');
            expectError(await assign(estimator, project.id, LEVEL, estimator.userId), 403, 'forbidden');
            expectError(await assign(viewer, project.id, LEVEL, viewer.userId), 403, 'forbidden');
            expectError(await assign(outsider, project.id, LEVEL, outsider.userId), 404, 'not_found');
            expect((await t.http().get(`/projects/${project.id}/assignments`).set(bearer(owner.accessToken))).body).toEqual([]);
        });

        it('drops a removed member\'s assignments and tells viewers (assignment.updated with null)', async () => {
            const leaver = await register(t, 'Leaver');
            await addMember(t, owner, workspaceId, leaver, 'estimator');
            const project = await newProject('sample');
            const other = await newProject('blank');
            expectStatus(await assign(owner, project.id, LEVEL, leaver.userId), 200);
            expectStatus(await assign(owner, project.id, OTHER_LEVEL, estimator.userId), 200);
            expectStatus(await assign(owner, other.id, LEVEL, leaver.userId), 200);

            const socket = await connect(t, viewer.accessToken);
            await joinProject(socket, project.id);
            const cleared = nextEvent(socket, 'assignment.updated', e => e.projectId === project.id && e.levelId === LEVEL);

            expectStatus(await t.http().delete(`/workspaces/${workspaceId}/members/${leaver.userId}`).set(bearer(owner.accessToken)), 204);

            expect(await cleared).toEqual({ projectId: project.id, levelId: LEVEL, assignment: null });
            const left = levelAssignmentDtoSchema.array().parse((await t.http().get(`/projects/${project.id}/assignments`)
                .set(bearer(owner.accessToken))).body);
            expect(left.map(a => [a.levelId, a.userId])).toEqual([[OTHER_LEVEL, estimator.userId]]);
            expect((await t.http().get(`/projects/${other.id}/assignments`).set(bearer(owner.accessToken))).body).toEqual([]);
            socket.disconnect();
        });
    });

    describe('activity', () => {
        it('lists the activity newest first and pages with ?before=<id>&limit=', async () => {
            const project = await newProject('sample');
            expectStatus(await putDoc(owner, project.id, 'meta', { ownerName: 'A' }, 1), 200);
            expectStatus(await putDoc(owner, project.id, 'meta', null, 2), 200);
            expectStatus(await patch(owner, project.id, { name: 'Renamed' }), 200);
            expectStatus(await t.http().post(`/projects/${project.id}/revisions`).set(bearer(owner.accessToken)).send({ label: 'R1' }), 201);

            const all = activityDtoSchema.array().parse((await t.http().get(`/projects/${project.id}/activity`)
                .set(bearer(viewer.accessToken))).body);
            expect(all.map(a => a.action)).toEqual(['revision.created', 'project.renamed', 'doc.reset', 'doc.updated', 'project.created']);
            expect(all.map(a => a.docKey)).toEqual([null, null, 'meta', 'meta', null]);
            const ids = all.map(a => BigInt(a.id));
            expect([...ids].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))).toEqual(ids);

            const page1 = activityDtoSchema.array().parse((await t.http().get(`/projects/${project.id}/activity?limit=2`)
                .set(bearer(owner.accessToken))).body);
            expect(page1).toEqual(all.slice(0, 2));
            const page2 = activityDtoSchema.array().parse((await t.http()
                .get(`/projects/${project.id}/activity?limit=2&before=${page1[1]?.id ?? ''}`).set(bearer(owner.accessToken))).body);
            expect(page2).toEqual(all.slice(2, 4));
            const page3 = activityDtoSchema.array().parse((await t.http()
                .get(`/projects/${project.id}/activity?limit=2&before=${page2[1]?.id ?? ''}`).set(bearer(owner.accessToken))).body);
            expect(page3).toEqual(all.slice(4));
            const end = await t.http().get(`/projects/${project.id}/activity?limit=2&before=${page3[0]?.id ?? ''}`)
                .set(bearer(owner.accessToken));
            expect(end.body).toEqual([]);
        });

        it('validates the paging query (400) and hides the feed from outsiders (404)', async () => {
            const project = await newProject('blank');
            for (const q of ['limit=0', 'limit=201', 'limit=abc', 'before=-1', 'before=abc']) {
                expectError(await t.http().get(`/projects/${project.id}/activity?${q}`).set(bearer(owner.accessToken)), 400, 'validation_failed');
            }
            expectError(await t.http().get(`/projects/${project.id}/activity`).set(bearer(outsider.accessToken)), 404, 'not_found');
        });
    });

    describe('delete', () => {
        it('deletes the project with everything it owns (projects.delete)', async () => {
            const project = await newProject('sample');
            expectStatus(await putDoc(owner, project.id, 'calc:fill', SAMPLE_DOCS.fill.data, 0), 200);
            expectStatus(await t.http().post(`/projects/${project.id}/revisions`).set(bearer(owner.accessToken)).send({ label: 'R1' }), 201);

            expectError(await t.http().delete(`/projects/${project.id}`).set(bearer(viewer.accessToken)), 403, 'forbidden');
            expectError(await t.http().delete(`/projects/${project.id}`).set(bearer(estimator.accessToken)), 403, 'forbidden');
            expectError(await t.http().delete(`/projects/${project.id}`).set(bearer(outsider.accessToken)), 404, 'not_found');

            expectStatus(await t.http().delete(`/projects/${project.id}`).set(bearer(admin.accessToken)), 204);

            expectError(await t.http().get(`/projects/${project.id}`).set(bearer(owner.accessToken)), 404, 'not_found');
            expectError(await t.http().get(`/projects/${project.id}/revisions`).set(bearer(owner.accessToken)), 404, 'not_found');
            expectError(await t.http().get(`/projects/${project.id}/activity`).set(bearer(owner.accessToken)), 404, 'not_found');
            expectError(await putDoc(owner, project.id, 'calc:fill', null, 1), 404, 'not_found');
            const list = projectDtoSchema.array().parse((await t.http().get(`/workspaces/${workspaceId}/projects`)
                .set(bearer(owner.accessToken))).body);
            expect(list.map(p => p.id)).not.toContain(project.id);
            expectError(await t.http().delete(`/projects/${project.id}`).set(bearer(owner.accessToken)), 404, 'not_found');
        });
    });
});
