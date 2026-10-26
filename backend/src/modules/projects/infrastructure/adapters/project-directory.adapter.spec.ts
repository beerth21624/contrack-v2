import { asProjectId } from '../../../../shared/domain';
import { OWNER, OWNER_B, WS_A, WS_B, projectsKit } from '../../testing/projects-test-kit';
import { RepositoryProjectDirectory, RepositoryProjectDocLookup } from './project-directory.adapter';

describe('ProjectDirectory / ProjectDocLookup', () => {
    it('workspaceOf answers the owning workspace, undefined when missing or deleted', async () => {
        const kit = projectsKit();
        const directory = new RepositoryProjectDirectory(kit.projects);
        const a = await kit.seedProject();
        const b = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        expect(await directory.workspaceOf(a.id)).toBe(WS_A);
        expect(await directory.workspaceOf(b.id)).toBe(WS_B);
        expect(await directory.workspaceOf(asProjectId('99999999-0000-4000-8000-000000000000'))).toBeUndefined();
        await kit.deleteProject.execute({ userId: OWNER, projectId: a.id });
        expect(await directory.workspaceOf(a.id)).toBeUndefined();
    });

    it('find returns the stored document as a DTO', async () => {
        const kit = projectsKit();
        const lookup = new RepositoryProjectDocLookup(kit.projects, kit.docs);
        const p = await kit.seedProject();
        await kit.putDoc.execute({ userId: OWNER, projectId: p.id, docKey: 'calc:fill', data: { width: 4 }, baseVersion: 0 });
        expect(await lookup.find(p.id, 'calc:fill')).toEqual({
            docKey: 'calc:fill', data: { width: 4 }, version: 1, updatedBy: OWNER, updatedAt: kit.clock.now().toISOString(),
        });
        expect(await lookup.find(p.id, 'boq:R13')).toBeUndefined();
        expect(await lookup.find(asProjectId('99999999-0000-4000-8000-000000000000'), 'calc:fill')).toBeUndefined();
    });
});
