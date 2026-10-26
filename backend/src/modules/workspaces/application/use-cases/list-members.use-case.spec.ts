import { asUserId } from '../../../../shared/domain/ids';
import { ROLES_UNDER_TEST, WorkspacesTestKit, outcome, valueOf } from '../../testing/workspaces-test-kit';
import { ListMembersUseCase } from './list-members.use-case';

describe('ListMembersUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: ListMembersUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new ListMembersUseCase(kit.memberships, kit.users);
    });

    it.each(ROLES_UNDER_TEST)('a %s sees every member with e-mail and name from the user directory, strongest first', async role => {
        const s = await kit.seedCompany();
        const views = valueOf(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId }));
        expect(views.map(v => [v.membership.userId, v.membership.role, v.profile.email, v.profile.displayName])).toEqual([
            [s.owner, 'owner', 'olivia.owner@example.com', 'Olivia Owner'],
            [s.admin, 'admin', 'adam.admin@example.com', 'Adam Admin'],
            [s.estimator, 'estimator', 'erin.estimator@example.com', 'Erin Estimator'],
            [s.viewer, 'viewer', 'victor.viewer@example.com', 'Victor Viewer'],
        ]);
    });

    it('a non-member gets not_found', async () => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId }))).toBe('not_found');
    });

    it('leaves out a member whose user no longer exists in the directory', async () => {
        const s = await kit.seedCompany();
        const ghost = asUserId('00000000-0000-4000-8000-00000000dead');
        await kit.addMember(s.workspaceId, ghost, 'viewer');
        const views = valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId }));
        expect(views.map(v => v.membership.userId)).not.toContain(ghost);
        expect(views).toHaveLength(4);
    });

    it('lists the single owner of a personal workspace', async () => {
        const me = kit.addUser('Somchai');
        const personal = await kit.seedPersonal(me);
        const views = valueOf(await useCase.execute({ actorId: me, workspaceId: personal }));
        expect(views.map(v => [v.membership.userId, v.membership.role])).toEqual([[me, 'owner']]);
    });
});
