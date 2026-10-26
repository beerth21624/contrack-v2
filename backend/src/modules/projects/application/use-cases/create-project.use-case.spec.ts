import { MAX_DOC_BYTES, type Role } from '@contrack/contract';
import { docsToProject, projectSummary, projectToDocs } from '@contrack/domain/sync';
import { createProject } from '@contrack/domain/project';
import {
    BREAKING_DOC, OUTSIDER, OWNER, OWNER_B, ROLE_USERS, SAMPLE_DOCS, WS_A, WS_B, projectsKit,
} from '../../testing/projects-test-kit';

const uploaded = [SAMPLE_DOCS.meta, SAMPLE_DOCS.fill, SAMPLE_DOCS.r13, SAMPLE_DOCS.journey];

describe('CreateProjectUseCase', () => {
    it('creates an empty project with the shared engine\'s summary and a project.created entry', async () => {
        const kit = projectsKit();
        const r = await kit.createProject.execute({ userId: OWNER, workspaceId: WS_A, name: '  บ้าน  ', start: 'blank' });
        if (!r.ok) throw new Error(r.error.message);
        const { project, docs } = r.value;
        expect(project.name.value).toBe('บ้าน');
        expect(project.workspaceId).toBe(WS_A);
        expect(project.createdBy).toBe(OWNER);
        expect(project.engineVersion).toBe('excel-v5');
        expect(project.createdAt).toEqual(kit.clock.now());
        expect(project.summary).toEqual(projectSummary(docsToProject('blank', [])));
        expect(docs).toEqual([]);

        expect(await kit.projects.findInWorkspace(WS_A, project.id)).toBeDefined();
        const activity = await kit.activity.list(WS_A, project.id, { limit: 10 });
        expect(activity.map(a => a.action)).toEqual(['project.created']);
    });

    it('uploads a guest project: every doc at version 1, summary equals the browser\'s', async () => {
        const kit = projectsKit();
        const r = await kit.createProject.execute({ userId: OWNER, workspaceId: WS_A, name: 'Guest', start: 'sample', docs: uploaded });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.docs.map(d => d.version)).toEqual([1, 1, 1, 1]);
        expect(r.value.project.summary).toEqual(projectSummary(docsToProject('sample', uploaded)));

        const stored = await kit.docs.listByProject(WS_A, r.value.project.id);
        expect(stored.map(d => d.docKey).sort()).toEqual(uploaded.map(d => d.docKey).sort());
        expect(stored.every(d => d.version === 1 && d.updatedBy === OWNER)).toBe(true);
    });

    it('a full guest project (projectToDocs) uploads with identical totals', async () => {
        const kit = projectsKit();
        const guest = { ...createProject('sample'), boqOverrides: { R13: { mat: 350 } }, journey: { 'project-info': 'done' as const } };
        const r = await kit.createProject.execute({
            userId: OWNER, workspaceId: WS_A, name: 'Guest', start: 'sample', docs: projectToDocs(guest),
        });
        expect(r.ok && r.value.project.summary).toEqual(projectSummary(guest));
    });

    it.each([
        ['an unknown key', [{ docKey: 'calc:nope', data: {} }]],
        ['an oversize doc', [{ docKey: 'calc:fill', data: { big: 'x'.repeat(MAX_DOC_BYTES) } }]],
        ['invalid data', [{ docKey: 'boq:R13', data: { price: 1 } }]],
        ['missing data', [{ docKey: 'calc:fill' }]],
        ['a duplicate key', [SAMPLE_DOCS.fill, { docKey: 'calc:fill', data: { width: 2 } }]],
        ['a doc that stops the project from computing', [SAMPLE_DOCS.meta, BREAKING_DOC]],
    ])('refuses %s with unprocessable and stores nothing', async (_what, docs) => {
        const kit = projectsKit();
        const r = await kit.createProject.execute({ userId: OWNER, workspaceId: WS_A, name: 'X', start: 'sample', docs });
        expect(!r.ok && r.error.code).toBe('unprocessable');
        expect(await kit.projects.listByWorkspace(WS_A, { archived: false })).toEqual([]);
    });

    it('refuses an empty name', async () => {
        const kit = projectsKit();
        const r = await kit.createProject.execute({ userId: OWNER, workspaceId: WS_A, name: '   ', start: 'blank' });
        expect(!r.ok && r.error.code).toBe('validation_failed');
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
        '%s may create: %s',
        async (role, allowed) => {
            const kit = projectsKit();
            const r = await kit.createProject.execute({ userId: ROLE_USERS[role], workspaceId: WS_A, name: 'X', start: 'blank' });
            if (allowed) expect(r.ok).toBe(true);
            else expect(!r.ok && r.error.code).toBe('forbidden');
        },
    );

    it('a non-member, or a member of another workspace, gets not_found', async () => {
        const kit = projectsKit();
        const outsider = await kit.createProject.execute({ userId: OUTSIDER, workspaceId: WS_A, name: 'X', start: 'blank' });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const crossTenant = await kit.createProject.execute({ userId: OWNER_B, workspaceId: WS_A, name: 'X', start: 'blank' });
        expect(!crossTenant.ok && crossTenant.error.code).toBe('not_found');
        const other = await kit.createProject.execute({ userId: OWNER, workspaceId: WS_B, name: 'X', start: 'blank' });
        expect(!other.ok && other.error.code).toBe('not_found');
    });
});
