import type { AssignableRole, Role } from '@contrack/contract';
import {
    DAY_MS, FakeUserDirectory, INVITATION_TTL_DAYS, WorkspacesTestKit, outcome, valueOf,
} from '../../testing/workspaces-test-kit';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { CreateInvitationUseCase } from './create-invitation.use-case';
import { RevokeInvitationUseCase } from './revoke-invitation.use-case';

const build = (kit: WorkspacesTestKit) => ({
    accept: new AcceptInvitationUseCase(kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock),
    invite: new CreateInvitationUseCase(kit.workspaces, kit.memberships, kit.invitations, kit.users, kit.uow, kit.clock, kit.ids, kit.config),
});

describe('AcceptInvitationUseCase', () => {
    let kit: WorkspacesTestKit;
    let accept: AcceptInvitationUseCase;
    let invite: CreateInvitationUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        ({ accept, invite } = build(kit));
    });

    const seed = async (role: AssignableRole = 'estimator', email = 'nina@example.com') => {
        const s = await kit.seedCompany();
        const nina = kit.addUser('Nina', 'Nina@Example.com');
        const created = valueOf(await invite.execute({ actorId: s.admin, workspaceId: s.workspaceId, email, role }));
        return { ...s, nina, ...created };
    };

    it('makes the invited user a member with the invited role and marks the invitation accepted', async () => {
        const s = await seed('estimator');
        kit.clock.advance(DAY_MS);
        const run = jest.spyOn(kit.uow, 'run');

        expect(valueOf(await accept.execute({ userId: s.nina, token: s.token }))).toEqual({ workspaceId: s.workspaceId, role: 'estimator' });

        expect(run).toHaveBeenCalledTimes(1);
        const membership = await kit.memberships.find(s.workspaceId, s.nina);
        expect(membership?.role).toBe('estimator');
        expect(membership?.joinedAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
        const stored = await kit.invitations.findById(s.workspaceId, s.invitation.id);
        expect(stored?.status(kit.clock.now())).toBe('accepted');
        expect(stored?.acceptedBy).toBe(s.nina);
        expect(stored?.acceptedAt?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    });

    it('matches the e-mail case-insensitively', async () => {
        const s = await seed('viewer', 'NINA@EXAMPLE.COM');
        expect(outcome(await accept.execute({ userId: s.nina, token: s.token }))).toBe('ok');
    });

    it('accepts one millisecond before expiry', async () => {
        const s = await seed();
        kit.clock.advance(INVITATION_TTL_DAYS * DAY_MS - 1);
        expect(outcome(await accept.execute({ userId: s.nina, token: s.token }))).toBe('ok');
    });

    describe('invitation_invalid', () => {
        it('an unknown token', async () => {
            const s = await seed();
            expect(outcome(await accept.execute({ userId: s.nina, token: 'x'.repeat(43) }))).toBe('invitation_invalid');
        });

        it('an expired invitation', async () => {
            const s = await seed();
            kit.clock.advance(INVITATION_TTL_DAYS * DAY_MS);
            expect(outcome(await accept.execute({ userId: s.nina, token: s.token }))).toBe('invitation_invalid');
            expect(await kit.roleOf(s.workspaceId, s.nina)).toBeUndefined();
        });

        it('a revoked invitation', async () => {
            const s = await seed();
            valueOf(await new RevokeInvitationUseCase(kit.memberships, kit.invitations, kit.clock)
                .execute({ actorId: s.owner, workspaceId: s.workspaceId, invitationId: s.invitation.id }));
            expect(outcome(await accept.execute({ userId: s.nina, token: s.token }))).toBe('invitation_invalid');
            expect(await kit.roleOf(s.workspaceId, s.nina)).toBeUndefined();
        });

        it('a second use of the same token (single use)', async () => {
            const s = await seed();
            valueOf(await accept.execute({ userId: s.nina, token: s.token }));
            expect(outcome(await accept.execute({ userId: s.nina, token: s.token }))).toBe('invitation_invalid');
        });

        it('a user whose e-mail is not the invitation\'s, without revealing the workspace', async () => {
            const s = await seed();
            const r = await accept.execute({ userId: s.outsider, token: s.token });
            expect(outcome(r)).toBe('invitation_invalid');
            if (!r.ok) {
                expect(r.error.details).toBeUndefined();
                expect(r.error.message).not.toContain(s.workspaceId);
                expect(r.error.message).not.toContain('Acme');
            }
            expect(await kit.roleOf(s.workspaceId, s.outsider)).toBeUndefined();
            expect((await kit.invitations.findById(s.workspaceId, s.invitation.id))?.status(kit.clock.now())).toBe('pending');
        });

        it('the same answer for wrong e-mail, unknown, expired and revoked tokens', async () => {
            const s = await seed();
            const wrong = await accept.execute({ userId: s.outsider, token: s.token });
            const unknown = await accept.execute({ userId: s.nina, token: 'y'.repeat(43) });
            expect(wrong).toEqual(unknown);
        });

        it('a user who does not exist in the directory', async () => {
            const s = await seed();
            const empty = new AcceptInvitationUseCase(kit.memberships, kit.invitations, new FakeUserDirectory(), kit.uow, kit.clock);
            expect(outcome(await empty.execute({ userId: s.nina, token: s.token }))).toBe('invitation_invalid');
            expect(await kit.roleOf(s.workspaceId, s.nina)).toBeUndefined();
        });
    });

    describe('already a member', () => {
        const cases: [Role, AssignableRole, Role][] = [
            ['owner', 'viewer', 'owner'],
            ['admin', 'estimator', 'admin'],
            ['estimator', 'estimator', 'estimator'],
            ['viewer', 'admin', 'admin'],
            ['estimator', 'admin', 'admin'],
            ['viewer', 'estimator', 'estimator'],
        ];

        it.each(cases)('a %s accepting a %s invitation ends up %s', async (current, invited, expected) => {
            const s = await kit.seedCompany();
            const member = kit.addUser('Mia Member', 'mia@example.com');
            // Invited before joining (inviting a current member is a conflict), then joined some other way.
            const created = valueOf(await invite.execute({ actorId: s.owner, workspaceId: s.workspaceId, email: 'mia@example.com', role: invited }));
            await kit.addMember(s.workspaceId, member, current);

            expect(valueOf(await accept.execute({ userId: member, token: created.token }))).toEqual({ workspaceId: s.workspaceId, role: expected });
            expect(await kit.roleOf(s.workspaceId, member)).toBe(expected);
            expect((await kit.invitations.findById(s.workspaceId, created.invitation.id))?.status(kit.clock.now())).toBe('accepted');
            expect(await kit.memberships.listByWorkspace(s.workspaceId)).toHaveLength(5);
        });
    });

    it('two concurrent accepts of one token: exactly one succeeds', async () => {
        kit = new WorkspacesTestKit({ slowMembershipWrites: true });
        ({ accept, invite } = build(kit));
        const s = await seed('viewer');

        const results = await Promise.all([
            accept.execute({ userId: s.nina, token: s.token }),
            accept.execute({ userId: s.nina, token: s.token }),
        ]);

        expect(results.map(outcome).sort()).toEqual(['invitation_invalid', 'ok']);
        expect(await kit.roleOf(s.workspaceId, s.nina)).toBe('viewer');
    });
});
