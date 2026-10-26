import { ROLES } from '@contrack/contract';
import { asProjectId } from '../../../../shared/domain';
import { OUTSIDER, OWNER, OWNER_B, ROLE_USERS, SAMPLE_DOCS, WS_B, projectsKit } from '../../testing/projects-test-kit';

describe('GetProjectUseCase', () => {
    it('returns the project and all its documents (reset ones included)', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject({ docs: [SAMPLE_DOCS.fill, SAMPLE_DOCS.r13] });
        await kit.putDoc.execute({ userId: OWNER, projectId: p.id, docKey: 'boq:R13', data: null, baseVersion: 1 });

        const r = await kit.getProject.execute({ userId: OWNER, projectId: p.id });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.project.id).toBe(p.id);
        const byKey = Object.fromEntries(r.value.docs.map(d => [d.docKey, d]));
        expect(byKey['calc:fill']?.data).toEqual(SAMPLE_DOCS.fill.data);
        expect(byKey['boq:R13']?.data).toBeNull();
        expect(byKey['boq:R13']?.version).toBe(2);
    });

    it.each(ROLES)('%s may read', async role => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        expect((await kit.getProject.execute({ userId: ROLE_USERS[role], projectId: p.id })).ok).toBe(true);
    });

    it('unknown project → not_found', async () => {
        const kit = projectsKit();
        const r = await kit.getProject.execute({ userId: OWNER, projectId: asProjectId('99999999-0000-4000-8000-000000000000') });
        expect(!r.ok && r.error.code).toBe('not_found');
    });

    it('a non-member or another tenant → not_found (same answer as a missing project)', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const outsider = await kit.getProject.execute({ userId: OUTSIDER, projectId: p.id });
        expect(!outsider.ok && outsider.error).toEqual({ code: 'not_found', message: 'Project not found', details: undefined });
        const theirs = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        const cross = await kit.getProject.execute({ userId: OWNER, projectId: theirs.id });
        expect(!cross.ok && cross.error.code).toBe('not_found');
    });
});
