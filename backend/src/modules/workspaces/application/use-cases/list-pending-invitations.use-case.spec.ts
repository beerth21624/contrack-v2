import { DAY_MS, INVITATION_TTL_DAYS, WorkspacesTestKit, outcome, valueOf } from '../../testing/workspaces-test-kit';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { CreateInvitationUseCase } from './create-invitation.use-case';
import { ListPendingInvitationsUseCase } from './list-pending-invitations.use-case';
import { RevokeInvitationUseCase } from './revoke-invitation.use-case';

describe('ListPendingInvitationsUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: ListPendingInvitationsUseCase;
    let invite: CreateInvitationUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new ListPendingInvitationsUseCase(kit.memberships, kit.invitations, kit.clock);
        invite = new CreateInvitationUseCase(
            kit.workspaces, kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock, kit.ids, kit.config);
    });

    it('lists only pending invitations, newest first', async () => {
        const s = await kit.seedCompany();
        const nina = kit.addUser('Nina', 'nina@example.com');
        const accepted = valueOf(await invite.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'nina@example.com', role: 'viewer' }));
        const revoked = valueOf(await invite.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'rev@example.com', role: 'viewer' }));
        kit.clock.advance(1000);
        const older = valueOf(await invite.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'older@example.com', role: 'viewer' }));
        kit.clock.advance(1000);
        const newer = valueOf(await invite.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'newer@example.com', role: 'admin' }));

        valueOf(await new AcceptInvitationUseCase(kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock)
            .execute({ userId: nina, token: accepted.token }));
        valueOf(await new RevokeInvitationUseCase(kit.memberships, kit.invitations, kit.clock)
            .execute({ actorId: s.owner, workspaceId: s.workspaceId, invitationId: revoked.invitation.id }));

        const list = valueOf(await useCase.execute({ actorId: s.admin, workspaceId: s.workspaceId }));
        expect(list.map(i => i.id)).toEqual([newer.invitation.id, older.invitation.id]);
    });

    it('leaves out expired invitations', async () => {
        const s = await kit.seedCompany();
        valueOf(await invite.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'n@example.com', role: 'viewer' }));
        kit.clock.advance(INVITATION_TTL_DAYS * DAY_MS);
        expect(valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId }))).toEqual([]);
    });

    it('never lists another workspace\'s invitations', async () => {
        const s = await kit.seedCompany();
        const other = await kit.seedWorkspace('company', [[s.outsider, 'owner']], 'Other Co');
        valueOf(await invite.execute({ actorId: s.outsider, workspaceId: other, email: 'n@example.com', role: 'viewer' }));
        expect(valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId }))).toEqual([]);
    });

    it.each(['owner', 'admin'] as const)('a %s may list', async role => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId }))).toBe('ok');
    });

    it.each(['estimator', 'viewer'] as const)('a %s is forbidden', async role => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId }))).toBe('forbidden');
    });

    it('a non-member gets not_found', async () => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId }))).toBe('not_found');
    });

    it('a personal workspace has no invitations', async () => {
        const me = kit.addUser('Somchai');
        const personal = await kit.seedPersonal(me);
        expect(valueOf(await useCase.execute({ actorId: me, workspaceId: personal }))).toEqual([]);
    });
});
