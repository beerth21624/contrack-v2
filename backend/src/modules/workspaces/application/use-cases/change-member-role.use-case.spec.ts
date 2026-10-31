import { asWorkspaceId } from '../../../../shared/domain/ids';
import { WorkspacesTestKit, outcome, valueOf, type SeededRole } from '../../testing/workspaces-test-kit';
import { ChangeMemberRoleUseCase } from './change-member-role.use-case';

const build = (kit: WorkspacesTestKit): ChangeMemberRoleUseCase =>
    new ChangeMemberRoleUseCase(kit.workspaces, kit.memberships, kit.users, kit.uow);

describe('ChangeMemberRoleUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: ChangeMemberRoleUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = build(kit);
    });

    it('the owner changes a role and gets the member back with profile', async () => {
        const s = await kit.seedCompany();
        const view = valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.viewer, role: 'estimator' }));
        expect(view.membership.userId).toBe(s.viewer);
        expect(view.membership.role).toBe('estimator');
        expect(view.profile.email).toBe('victor.viewer@example.com');
        expect(view.profile.displayName).toBe('Victor Viewer');
        expect(await kit.roleOf(s.workspaceId, s.viewer)).toBe('estimator');
    });

    it('runs the change in one unit of work', async () => {
        const s = await kit.seedCompany();
        const run = jest.spyOn(kit.uow, 'run');
        valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.viewer, role: 'admin' }));
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('the owner can hand out ownership', async () => {
        const s = await kit.seedCompany();
        valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.admin, role: 'owner' }));
        expect(await kit.roleOf(s.workspaceId, s.admin)).toBe('owner');
    });

    it('setting the same role is a no-op that succeeds', async () => {
        const s = await kit.seedCompany();
        const view = valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.viewer, role: 'viewer' }));
        expect(view.membership.role).toBe('viewer');
    });

    describe('authorization per role', () => {
        const table: [SeededRole, SeededRole, SeededRole, string][] = [
            ['owner', 'admin', 'viewer', 'ok'],
            ['owner', 'estimator', 'admin', 'ok'],
            ['admin', 'estimator', 'admin', 'ok'],
            ['admin', 'viewer', 'estimator', 'ok'],
            ['admin', 'owner', 'admin', 'forbidden'],
            ['admin', 'viewer', 'owner', 'forbidden'],
            ['estimator', 'viewer', 'estimator', 'forbidden'],
            ['estimator', 'estimator', 'viewer', 'forbidden'],
            ['viewer', 'estimator', 'viewer', 'forbidden'],
            ['viewer', 'viewer', 'admin', 'forbidden'],
        ];

        it.each(table)('%s changes the %s to %s → %s', async (actorRole, targetRole, newRole, expected) => {
            const s = await kit.seedCompany();
            const r = await useCase.execute({
                actorId: s.byRole[actorRole], workspaceId: s.workspaceId, targetUserId: s.byRole[targetRole], role: newRole,
            });
            expect(outcome(r)).toBe(expected);
            expect(await kit.roleOf(s.workspaceId, s.byRole[targetRole])).toBe(expected === 'ok' ? newRole : targetRole);
        });

        it.each(['pm', 'purchasing', 'accounting', 'foreman'] as const)('an admin may make the viewer a %s, and back', async role => {
            const s = await kit.seedCompany();
            valueOf(await useCase.execute({ actorId: s.admin, workspaceId: s.workspaceId, targetUserId: s.viewer, role }));
            expect(await kit.roleOf(s.workspaceId, s.viewer)).toBe(role);
            valueOf(await useCase.execute({ actorId: s.admin, workspaceId: s.workspaceId, targetUserId: s.viewer, role: 'viewer' }));
            expect(await kit.roleOf(s.workspaceId, s.viewer)).toBe('viewer');
        });

        it('an accounting member cannot change roles', async () => {
            const s = await kit.seedCompany();
            const accountant = kit.addUser('Ann Accounting');
            await kit.addMember(s.workspaceId, accountant, 'accounting');
            const r = await useCase.execute({ actorId: accountant, workspaceId: s.workspaceId, targetUserId: s.viewer, role: 'estimator' });
            expect(outcome(r)).toBe('forbidden');
            expect(await kit.roleOf(s.workspaceId, s.viewer)).toBe('viewer');
        });

        it('an admin may change another admin', async () => {
            const s = await kit.seedCompany();
            const second = kit.addUser('Second Admin');
            await kit.addMember(s.workspaceId, second, 'admin');
            valueOf(await useCase.execute({ actorId: s.admin, workspaceId: s.workspaceId, targetUserId: second, role: 'viewer' }));
            expect(await kit.roleOf(s.workspaceId, second)).toBe('viewer');
        });

        it('a non-member gets not_found', async () => {
            const s = await kit.seedCompany();
            const r = await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId, targetUserId: s.viewer, role: 'admin' });
            expect(outcome(r)).toBe('not_found');
            expect(await kit.roleOf(s.workspaceId, s.viewer)).toBe('viewer');
        });
    });

    it('a target who is not a member is not_found', async () => {
        const s = await kit.seedCompany();
        const r = await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.outsider, role: 'viewer' });
        expect(outcome(r)).toBe('not_found');
        expect(await kit.roleOf(s.workspaceId, s.outsider)).toBeUndefined();
    });

    it('an unknown workspace is not_found', async () => {
        const s = await kit.seedCompany();
        const r = await useCase.execute({
            actorId: s.owner, workspaceId: asWorkspaceId('00000000-0000-4000-8000-00000000ffff'), targetUserId: s.viewer, role: 'admin',
        });
        expect(outcome(r)).toBe('not_found');
    });

    describe('last owner', () => {
        it('the only owner cannot demote themselves', async () => {
            const s = await kit.seedCompany();
            const r = await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.owner, role: 'admin' });
            expect(outcome(r)).toBe('last_owner');
            expect(await kit.roleOf(s.workspaceId, s.owner)).toBe('owner');
        });

        it('an owner may demote themselves when another owner remains', async () => {
            const s = await kit.seedCompany();
            valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.admin, role: 'owner' }));
            valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.owner, role: 'viewer' }));
            expect(await kit.roleOf(s.workspaceId, s.owner)).toBe('viewer');
            expect(await kit.roleOf(s.workspaceId, s.admin)).toBe('owner');
        });

        it('an owner may demote another owner when two remain', async () => {
            const s = await kit.seedCompany();
            valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.admin, role: 'owner' }));
            valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, targetUserId: s.admin, role: 'estimator' }));
            expect(await kit.roleOf(s.workspaceId, s.admin)).toBe('estimator');
        });

        it('two owners demoting themselves at the same time leave exactly one owner', async () => {
            kit = new WorkspacesTestKit({ slowMembershipWrites: true });
            useCase = build(kit);
            const a = kit.addUser('Owner A');
            const b = kit.addUser('Owner B');
            const ws = await kit.seedWorkspace('company', [[a, 'owner'], [b, 'owner']]);

            const results = await Promise.all([
                useCase.execute({ actorId: a, workspaceId: ws, targetUserId: a, role: 'admin' }),
                useCase.execute({ actorId: b, workspaceId: ws, targetUserId: b, role: 'admin' }),
            ]);

            expect(results.map(outcome).sort()).toEqual(['last_owner', 'ok']);
            const roles = (await kit.memberships.listByWorkspace(ws)).map(m => m.role).sort();
            expect(roles).toEqual(['admin', 'owner']);
        });
    });

    describe('personal workspace', () => {
        it('roles cannot be changed (personal_workspace)', async () => {
            const me = kit.addUser('Somchai');
            const personal = await kit.seedPersonal(me);
            const r = await useCase.execute({ actorId: me, workspaceId: personal, targetUserId: me, role: 'owner' });
            expect(outcome(r)).toBe('personal_workspace');
        });
    });
});
