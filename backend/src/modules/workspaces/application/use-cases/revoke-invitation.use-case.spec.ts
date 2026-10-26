import { asInvitationId } from '../../../../shared/domain/ids';
import { DAY_MS, INVITATION_TTL_DAYS, WorkspacesTestKit, outcome, valueOf } from '../../testing/workspaces-test-kit';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { CreateInvitationUseCase, type CreatedInvitation } from './create-invitation.use-case';
import { RevokeInvitationUseCase } from './revoke-invitation.use-case';

describe('RevokeInvitationUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: RevokeInvitationUseCase;
    let invite: CreateInvitationUseCase;
    let accept: AcceptInvitationUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new RevokeInvitationUseCase(kit.memberships, kit.invitations, kit.clock);
        invite = new CreateInvitationUseCase(
            kit.workspaces, kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock, kit.ids, kit.config);
        accept = new AcceptInvitationUseCase(kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock);
    });

    const seed = async () => {
        const s = await kit.seedCompany();
        const nina = kit.addUser('Nina', 'nina@example.com');
        const created: CreatedInvitation = valueOf(await invite.execute({
            actorId: s.owner, workspaceId: s.workspaceId, email: 'nina@example.com', role: 'viewer',
        }));
        return { ...s, nina, created };
    };

    it.each(['owner', 'admin'] as const)('a %s revokes a pending invitation; its token stops working', async role => {
        const s = await seed();
        kit.clock.advance(1000);
        expect(outcome(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId, invitationId: s.created.invitation.id }))).toBe('ok');

        const stored = await kit.invitations.findById(s.workspaceId, s.created.invitation.id);
        expect(stored?.status(kit.clock.now())).toBe('revoked');
        expect(stored?.revokedAt?.toISOString()).toBe('2026-01-01T00:00:01.000Z');
        expect(await kit.invitations.listPending(s.workspaceId, kit.clock.now())).toEqual([]);
        expect(outcome(await accept.execute({ userId: s.nina, token: s.created.token }))).toBe('invitation_invalid');
    });

    it.each(['estimator', 'viewer'] as const)('a %s is forbidden', async role => {
        const s = await seed();
        expect(outcome(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId, invitationId: s.created.invitation.id }))).toBe('forbidden');
        expect(await kit.invitations.listPending(s.workspaceId, kit.clock.now())).toHaveLength(1);
    });

    it('a non-member gets not_found', async () => {
        const s = await seed();
        expect(outcome(await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId, invitationId: s.created.invitation.id }))).toBe('not_found');
    });

    it('an unknown invitation is not_found', async () => {
        const s = await seed();
        const missing = asInvitationId('00000000-0000-4000-8000-00000000ffff');
        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, invitationId: missing }))).toBe('not_found');
    });

    it('an invitation of another workspace is not_found (even for an owner there)', async () => {
        const s = await seed();
        const other = await kit.seedWorkspace('company', [[s.owner, 'owner']], 'Other Co');
        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: other, invitationId: s.created.invitation.id }))).toBe('not_found');
        expect(await kit.invitations.listPending(s.workspaceId, kit.clock.now())).toHaveLength(1);
    });

    it('an already revoked invitation is not_found', async () => {
        const s = await seed();
        valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, invitationId: s.created.invitation.id }));
        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, invitationId: s.created.invitation.id }))).toBe('not_found');
    });

    it('an accepted invitation is not_found and the membership stays', async () => {
        const s = await seed();
        valueOf(await accept.execute({ userId: s.nina, token: s.created.token }));
        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, invitationId: s.created.invitation.id }))).toBe('not_found');
        expect(await kit.roleOf(s.workspaceId, s.nina)).toBe('viewer');
    });

    it('an expired invitation is not_found', async () => {
        const s = await seed();
        kit.clock.advance(INVITATION_TTL_DAYS * DAY_MS);
        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, invitationId: s.created.invitation.id }))).toBe('not_found');
    });
});
