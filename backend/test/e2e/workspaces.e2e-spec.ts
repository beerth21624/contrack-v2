// ─── E2E: company workspaces, invitations, members, the role-change matrix, removal and leaving ───
import {
    acceptInvitationResponseSchema, createInvitationResponseSchema, invitationDtoSchema, memberDtoSchema,
    workspaceDtoSchema,
} from '@contrack/contract';
import {
    type Session, type TestApp, addMember, bearer, createCompany, expectError, expectStatus, invite, login, register,
    startApp,
} from '../support/e2e';

const DAY_MS = 24 * 60 * 60 * 1000;
const INVITATION_TTL_DAYS = 7;

describe('workspaces (e2e)', () => {
    let t: TestApp;

    beforeAll(async () => {
        t = await startApp();
    });

    afterAll(async () => {
        await t.close();
    });

    async function members(as: Session, workspaceId: string) {
        const res = await t.http().get(`/workspaces/${workspaceId}/members`).set(bearer(as.accessToken));
        expectStatus(res, 200);
        return memberDtoSchema.array().parse(res.body);
    }

    async function roleOf(as: Session, workspaceId: string, userId: string) {
        return (await members(as, workspaceId)).find(m => m.userId === userId)?.role;
    }

    const changeRole = (as: Session, workspaceId: string, userId: string, role: string) =>
        t.http().patch(`/workspaces/${workspaceId}/members/${userId}`).set(bearer(as.accessToken)).send({ role });

    const removeMember = (as: Session, workspaceId: string, userId: string) =>
        t.http().delete(`/workspaces/${workspaceId}/members/${userId}`).set(bearer(as.accessToken));

    describe('create, invite, accept', () => {
        it('creates a company workspace owned by the creator', async () => {
            const owner = await register(t, 'Owner');
            const company = await createCompany(t, owner, '  Acme Builders  ');
            expect(company).toMatchObject({ name: 'Acme Builders', kind: 'company', role: 'owner', memberCount: 1 });

            const res = await t.http().get(`/workspaces/${company.id}`).set(bearer(owner.accessToken));
            expectStatus(res, 200);
            expect(workspaceDtoSchema.parse(res.body)).toEqual(company);
        });

        it('invites with a one-time token that the invited e-mail accepts', async () => {
            const owner = await register(t, 'Owner');
            const bob = await register(t, 'Bob');
            const company = await createCompany(t, owner);

            const created = await t.http().post(`/workspaces/${company.id}/invitations`).set(bearer(owner.accessToken))
                .send({ email: bob.email.toUpperCase(), role: 'estimator' });
            expectStatus(created, 201);
            const { invitation, token } = createInvitationResponseSchema.parse(created.body);
            expect(invitation).toMatchObject({ email: bob.email, role: 'estimator', invitedBy: owner.userId });
            expect(new Date(invitation.expiresAt).getTime() - new Date(invitation.createdAt).getTime())
                .toBe(INVITATION_TTL_DAYS * DAY_MS);

            const pending = await t.http().get(`/workspaces/${company.id}/invitations`).set(bearer(owner.accessToken));
            expectStatus(pending, 200);
            expect(invitationDtoSchema.array().parse(pending.body)).toEqual([invitation]);

            const accepted = await t.http().post('/invitations/accept').set(bearer(bob.accessToken)).send({ token });
            expectStatus(accepted, 200);
            expect(acceptInvitationResponseSchema.parse(accepted.body)).toEqual({ workspaceId: company.id, role: 'estimator' });

            // Bob now sees the workspace; nothing is pending; the token is single use.
            const bobs = workspaceDtoSchema.array().parse((await t.http().get('/workspaces').set(bearer(bob.accessToken))).body);
            expect(bobs).toEqual(expect.arrayContaining([expect.objectContaining({ id: company.id, role: 'estimator', memberCount: 2 })]));
            const after = await t.http().get(`/workspaces/${company.id}/invitations`).set(bearer(owner.accessToken));
            expect(after.body).toEqual([]);
            expectError(await t.http().post('/invitations/accept').set(bearer(bob.accessToken)).send({ token }), 410, 'invitation_invalid');
        });

        it('refuses an invitation accepted with another e-mail (410 invitation_invalid)', async () => {
            const owner = await register(t, 'Owner');
            const bob = await register(t, 'Bob');
            const mallory = await register(t, 'Mallory');
            const company = await createCompany(t, owner);
            const token = await invite(t, owner, company.id, bob.email, 'viewer');

            expectError(await t.http().post('/invitations/accept').set(bearer(mallory.accessToken)).send({ token }), 410, 'invitation_invalid');
            expect((await members(owner, company.id)).map(m => m.userId)).not.toContain(mallory.userId);
            // The invitation is untouched: Bob can still use it.
            expectStatus(await t.http().post('/invitations/accept').set(bearer(bob.accessToken)).send({ token }), 200);
        });

        it('refuses an unknown or revoked invitation token (410)', async () => {
            const owner = await register(t, 'Owner');
            const bob = await register(t, 'Bob');
            const company = await createCompany(t, owner);
            const created = await t.http().post(`/workspaces/${company.id}/invitations`).set(bearer(owner.accessToken))
                .send({ email: bob.email, role: 'viewer' });
            const { invitation, token } = createInvitationResponseSchema.parse(created.body);

            expectStatus(await t.http().delete(`/workspaces/${company.id}/invitations/${invitation.id}`).set(bearer(owner.accessToken)), 204);
            expectError(await t.http().post('/invitations/accept').set(bearer(bob.accessToken)).send({ token }), 410, 'invitation_invalid');
            expectError(await t.http().post('/invitations/accept').set(bearer(bob.accessToken))
                .send({ token: 'x'.repeat(43) }), 410, 'invitation_invalid');
        });

        it('refuses to invite someone who is already a member (409 conflict)', async () => {
            const owner = await register(t, 'Owner');
            const bob = await register(t, 'Bob');
            const company = await createCompany(t, owner);
            await addMember(t, owner, company.id, bob, 'viewer');
            const res = await t.http().post(`/workspaces/${company.id}/invitations`).set(bearer(owner.accessToken))
                .send({ email: bob.email, role: 'admin' });
            expectError(res, 409, 'conflict');
        });

        it('lists the members with their roles', async () => {
            const owner = await register(t, 'Owner');
            const bob = await register(t, 'Bob');
            const carol = await register(t, 'Carol');
            const company = await createCompany(t, owner);
            await addMember(t, owner, company.id, bob, 'estimator');
            await addMember(t, owner, company.id, carol, 'viewer');

            // Every member may read the list (members.read), viewers included.
            const list = await members(carol, company.id);
            expect(list).toHaveLength(3);
            expect(list).toEqual(expect.arrayContaining([
                expect.objectContaining({ userId: owner.userId, email: owner.email, displayName: 'Owner', role: 'owner' }),
                expect.objectContaining({ userId: bob.userId, email: bob.email, displayName: 'Bob', role: 'estimator' }),
                expect.objectContaining({ userId: carol.userId, email: carol.email, displayName: 'Carol', role: 'viewer' }),
            ]));
        });
    });

    describe('expired invitation', () => {
        let clockApp: TestApp;

        beforeAll(async () => {
            clockApp = await startApp();
        });

        afterAll(async () => {
            await clockApp.close();
        });

        it('cannot be accepted after INVITATION_TTL_DAYS (410 invitation_invalid)', async () => {
            const owner = await register(clockApp, 'Owner');
            const bob = await register(clockApp, 'Bob');
            const company = await createCompany(clockApp, owner);
            const token = await invite(clockApp, owner, company.id, bob.email, 'viewer');

            clockApp.clock.advance(INVITATION_TTL_DAYS * DAY_MS);
            const fresh = await login(clockApp, bob); // the old access token expired with the clock
            const res = await clockApp.http().post('/invitations/accept').set(bearer(fresh.accessToken)).send({ token });
            expectError(res, 410, 'invitation_invalid');

            const ownerAgain = await login(clockApp, owner);
            const pending = await clockApp.http().get(`/workspaces/${company.id}/invitations`).set(bearer(ownerAgain.accessToken));
            expect(pending.body).toEqual([]);
        });
    });

    describe('role changes', () => {
        let owner: Session;
        let admin: Session;
        let estimator: Session;
        let viewer: Session;
        let workspaceId: string;

        beforeEach(async () => {
            owner = await register(t, 'Owner');
            admin = await register(t, 'Admin');
            estimator = await register(t, 'Estimator');
            viewer = await register(t, 'Viewer');
            workspaceId = (await createCompany(t, owner)).id;
            await addMember(t, owner, workspaceId, admin, 'admin');
            await addMember(t, owner, workspaceId, estimator, 'estimator');
            await addMember(t, owner, workspaceId, viewer, 'viewer');
        });

        it('lets an admin change members below the owner', async () => {
            const res = await changeRole(admin, workspaceId, estimator.userId, 'viewer');
            expectStatus(res, 200);
            expect(memberDtoSchema.parse(res.body)).toMatchObject({ userId: estimator.userId, role: 'viewer' });
            expectStatus(await changeRole(admin, workspaceId, viewer.userId, 'admin'), 200);
            expect(await roleOf(owner, workspaceId, viewer.userId)).toBe('admin');
        });

        it('never lets an admin touch an owner or grant ownership', async () => {
            expectError(await changeRole(admin, workspaceId, owner.userId, 'admin'), 403, 'forbidden');
            expectError(await changeRole(admin, workspaceId, owner.userId, 'viewer'), 403, 'forbidden');
            expectError(await changeRole(admin, workspaceId, viewer.userId, 'owner'), 403, 'forbidden');
            expectError(await changeRole(admin, workspaceId, admin.userId, 'owner'), 403, 'forbidden');
            expectError(await removeMember(admin, workspaceId, owner.userId), 403, 'forbidden');
            expect(await roleOf(owner, workspaceId, owner.userId)).toBe('owner');
        });

        it('refuses role changes by estimators and viewers', async () => {
            expectError(await changeRole(estimator, workspaceId, viewer.userId, 'estimator'), 403, 'forbidden');
            expectError(await changeRole(viewer, workspaceId, estimator.userId, 'viewer'), 403, 'forbidden');
            expectError(await changeRole(viewer, workspaceId, viewer.userId, 'admin'), 403, 'forbidden');
        });

        it('never leaves the workspace without an owner (409 last_owner)', async () => {
            expectError(await changeRole(owner, workspaceId, owner.userId, 'admin'), 409, 'last_owner');
            expectError(await removeMember(owner, workspaceId, owner.userId), 409, 'last_owner');

            // With a second owner the first may step down …
            expectStatus(await changeRole(owner, workspaceId, admin.userId, 'owner'), 200);
            expectStatus(await changeRole(owner, workspaceId, owner.userId, 'admin'), 200);
            // … but the remaining one may not, neither by demotion nor by leaving.
            expectError(await changeRole(admin, workspaceId, admin.userId, 'estimator'), 409, 'last_owner');
            expectError(await removeMember(admin, workspaceId, admin.userId), 409, 'last_owner');

            const owners = (await members(owner, workspaceId)).filter(m => m.role === 'owner');
            expect(owners.map(m => m.userId)).toEqual([admin.userId]);
        });

        it('answers 404 to outsiders and for unknown members', async () => {
            const outsider = await register(t, 'Outsider');
            expectError(await changeRole(outsider, workspaceId, viewer.userId, 'admin'), 404, 'not_found');
            expectError(await removeMember(outsider, workspaceId, viewer.userId), 404, 'not_found');
            expectError(await t.http().get(`/workspaces/${workspaceId}/members`).set(bearer(outsider.accessToken)), 404, 'not_found');
            expectError(await changeRole(owner, workspaceId, outsider.userId, 'admin'), 404, 'not_found');
        });

        it('validates the role (400)', async () => {
            expectError(await changeRole(owner, workspaceId, viewer.userId, 'superuser'), 400, 'validation_failed');
        });
    });

    describe('personal workspace', () => {
        it('cannot invite, change roles or remove members (409 personal_workspace)', async () => {
            const alice = await register(t, 'Alice');
            const bob = await register(t, 'Bob');
            const ws = alice.personalWorkspaceId;
            const inv = await t.http().post(`/workspaces/${ws}/invitations`).set(bearer(alice.accessToken))
                .send({ email: bob.email, role: 'viewer' });
            expectError(inv, 409, 'personal_workspace');
            expectError(await changeRole(alice, ws, alice.userId, 'admin'), 409, 'personal_workspace');
            expectError(await removeMember(alice, ws, alice.userId), 409, 'personal_workspace');
            expectError(await t.http().delete(`/workspaces/${ws}`).set(bearer(alice.accessToken)), 409, 'personal_workspace');
        });
    });

    describe('removal and leaving', () => {
        it('removes a member, who then loses the workspace and its projects (404)', async () => {
            const owner = await register(t, 'Owner');
            const bob = await register(t, 'Bob');
            const company = await createCompany(t, owner);
            await addMember(t, owner, company.id, bob, 'estimator');
            const created = await t.http().post(`/workspaces/${company.id}/projects`).set(bearer(owner.accessToken))
                .send({ name: 'House', start: 'blank' });
            expectStatus(created, 201);
            const projectId = (created.body as { project: { id: string } }).project.id;
            expectStatus(await t.http().get(`/projects/${projectId}`).set(bearer(bob.accessToken)), 200);

            expectStatus(await removeMember(owner, company.id, bob.userId), 204);

            expect((await members(owner, company.id)).map(m => m.userId)).toEqual([owner.userId]);
            expectError(await t.http().get(`/workspaces/${company.id}`).set(bearer(bob.accessToken)), 404, 'not_found');
            expectError(await t.http().get(`/workspaces/${company.id}/projects`).set(bearer(bob.accessToken)), 404, 'not_found');
            expectError(await t.http().get(`/projects/${projectId}`).set(bearer(bob.accessToken)), 404, 'not_found');
            expectError(await t.http().put(`/projects/${projectId}/docs/meta`).set(bearer(bob.accessToken))
                .send({ data: { ownerName: 'x' }, baseVersion: 0 }), 404, 'not_found');
            const bobs = workspaceDtoSchema.array().parse((await t.http().get('/workspaces').set(bearer(bob.accessToken))).body);
            expect(bobs.map(w => w.id)).toEqual([bob.personalWorkspaceId]);
        });

        it('lets a member leave (delete themselves)', async () => {
            const owner = await register(t, 'Owner');
            const viewer = await register(t, 'Viewer');
            const company = await createCompany(t, owner);
            await addMember(t, owner, company.id, viewer, 'viewer');

            expectStatus(await removeMember(viewer, company.id, viewer.userId), 204);
            expectError(await t.http().get(`/workspaces/${company.id}`).set(bearer(viewer.accessToken)), 404, 'not_found');
            const ws = workspaceDtoSchema.parse((await t.http().get(`/workspaces/${company.id}`).set(bearer(owner.accessToken))).body);
            expect(ws.memberCount).toBe(1);
        });

        it('does not let a viewer remove someone else (403)', async () => {
            const owner = await register(t, 'Owner');
            const viewer = await register(t, 'Viewer');
            const estimator = await register(t, 'Estimator');
            const company = await createCompany(t, owner);
            await addMember(t, owner, company.id, viewer, 'viewer');
            await addMember(t, owner, company.id, estimator, 'estimator');
            expectError(await removeMember(viewer, company.id, estimator.userId), 403, 'forbidden');
        });
    });
});
