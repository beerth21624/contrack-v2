import type { Role } from '@contrack/contract';
import { OUTSIDER, OWNER, OWNER_B, ROLE_USERS, SAMPLE_DOCS, WS_A, WS_B, projectsKit } from '../../testing/projects-test-kit';

describe('DeleteProjectUseCase', () => {
    it('removes the project and everything it owns', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject({ docs: [SAMPLE_DOCS.fill] });
        await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: 'Rev 1' });
        await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: OWNER });

        const r = await kit.deleteProject.execute({ userId: OWNER, projectId: p.id });
        expect(r.ok).toBe(true);
        expect(await kit.projects.findById(p.id)).toBeUndefined();
        expect(await kit.docs.listByProject(WS_A, p.id)).toEqual([]);
        expect(await kit.revisions.listByProject(WS_A, p.id)).toEqual([]);
        expect(await kit.assignments.listByProject(WS_A, p.id)).toEqual([]);
        expect(await kit.activity.list(WS_A, p.id, { limit: 50 })).toEqual([]);
        const again = await kit.getProject.execute({ userId: OWNER, projectId: p.id });
        expect(!again.ok && again.error.code).toBe('not_found');
    });

    it('publishes project.deleted after the delete is committed, and nothing when refused', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const stillThere: boolean[] = [];
        kit.publisher.onPublish = async () => {
            stillThere.push((await kit.projects.findById(p.id)) !== undefined);
        };
        const refused = await kit.deleteProject.execute({ userId: ROLE_USERS.viewer, projectId: p.id });
        expect(refused.ok).toBe(false);
        expect(kit.publisher.events).toEqual([]);

        await kit.deleteProject.execute({ userId: OWNER, projectId: p.id });
        expect(kit.publisher.events).toEqual([{ type: 'project.deleted', event: { projectId: p.id } }]);
        expect(stillThere).toEqual([false]);
    });

    it('a failing publisher does not undo or fail the delete', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        kit.publisher.failing = true;
        expect((await kit.deleteProject.execute({ userId: OWNER, projectId: p.id })).ok).toBe(true);
        expect(await kit.projects.findById(p.id)).toBeUndefined();
    });

    it('leaves other projects alone', async () => {
        const kit = projectsKit();
        const a = await kit.seedProject({ name: 'A' });
        const b = await kit.seedProject({ name: 'B', docs: [SAMPLE_DOCS.fill] });
        await kit.deleteProject.execute({ userId: OWNER, projectId: a.id });
        expect((await kit.docs.listByProject(WS_A, b.id)).map(d => d.docKey).sort()).toEqual(['calc:fill', 'meta']);
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', false], ['viewer', false]])(
        '%s may delete: %s',
        async (role, allowed) => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await kit.deleteProject.execute({ userId: ROLE_USERS[role], projectId: p.id });
            if (allowed) expect(r.ok).toBe(true);
            else {
                expect(!r.ok && r.error.code).toBe('forbidden');
                expect(await kit.projects.findById(p.id)).toBeDefined();
            }
        },
    );

    it('a non-member or another tenant → not_found, nothing deleted', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const outsider = await kit.deleteProject.execute({ userId: OUTSIDER, projectId: p.id });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const cross = await kit.deleteProject.execute({ userId: OWNER_B, projectId: p.id });
        expect(!cross.ok && cross.error.code).toBe('not_found');
        expect(await kit.projects.findById(p.id)).toBeDefined();
        const theirs = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        const reverse = await kit.deleteProject.execute({ userId: OWNER, projectId: theirs.id });
        expect(!reverse.ok && reverse.error.code).toBe('not_found');
    });
});
