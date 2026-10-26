import { AppConfig, testEnv } from '../../../../shared/infrastructure/config/env';
import { sha256 } from '../../../../shared/infrastructure/crypto';
import { DAY_MS, INVITATION_TTL_DAYS, WorkspacesTestKit, outcome, valueOf } from '../../testing/workspaces-test-kit';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { CreateInvitationUseCase } from './create-invitation.use-case';

describe('CreateInvitationUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: CreateInvitationUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new CreateInvitationUseCase(
            kit.workspaces, kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock, kit.ids, kit.config);
    });

    it('creates a pending invitation, returns the raw token once and stores only its hash', async () => {
        const s = await kit.seedCompany();
        const { invitation, token } = valueOf(await useCase.execute({
            actorId: s.owner, workspaceId: s.workspaceId, email: ' Nina@Example.com ', role: 'estimator',
        }));

        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(invitation.tokenHash).toBe(sha256(token));
        expect(invitation.tokenHash).not.toBe(token);
        expect(invitation.email.value).toBe('nina@example.com');
        expect(invitation.role).toBe('estimator');
        expect(invitation.invitedBy).toBe(s.owner);
        expect(invitation.workspaceId).toBe(s.workspaceId);
        expect(invitation.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
        expect(invitation.expiresAt.getTime() - invitation.createdAt.getTime()).toBe(INVITATION_TTL_DAYS * DAY_MS);
        expect(invitation.status(kit.clock.now())).toBe('pending');

        const stored = await kit.invitations.findByTokenHash(sha256(token));
        expect(stored?.id).toBe(invitation.id);
        expect(await kit.invitations.findByTokenHash(token)).toBeUndefined();
    });

    it('gives a different token to every invitation', async () => {
        const s = await kit.seedCompany();
        const a = valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'a@example.com', role: 'viewer' }));
        const b = valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'b@example.com', role: 'viewer' }));
        expect(a.token).not.toBe(b.token);
    });

    it('uses INVITATION_TTL_DAYS from the configuration', async () => {
        const s = await kit.seedCompany();
        const longer = new CreateInvitationUseCase(kit.workspaces, kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock,
            kit.ids, new AppConfig(testEnv({ INVITATION_TTL_DAYS: '30' })));
        const { invitation } = valueOf(await longer.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'a@example.com', role: 'viewer' }));
        expect(invitation.expiresAt.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    });

    describe('authorization per role', () => {
        it.each([
            ['owner', 'admin'], ['owner', 'estimator'], ['owner', 'viewer'],
            ['admin', 'admin'], ['admin', 'estimator'], ['admin', 'viewer'],
        ] as const)('a %s may invite as %s', async (inviter, role) => {
            const s = await kit.seedCompany();
            expect(outcome(await useCase.execute({ actorId: s.byRole[inviter], workspaceId: s.workspaceId, email: 'n@example.com', role }))).toBe('ok');
        });

        it.each(['estimator', 'viewer'] as const)('a %s is forbidden', async inviter => {
            const s = await kit.seedCompany();
            const r = await useCase.execute({ actorId: s.byRole[inviter], workspaceId: s.workspaceId, email: 'n@example.com', role: 'viewer' });
            expect(outcome(r)).toBe('forbidden');
            expect(await kit.invitations.listPending(s.workspaceId, kit.clock.now())).toEqual([]);
        });

        it('a non-member gets not_found', async () => {
            const s = await kit.seedCompany();
            const r = await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId, email: 'n@example.com', role: 'viewer' });
            expect(outcome(r)).toBe('not_found');
        });
    });

    it('a personal workspace cannot invite (personal_workspace)', async () => {
        const me = kit.addUser('Somchai');
        const personal = await kit.seedPersonal(me);
        expect(outcome(await useCase.execute({ actorId: me, workspaceId: personal, email: 'n@example.com', role: 'viewer' }))).toBe('personal_workspace');
    });

    it('rejects an invalid e-mail', async () => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'not-an-email', role: 'viewer' }))).toBe('validation_failed');
    });

    it.each(['victor.viewer@example.com', 'VICTOR.Viewer@Example.com', 'olivia.owner@example.com'])(
        'inviting a current member (%s) is a conflict', async email => {
            const s = await kit.seedCompany();
            expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email, role: 'viewer' }))).toBe('conflict');
            expect(await kit.invitations.listPending(s.workspaceId, kit.clock.now())).toEqual([]);
        });

    it('a person who is a member of another workspace only can be invited', async () => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'oscar.outsider@example.com', role: 'viewer' }))).toBe('ok');
    });

    describe('replacing a pending invitation for the same e-mail', () => {
        it('revokes the old one and keeps only the new one pending', async () => {
            const s = await kit.seedCompany();
            const first = valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'nina@example.com', role: 'viewer' }));
            kit.clock.advance(60_000);
            const second = valueOf(await useCase.execute({ actorId: s.admin, workspaceId: s.workspaceId, email: 'NINA@example.com', role: 'admin' }));

            const pending = await kit.invitations.listPending(s.workspaceId, kit.clock.now());
            expect(pending.map(i => i.id)).toEqual([second.invitation.id]);
            const old = await kit.invitations.findById(s.workspaceId, first.invitation.id);
            expect(old?.status(kit.clock.now())).toBe('revoked');
            expect(old?.revokedAt?.toISOString()).toBe('2026-01-01T00:01:00.000Z');
        });

        it('the old token no longer works, the new one does', async () => {
            const s = await kit.seedCompany();
            const nina = kit.addUser('Nina', 'nina@example.com');
            const first = valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'nina@example.com', role: 'viewer' }));
            const second = valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'nina@example.com', role: 'estimator' }));
            const accept = new AcceptInvitationUseCase(kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock);
            expect(outcome(await accept.execute({ userId: nina, token: first.token }))).toBe('invitation_invalid');
            expect(valueOf(await accept.execute({ userId: nina, token: second.token })).role).toBe('estimator');
        });

        it('leaves invitations for other e-mails alone', async () => {
            const s = await kit.seedCompany();
            valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'a@example.com', role: 'viewer' }));
            valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'b@example.com', role: 'viewer' }));
            expect(await kit.invitations.listPending(s.workspaceId, kit.clock.now())).toHaveLength(2);
        });

        it('leaves a pending invitation for the same e-mail in another workspace alone', async () => {
            const s = await kit.seedCompany();
            const other = await kit.seedWorkspace('company', [[s.owner, 'owner']], 'Other Co');
            valueOf(await useCase.execute({ actorId: s.owner, workspaceId: other, email: 'nina@example.com', role: 'viewer' }));
            valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'nina@example.com', role: 'viewer' }));
            expect(await kit.invitations.listPending(other, kit.clock.now())).toHaveLength(1);
        });

        it('creates a fresh invitation when the previous one already expired', async () => {
            const s = await kit.seedCompany();
            const first = valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'nina@example.com', role: 'viewer' }));
            kit.clock.advance((INVITATION_TTL_DAYS + 1) * DAY_MS);
            valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'nina@example.com', role: 'viewer' }));
            const old = await kit.invitations.findById(s.workspaceId, first.invitation.id);
            expect(old?.status(kit.clock.now())).toBe('expired');
            expect(await kit.invitations.listPending(s.workspaceId, kit.clock.now())).toHaveLength(1);
        });
    });

    it('creates the invitation in one unit of work', async () => {
        const s = await kit.seedCompany();
        const run = jest.spyOn(kit.uow, 'run');
        valueOf(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'n@example.com', role: 'viewer' }));
        expect(run).toHaveBeenCalledTimes(1);
    });
});
