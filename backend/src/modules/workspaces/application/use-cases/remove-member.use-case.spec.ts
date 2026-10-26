import type { Role } from '@contrack/contract';
import { asWorkspaceId } from '../../../../shared/domain/ids';
import { ROLES_UNDER_TEST, WorkspacesTestKit, outcome } from '../../testing/workspaces-test-kit';
import { RemoveMemberUseCase } from './remove-member.use-case';

const build = (kit: WorkspacesTestKit): RemoveMemberUseCase =>
    new RemoveMemberUseCase(kit.workspaces, kit.memberships, kit.uow, kit.assignmentCleanup);

describe('RemoveMemberUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: RemoveMemberUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = build(kit);
    });

    describe('removing someone else', () => {
        const table: [Role, Role, string][] = [
            ['owner', 'admin', 'ok'],
            ['owner', 'estimator', 'ok'],
            ['owner', 'viewer', 'ok'],
            ['admin', 'estimator', 'ok'],
            ['admin', 'viewer', 'ok'],
            ['admin', 'owner', 'forbidden'],
            ['estimator', 'viewer', 'forbidden'],
            ['estimator', 'admin', 'forbidden'],
            ['viewer', 'estimator', 'forbidden'],
            ['viewer', 'owner', 'forbidden'],
        ];

        it.each(table)('%s removes the %s → %s', async (actorRole, targetRole, expected) => {
            const s = await kit.seedCompany();
            const target = s.byRole[targetRole];
            expect(outcome(await useCase.execute({ actorId: s.byRole[actorRole], workspaceId: s.workspaceId, targetUserId: target }))).toBe(expected);
            expect(await kit.roleOf(s.workspaceId, target)).toBe(expected === 'ok' ? undefined : targetRole);
            expect(kit.assignmentCleanup.calls).toEqual(expected === 'ok' ? [{ workspaceId: s.workspaceId, userId: target }] : []);
        });

        it('an admin may remove another admin', async () => {
            const s = await kit.seedCompany();
            const second = kit.addUser('Second Admin');
            await kit.addMember(s.workspaceId, second, 'admin');
            expect(outcome(await useCase.execute({ actorId: s.admin, workspaceId: s.workspaceId, targetUserId: second }))).toBe('ok');
        });

        it('an owner may remove another owner when one remains', async () => {
            const s = await kit.seedCompany();
            const second = kit.addUser('Second Owner');
            await kit.addMember(s.workspaceId, second, 'owner');
            expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: second }))).toBe('ok');
            expect(await kit.roleOf(s.workspaceId, s.owner)).toBe('owner');
        });

        it('a target who is not a member is not_found', async () => {
            const s = await kit.seedCompany();
            expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.outsider }))).toBe('not_found');
        });

        it('a non-member gets not_found and nothing changes', async () => {
            const s = await kit.seedCompany();
            expect(outcome(await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId, targetUserId: s.viewer }))).toBe('not_found');
            expect(await kit.roleOf(s.workspaceId, s.viewer)).toBe('viewer');
        });

        it('an unknown workspace is not_found', async () => {
            const s = await kit.seedCompany();
            const missing = asWorkspaceId('00000000-0000-4000-8000-00000000ffff');
            expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: missing, targetUserId: s.viewer }))).toBe('not_found');
        });
    });

    describe('leaving', () => {
        it.each(ROLES_UNDER_TEST.filter(r => r !== 'owner'))('a %s may leave', async role => {
            const s = await kit.seedCompany();
            const me = s.byRole[role];
            expect(outcome(await useCase.execute({ actorId: me, workspaceId: s.workspaceId, targetUserId: me }))).toBe('ok');
            expect(await kit.roleOf(s.workspaceId, me)).toBeUndefined();
        });

        it('the last owner cannot leave', async () => {
            const s = await kit.seedCompany();
            expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.owner }))).toBe('last_owner');
            expect(await kit.roleOf(s.workspaceId, s.owner)).toBe('owner');
        });

        it('an owner may leave when another owner remains', async () => {
            const s = await kit.seedCompany();
            const second = kit.addUser('Second Owner');
            await kit.addMember(s.workspaceId, second, 'owner');
            expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.owner }))).toBe('ok');
        });

        it('two owners leaving at the same time leave exactly one owner', async () => {
            kit = new WorkspacesTestKit({ slowMembershipWrites: true });
            useCase = build(kit);
            const a = kit.addUser('Owner A');
            const b = kit.addUser('Owner B');
            const ws = await kit.seedWorkspace('company', [[a, 'owner'], [b, 'owner']]);

            const results = await Promise.all([
                useCase.execute({ actorId: a, workspaceId: ws, targetUserId: a }),
                useCase.execute({ actorId: b, workspaceId: ws, targetUserId: b }),
            ]);

            expect(results.map(outcome).sort()).toEqual(['last_owner', 'ok']);
            const remaining = await kit.memberships.listByWorkspace(ws);
            expect(remaining.map(m => m.role)).toEqual(['owner']);
        });
    });

    describe('personal workspace', () => {
        it('the owner cannot leave or be removed (personal_workspace)', async () => {
            const me = kit.addUser('Somchai');
            const personal = await kit.seedPersonal(me);
            expect(outcome(await useCase.execute({ actorId: me, workspaceId: personal, targetUserId: me }))).toBe('personal_workspace');
            expect(await kit.roleOf(personal, me)).toBe('owner');
            expect(kit.assignmentCleanup.calls).toEqual([]);
        });
    });

    describe('level assignment cleanup', () => {
        it('removes the leaving user\'s assignments in that workspace, inside the unit of work', async () => {
            const s = await kit.seedCompany();
            let insideRun = false;
            const run = kit.uow.run.bind(kit.uow);
            jest.spyOn(kit.uow, 'run').mockImplementation(async work => {
                insideRun = true;
                try {
                    return await run(work);
                } finally {
                    insideRun = false;
                }
            });
            const seenInside: boolean[] = [];
            const original = kit.assignmentCleanup.removeUser.bind(kit.assignmentCleanup);
            jest.spyOn(kit.assignmentCleanup, 'removeUser').mockImplementation((workspaceId, userId) => {
                seenInside.push(insideRun);
                return original(workspaceId, userId);
            });

            expect(outcome(await useCase.execute({ actorId: s.viewer, workspaceId: s.workspaceId, targetUserId: s.viewer }))).toBe('ok');

            expect(kit.assignmentCleanup.calls).toEqual([{ workspaceId: s.workspaceId, userId: s.viewer }]);
            expect(seenInside).toEqual([true]);
        });

        it('is not called when the removal is refused', async () => {
            const s = await kit.seedCompany();
            expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.owner }))).toBe('last_owner');
            expect(outcome(await useCase.execute({ actorId: s.viewer, workspaceId: s.workspaceId, targetUserId: s.estimator }))).toBe('forbidden');
            expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.outsider }))).toBe('not_found');
            expect(outcome(await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId, targetUserId: s.viewer }))).toBe('not_found');
            expect(kit.assignmentCleanup.calls).toEqual([]);
        });

        it('is called once, for the winner only, when two owners leave at the same time', async () => {
            kit = new WorkspacesTestKit({ slowMembershipWrites: true });
            useCase = build(kit);
            const a = kit.addUser('Owner A');
            const b = kit.addUser('Owner B');
            const ws = await kit.seedWorkspace('company', [[a, 'owner'], [b, 'owner']]);
            await Promise.all([
                useCase.execute({ actorId: a, workspaceId: ws, targetUserId: a }),
                useCase.execute({ actorId: b, workspaceId: ws, targetUserId: b }),
            ]);
            expect(kit.assignmentCleanup.calls).toHaveLength(1);
            const [call] = kit.assignmentCleanup.calls;
            expect(call?.workspaceId).toBe(ws);
            expect(await kit.roleOf(ws, call!.userId)).toBeUndefined();
        });
    });
});
