import { WorkspacesTestKit, outcome, valueOf } from '../../testing/workspaces-test-kit';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { CreateInvitationUseCase } from './create-invitation.use-case';
import { DeleteWorkspaceUseCase } from './delete-workspace.use-case';

describe('DeleteWorkspaceUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: DeleteWorkspaceUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new DeleteWorkspaceUseCase(kit.workspaces, kit.memberships, kit.invitations, kit.uow);
    });

    it('the owner deletes a company workspace with its members and invitations, in one unit of work', async () => {
        const s = await kit.seedCompany();
        const invite = new CreateInvitationUseCase(
            kit.workspaces, kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock, kit.ids, kit.config);
        const newcomer = kit.addUser('Nina Newcomer');
        const { token } = valueOf(await invite.execute({
            actorId: s.owner, workspaceId: s.workspaceId, email: 'nina.newcomer@example.com', role: 'viewer',
        }));
        const run = jest.spyOn(kit.uow, 'run');

        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId }))).toBe('ok');

        expect(run).toHaveBeenCalledTimes(1);
        expect(await kit.workspaces.findById(s.workspaceId)).toBeUndefined();
        expect(await kit.memberships.listByWorkspace(s.workspaceId)).toEqual([]);
        expect(await kit.invitations.listPending(s.workspaceId, kit.clock.now())).toEqual([]);
        const accept = new AcceptInvitationUseCase(kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock);
        expect(outcome(await accept.execute({ userId: newcomer, token }))).toBe('invitation_invalid');
    });

    it('leaves the members\' other workspaces alone', async () => {
        const s = await kit.seedCompany();
        const personal = await kit.seedPersonal(s.owner);
        valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId }));
        expect(await kit.roleOf(personal, s.owner)).toBe('owner');
    });

    it.each(['admin', 'estimator', 'viewer'] as const)('a %s is forbidden', async role => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId }))).toBe('forbidden');
        expect(await kit.workspaces.findById(s.workspaceId)).toBeDefined();
    });

    it('a non-member gets not_found', async () => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId }))).toBe('not_found');
        expect(await kit.workspaces.findById(s.workspaceId)).toBeDefined();
    });

    it('a personal workspace cannot be deleted (personal_workspace)', async () => {
        const me = kit.addUser('Somchai');
        const personal = await kit.seedPersonal(me);
        expect(outcome(await useCase.execute({ actorId: me, workspaceId: personal }))).toBe('personal_workspace');
        expect(await kit.workspaces.findById(personal)).toBeDefined();
    });
});
