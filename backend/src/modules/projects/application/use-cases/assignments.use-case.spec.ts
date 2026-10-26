// PutAssignmentUseCase and ListAssignmentsUseCase.
import { ROLES, type Role } from '@contrack/contract';
import {
    ADMIN, ESTIMATOR, OUTSIDER, OWNER, OWNER_B, ROLE_USERS, VIEWER, WS_A, WS_B, projectsKit,
} from '../../testing/projects-test-kit';

describe('PutAssignmentUseCase', () => {
    it('assigns a member to a level, records level.assigned and publishes after commit', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        kit.publisher.onPublish = async () => {
            expect(await kit.assignments.find(WS_A, p.id, 'footing')).toBeDefined();
        };
        const r = await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: ESTIMATOR });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value).not.toBeNull();
        expect(r.value?.userId).toBe(ESTIMATOR);
        expect(r.value?.assignedBy).toBe(OWNER);
        const [latest] = await kit.activity.list(WS_A, p.id, { limit: 1 });
        expect(latest?.action).toBe('level.assigned');
        expect(kit.publisher.events).toEqual([{
            type: 'assignment.updated',
            event: {
                projectId: p.id,
                levelId: 'footing',
                assignment: { levelId: 'footing', userId: ESTIMATOR, assignedBy: OWNER, assignedAt: kit.clock.now().toISOString() },
            },
        }]);
    });

    it('reassigns, and null removes the assignment (level.unassigned, event with null)', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: ESTIMATOR });
        const moved = await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: VIEWER });
        expect(moved.ok && moved.value?.userId).toBe(VIEWER);
        expect(await kit.assignments.listByProject(WS_A, p.id)).toHaveLength(1);

        const removed = await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: null });
        expect(removed.ok && removed.value).toBeNull();
        expect(await kit.assignments.find(WS_A, p.id, 'footing')).toBeUndefined();
        const [latest] = await kit.activity.list(WS_A, p.id, { limit: 1 });
        expect(latest?.action).toBe('level.unassigned');
        const last = kit.publisher.events.at(-1);
        expect(last?.type === 'assignment.updated' && last.event.assignment).toBeNull();
    });

    it('a no-op (same assignee, or removing nothing) writes no activity and publishes nothing', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: ESTIMATOR });
        kit.publisher.events.length = 0;
        const same = await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: ESTIMATOR });
        expect(same.ok && same.value?.userId).toBe(ESTIMATOR);
        const none = await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'brick', assigneeId: null });
        expect(none.ok && none.value).toBeNull();
        expect(kit.publisher.events).toEqual([]);
        expect((await kit.activity.list(WS_A, p.id, { limit: 50 })).map(a => a.action)).toEqual(['level.assigned', 'project.created']);
    });

    it('an unknown level → unprocessable', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const r = await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'no-such-level', assigneeId: OWNER });
        expect(!r.ok && r.error.code).toBe('unprocessable');
    });

    it('an assignee who is not a member (or is in another workspace) → unprocessable', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const outsider = await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: OUTSIDER });
        expect(!outsider.ok && outsider.error.code).toBe('unprocessable');
        const otherTenant = await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: OWNER_B });
        expect(!otherTenant.ok && otherTenant.error.code).toBe('unprocessable');
        expect(await kit.assignments.listByProject(WS_A, p.id)).toEqual([]);
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', false], ['viewer', false]])(
        '%s may assign: %s',
        async (role, allowed) => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await kit.putAssignment.execute({ userId: ROLE_USERS[role], projectId: p.id, levelId: 'footing', assigneeId: ADMIN });
            if (allowed) expect(r.ok).toBe(true);
            else expect(!r.ok && r.error.code).toBe('forbidden');
        },
    );

    it('a non-member or another tenant → not_found', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const outsider = await kit.putAssignment.execute({ userId: OUTSIDER, projectId: p.id, levelId: 'footing', assigneeId: OUTSIDER });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const cross = await kit.putAssignment.execute({ userId: OWNER_B, projectId: p.id, levelId: 'footing', assigneeId: OWNER_B });
        expect(!cross.ok && cross.error.code).toBe('not_found');
        const theirs = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        const reverse = await kit.putAssignment.execute({ userId: OWNER, projectId: theirs.id, levelId: 'footing', assigneeId: OWNER });
        expect(!reverse.ok && reverse.error.code).toBe('not_found');
        expect(kit.publisher.events).toEqual([]);
    });
});

describe('ListAssignmentsUseCase', () => {
    it('lists the project\'s assignments', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: ESTIMATOR });
        await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'brick', assigneeId: ADMIN });
        const r = await kit.listAssignments.execute({ userId: VIEWER, projectId: p.id });
        expect(r.ok && r.value.map(a => [a.levelId, a.userId])).toEqual([['brick', ADMIN], ['footing', ESTIMATOR]]);
    });

    it.each(ROLES)('%s may list', async role => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        expect((await kit.listAssignments.execute({ userId: ROLE_USERS[role], projectId: p.id })).ok).toBe(true);
    });

    it('a non-member or another tenant → not_found', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const outsider = await kit.listAssignments.execute({ userId: OUTSIDER, projectId: p.id });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const cross = await kit.listAssignments.execute({ userId: OWNER_B, projectId: p.id });
        expect(!cross.ok && cross.error.code).toBe('not_found');
    });
});
