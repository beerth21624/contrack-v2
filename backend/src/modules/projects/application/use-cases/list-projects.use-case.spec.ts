import { ROLES } from '@contrack/contract';
import { OUTSIDER, OWNER, OWNER_B, ROLE_USERS, WS_A, WS_B, projectsKit } from '../../testing/projects-test-kit';

describe('ListProjectsUseCase', () => {
    it('lists active projects of the workspace, newest update first', async () => {
        const kit = projectsKit();
        const a = await kit.seedProject({ name: 'A' });
        kit.clock.advance(1000);
        const b = await kit.seedProject({ name: 'B' });
        kit.clock.advance(1000);
        await kit.putDoc.execute({ userId: OWNER, projectId: a.id, docKey: 'calc:fill', data: { width: 3 }, baseVersion: 0 });

        const r = await kit.listProjects.execute({ userId: OWNER, workspaceId: WS_A });
        expect(r.ok && r.value.map(p => p.id)).toEqual([a.id, b.id]);
    });

    it('archived=true lists only archived projects, the default only active ones', async () => {
        const kit = projectsKit();
        const a = await kit.seedProject({ name: 'A' });
        const b = await kit.seedProject({ name: 'B' });
        await kit.renameOrArchive.execute({ userId: OWNER, projectId: a.id, archived: true });

        const archived = await kit.listProjects.execute({ userId: OWNER, workspaceId: WS_A, archived: true });
        expect(archived.ok && archived.value.map(p => p.id)).toEqual([a.id]);
        const active = await kit.listProjects.execute({ userId: OWNER, workspaceId: WS_A });
        expect(active.ok && active.value.map(p => p.id)).toEqual([b.id]);
    });

    it.each(ROLES)('%s may list', async role => {
        const kit = projectsKit();
        await kit.seedProject();
        const r = await kit.listProjects.execute({ userId: ROLE_USERS[role], workspaceId: WS_A });
        expect(r.ok && r.value).toHaveLength(1);
    });

    it('a non-member gets not_found', async () => {
        const kit = projectsKit();
        const r = await kit.listProjects.execute({ userId: OUTSIDER, workspaceId: WS_A });
        expect(!r.ok && r.error.code).toBe('not_found');
    });

    it('never shows another tenant\'s projects', async () => {
        const kit = projectsKit();
        await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        const mine = await kit.listProjects.execute({ userId: OWNER, workspaceId: WS_A });
        expect(mine.ok && mine.value).toEqual([]);
        const theirs = await kit.listProjects.execute({ userId: OWNER, workspaceId: WS_B });
        expect(!theirs.ok && theirs.error.code).toBe('not_found');
    });
});
