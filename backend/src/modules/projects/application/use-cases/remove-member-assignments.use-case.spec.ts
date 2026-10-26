import type { ProjectId, UserId } from '../../../../shared/domain';
import { ProjectsMemberAssignmentCleanup } from '../../infrastructure/adapters/member-assignment-cleanup.adapter';
import { ADMIN, ESTIMATOR, OWNER, OWNER_B, WS_A, WS_B, type ProjectsKit, projectsKit } from '../../testing/projects-test-kit';

async function assign(kit: ProjectsKit, projectId: ProjectId, levelId: string, assigneeId: UserId, by: UserId = OWNER): Promise<void> {
    const r = await kit.putAssignment.execute({ userId: by, projectId, levelId, assigneeId });
    if (!r.ok) throw new Error(r.error.message);
}

describe('RemoveMemberAssignmentsUseCase', () => {
    it('removes only that user\'s assignments in that workspace, with one level.unassigned entry each', async () => {
        const kit = projectsKit();
        const a = await kit.seedProject({ name: 'A' });
        const b = await kit.seedProject({ name: 'B' });
        await assign(kit, a.id, 'footing', ESTIMATOR);
        await assign(kit, a.id, 'brick', ESTIMATOR);
        await assign(kit, b.id, 'footing', ESTIMATOR);
        await assign(kit, a.id, 'plaster', ADMIN);
        // The same user id assigned in another workspace must survive.
        kit.workspaces.set(ESTIMATOR, WS_B, 'estimator');
        const theirs = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        await assign(kit, theirs.id, 'footing', ESTIMATOR, OWNER_B);

        const result = await kit.removeMemberAssignments.execute(WS_A, ESTIMATOR);
        expect(result.removed.map(r => `${r.projectId}/${r.levelId}`).sort())
            .toEqual([`${a.id}/brick`, `${a.id}/footing`, `${b.id}/footing`].sort());

        expect((await kit.assignments.listByProject(WS_A, a.id)).map(x => [x.levelId, x.userId])).toEqual([['plaster', ADMIN]]);
        expect(await kit.assignments.listByProject(WS_A, b.id)).toEqual([]);
        expect(await kit.assignments.listByProject(WS_B, theirs.id)).toHaveLength(1);

        const actionsA = (await kit.activity.list(WS_A, a.id, { limit: 50 })).filter(e => e.action === 'level.unassigned');
        const actionsB = (await kit.activity.list(WS_A, b.id, { limit: 50 })).filter(e => e.action === 'level.unassigned');
        expect(actionsA).toHaveLength(2);
        expect(actionsB).toHaveLength(1);
        expect(actionsA.every(e => e.userId === ESTIMATOR && e.workspaceId === WS_A)).toBe(true);
    });

    it('publishes nothing by itself; `publish` sends assignment.updated with null per removed assignment', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        await assign(kit, p.id, 'footing', ESTIMATOR);
        await assign(kit, p.id, 'brick', ESTIMATOR);
        kit.publisher.events.length = 0;

        const result = await kit.removeMemberAssignments.execute(WS_A, ESTIMATOR);
        expect(kit.publisher.events).toEqual([]);
        await result.publish();
        expect(kit.publisher.events).toEqual(expect.arrayContaining([
            { type: 'assignment.updated', event: { projectId: p.id, levelId: 'footing', assignment: null } },
            { type: 'assignment.updated', event: { projectId: p.id, levelId: 'brick', assignment: null } },
        ]));
        expect(kit.publisher.events).toHaveLength(2);
    });

    it('a user without assignments: nothing removed, no activity, nothing to publish', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const result = await kit.removeMemberAssignments.execute(WS_A, ADMIN);
        expect(result.removed).toEqual([]);
        await result.publish();
        expect(kit.publisher.events).toEqual([]);
        expect((await kit.activity.list(WS_A, p.id, { limit: 50 })).map(e => e.action)).toEqual(['project.created']);
    });

    it('runs inside the caller\'s UnitOfWork (one transaction with the membership change)', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        await assign(kit, p.id, 'footing', ESTIMATOR);
        const runs: number[] = [];
        const run = kit.uow.run.bind(kit.uow);
        kit.uow.run = <T>(work: () => Promise<T>): Promise<T> => {
            runs.push(1);
            return run(work);
        };
        const removed = await kit.uow.run(async () => (await kit.removeMemberAssignments.execute(WS_A, ESTIMATOR)).removed);
        expect(removed).toHaveLength(1);
        expect(runs).toHaveLength(2); // the caller's run and the nested one that joins it
    });
});

describe('ProjectsMemberAssignmentCleanup (shared port)', () => {
    it('removes the user\'s assignments in the workspace and never publishes before commit', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        await assign(kit, p.id, 'footing', ESTIMATOR);
        kit.publisher.events.length = 0;
        const cleanup = new ProjectsMemberAssignmentCleanup(kit.removeMemberAssignments);
        await cleanup.removeUser(WS_A, ESTIMATOR);
        expect(await kit.assignments.listByProject(WS_A, p.id)).toEqual([]);
        expect(kit.publisher.events).toEqual([]);
    });
});
