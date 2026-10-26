// ─── Integration: the whole app on PostgreSQL (PERSISTENCE=postgres): register → project → PUT doc → read back ───
// Also two app instances on one database with REALTIME_BUS=postgres: a write on one reaches a viewer on the other.
import {
    authResponseSchema, meResponseSchema, projectDetailDtoSchema, putDocResponseSchema, versionConflictDetailsSchema,
} from '@contrack/contract';
import { computeProject, createProject } from '@contrack/domain/project';
import { docsToProject, projectSummary } from '@contrack/domain/sync';
import { SAMPLE_DOCS } from '../../src/modules/projects/testing/projects-test-kit';
import { TEST_DATABASE_URL, describeIfDatabase, skipIfNoDatabase } from '../support/database';
import {
    PASSWORD, type TestApp, addMember, bearer, connect, expectError, expectStatus, joinProject, nextEvent, register,
    startApp, uniqueEmail,
} from '../support/e2e';

const POSTGRES = { PERSISTENCE: 'postgres', DATABASE_URL: TEST_DATABASE_URL } as const;

describeIfDatabase('createApp with PERSISTENCE=postgres (integration)', () => {
    it('registers, creates a project, writes a document and reads it back from PostgreSQL', async () => {
        if (await skipIfNoDatabase()) return;
        const t = await startApp(POSTGRES);
        try {
            const email = uniqueEmail('pg');
            const registered = await t.http().post('/auth/register').send({ email, password: PASSWORD, displayName: 'Pg' });
            expectStatus(registered, 201);
            const auth = authResponseSchema.parse(registered.body);
            const me = meResponseSchema.parse((await t.http().get('/me').set(bearer(auth.accessToken))).body);
            const personal = me.workspaces.find(w => w.kind === 'personal');
            expect(personal?.role).toBe('owner');

            const created = await t.http().post(`/workspaces/${personal?.id ?? ''}/projects`).set(bearer(auth.accessToken))
                .send({ name: 'Postgres house', start: 'sample' });
            expectStatus(created, 201);
            const { project } = projectDetailDtoSchema.parse(created.body);
            expect(project.summary.constructionTotal).toBe(computeProject(createProject('sample')).boq.constructionTotal);

            const put = await t.http().put(`/projects/${project.id}/docs/calc:fill`).set(bearer(auth.accessToken))
                .send({ data: SAMPLE_DOCS.fill.data, baseVersion: 0 });
            expectStatus(put, 200);
            const written = putDocResponseSchema.parse(put.body);
            expect(written.doc.version).toBe(1);

            const stale = expectError(await t.http().put(`/projects/${project.id}/docs/calc:fill`).set(bearer(auth.accessToken))
                .send({ data: {}, baseVersion: 0 }), 409, 'version_conflict');
            expect(versionConflictDetailsSchema.parse(stale.details).current?.version).toBe(1);

            const detail = projectDetailDtoSchema.parse((await t.http().get(`/projects/${project.id}`).set(bearer(auth.accessToken))).body);
            const fill = detail.docs.find(d => d.docKey === 'calc:fill');
            expect(fill).toEqual(written.doc);
            const meta = detail.docs.find(d => d.docKey === 'meta');
            expect(detail.project.summary).toEqual(projectSummary(docsToProject('sample', [
                { docKey: 'meta', data: meta?.data ?? null },
                { docKey: 'calc:fill', data: SAMPLE_DOCS.fill.data },
            ])));

            // Survives a restart: a second app on the same database sees the same data.
            const again = await startApp(POSTGRES);
            try {
                const login = await again.http().post('/auth/login').send({ email, password: PASSWORD });
                expectStatus(login, 200);
                const token = authResponseSchema.parse(login.body).accessToken;
                const reread = projectDetailDtoSchema.parse((await again.http().get(`/projects/${project.id}`).set(bearer(token))).body);
                expect(reread).toEqual(detail);
            } finally {
                await again.close();
            }
        } finally {
            await t.close();
        }
    });

    it('two instances with REALTIME_BUS=postgres: a write on one reaches a viewer connected to the other', async () => {
        if (await skipIfNoDatabase()) return;
        const env = { ...POSTGRES, REALTIME_BUS: 'postgres' } as const;
        const one: TestApp = await startApp(env);
        const two: TestApp = await startApp(env);
        try {
            const owner = await register(one, 'Owner');
            const viewerOnTwo = await register(two, 'Viewer');
            const ws = await one.http().post('/workspaces').set(bearer(owner.accessToken)).send({ name: 'Shared' });
            expectStatus(ws, 201);
            const workspaceId = (ws.body as { id: string }).id;
            await addMember(one, owner, workspaceId, viewerOnTwo, 'viewer');
            const created = await one.http().post(`/workspaces/${workspaceId}/projects`).set(bearer(owner.accessToken))
                .send({ name: 'Live', start: 'sample' });
            const { project } = projectDetailDtoSchema.parse(created.body);

            const socket = await connect(two, viewerOnTwo.accessToken);
            await joinProject(socket, project.id);
            const update = nextEvent(socket, 'doc.updated', e => e.projectId === project.id, 5000);
            expectStatus(await one.http().put(`/projects/${project.id}/docs/calc:fill`).set(bearer(owner.accessToken))
                .send({ data: SAMPLE_DOCS.fill.data, baseVersion: 0 }), 200);
            expect((await update).doc).toMatchObject({ docKey: 'calc:fill', version: 1, data: SAMPLE_DOCS.fill.data });
            socket.disconnect();
        } finally {
            await one.close();
            await two.close();
        }
    });
});
