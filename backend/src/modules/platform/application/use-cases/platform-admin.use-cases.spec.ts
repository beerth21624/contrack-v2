import { MODULE_IDS } from '@contrack/contract';
import { type UserProfile, UserDirectory } from '../../../../shared/application/ports';
import type { UserId } from '../../../../shared/domain/ids';
import { AppConfig, testEnv } from '../../../../shared/infrastructure/config/env';
import { FakeWorkspaceDirectory, RecordingAuditLog } from '../../../../shared/testing/platform-fakes';
import { RepositoryModuleFlags } from '../../infrastructure/adapters/module-flags.adapter';
import { PlatformTestKit, errorOf, outcome, valueOf } from '../../testing/platform-test-kit';
import { PlatformAdminAccess } from '../platform-admin-access';
import { GetPlatformAdminStatusUseCase } from './get-platform-admin-status.use-case';
import { ListAdminWorkspacesUseCase } from './list-admin-workspaces.use-case';
import { SetEntitlementUseCase } from './set-entitlement.use-case';
import { StartTrialUseCase } from './start-trial.use-case';

class FakeUsers extends UserDirectory {
    readonly emails = new Map<UserId, string>();

    findMany(ids: readonly UserId[]): Promise<Map<UserId, UserProfile>> {
        return Promise.resolve(new Map(ids.filter(id => this.emails.has(id)).map(id => [id, { id, email: this.emails.get(id) ?? '', displayName: 'x' }])));
    }
}

const config = (admins: string): AppConfig => new AppConfig(testEnv({ PLATFORM_ADMIN_EMAILS: admins }));

describe('PlatformAdminAccess', () => {
    const users = new FakeUsers();
    const kit = new PlatformTestKit();
    const admin = kit.newUserId();
    const other = kit.newUserId();
    const noEmail = kit.newUserId();
    users.emails.set(admin, '  Ops@ConTrack.co.th ');
    users.emails.set(other, 'someone@else.io');
    users.emails.set(noEmail, '');

    it('matches the e-mail case-insensitively', async () => {
        const access = new PlatformAdminAccess(users, config('ops@contrack.co.th, b@x.io'));
        expect(await access.isAdmin(admin)).toBe(true);
        expect(await access.isAdmin(other)).toBe(false);
        expect(await access.isAdmin(kit.newUserId())).toBe(false);
        expect(outcome(await access.check(admin))).toBe('ok');
        expect(outcome(await access.check(other))).toBe('not_found');
    });

    it('nobody is an admin when the list is empty', async () => {
        const access = new PlatformAdminAccess(users, config(''));
        expect(await access.isAdmin(admin)).toBe(false);
        expect(await access.isAdmin(noEmail)).toBe(false);
        expect(await new GetPlatformAdminStatusUseCase(access).execute(admin)).toEqual({ admin: false });
    });
});

describe('platform admin entitlements', () => {
    let kit: PlatformTestKit;
    let dir: FakeWorkspaceDirectory;
    let set: SetEntitlementUseCase;
    let audit: RecordingAuditLog;
    let list: ListAdminWorkspacesUseCase;
    let trial: StartTrialUseCase;
    let admin: UserId;
    let other: UserId;

    beforeEach(() => {
        kit = new PlatformTestKit(MODULE_IDS, 'enforce');
        dir = new FakeWorkspaceDirectory();
        const users = new FakeUsers();
        admin = kit.newUserId();
        other = kit.newUserId();
        users.emails.set(admin, 'OPS@contrack.co.th');
        users.emails.set(other, 'a@b.c');
        const access = new PlatformAdminAccess(users, config('ops@contrack.co.th'));
        audit = new RecordingAuditLog();
        set = new SetEntitlementUseCase(access, dir, kit.entitlements, kit.states, kit.uow, kit.clock, audit);
        list = new ListAdminWorkspacesUseCase(access, dir, kit.entitlements, kit.clock);
        trial = new StartTrialUseCase(kit.roles, kit.states, kit.modules, kit.entitlements, kit.uow, kit.clock);
    });

    it('refuses everybody but the admin with not_found', async () => {
        const ws = kit.newWorkspaceId();
        dir.nameOf.set(ws, 'Acme');
        expect(outcome(await set.execute({ actorId: other, workspaceId: ws, module: 'billing', status: 'purchased' }))).toBe('not_found');
        expect(outcome(await list.execute({ actorId: other, limit: 10 }))).toBe('not_found');
    });

    it('sets purchased and the workspace sees it at once (cache invalidated)', async () => {
        const s = kit.seedWorkspace();
        dir.nameOf.set(s.workspaceId, 'Acme Builders');
        const flags = new RepositoryModuleFlags(kit.states);
        expect(await flags.isEnabled(s.workspaceId, 'project-hub')).toBe(false);
        const view = valueOf(await set.execute({ actorId: admin, workspaceId: s.workspaceId, module: 'project-hub', status: 'purchased', note: ' paid ' }));
        expect(view).toMatchObject({ module: 'project-hub', status: 'purchased', expiresAt: null, note: 'paid' });
        const row = await kit.entitlements.find(s.workspaceId, 'project-hub');
        expect(row?.toProps().grantedBy).toBe(admin);
        expect(audit.entries).toEqual([{
            workspaceId: s.workspaceId, projectId: null, actor: admin, entityType: 'entitlement', entityId: 'project-hub', action: 'set',
            data: { status: [null, 'purchased'], expiresAt: [null, null], note: ['', 'paid'] },
        }]);

        const states = await kit.states.cachedInputs(s.workspaceId);
        expect(states.grants.get('project-hub')?.status).toBe('purchased');
    });

    it('trial needs an end; revoked ignores it and keeps trialUsedAt; an admin trial counts as the trial', async () => {
        const s = kit.seedWorkspace();
        dir.nameOf.set(s.workspaceId, 'Acme');
        expect(errorOf(await set.execute({ actorId: admin, workspaceId: s.workspaceId, module: 'project-hub', status: 'trial' })).code).toBe('validation_failed');
        const end = new Date(kit.clock.now().getTime() + 86_400_000);
        valueOf(await set.execute({ actorId: admin, workspaceId: s.workspaceId, module: 'project-hub', status: 'trial', expiresAt: end }));
        const used = (await kit.entitlements.find(s.workspaceId, 'project-hub'))?.trialUsedAt;
        expect(used).toEqual(kit.clock.now());
        const revoked = valueOf(await set.execute({ actorId: admin, workspaceId: s.workspaceId, module: 'project-hub', status: 'revoked', expiresAt: end }));
        expect(revoked).toMatchObject({ status: 'revoked', expiresAt: null });
        expect((await kit.entitlements.find(s.workspaceId, 'project-hub'))?.trialUsedAt).toEqual(used);
        expect(errorOf(await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'project-hub' })).code).toBe('conflict');
    });

    it('rejects a module without entitlement and an unknown workspace', async () => {
        const s = kit.seedWorkspace();
        dir.nameOf.set(s.workspaceId, 'Acme');
        expect(outcome(await set.execute({ actorId: admin, workspaceId: s.workspaceId, module: 'workforce', status: 'purchased' }))).toBe('unprocessable');
        expect(outcome(await set.execute({ actorId: admin, workspaceId: kit.newWorkspaceId(), module: 'billing', status: 'purchased' }))).toBe('not_found');
    });

    it('lists workspaces by name with the stored status of every entitlement-bound module', async () => {
        const a = kit.newWorkspaceId();
        const b = kit.newWorkspaceId();
        dir.nameOf.set(a, 'Acme Builders');
        dir.nameOf.set(b, 'Other Co');
        valueOf(await set.execute({ actorId: admin, workspaceId: a, module: 'billing', status: 'beta' }));
        const found = valueOf(await list.execute({ actorId: admin, q: 'acme', limit: 10 }));
        expect(found.map(w => w.name)).toEqual(['Acme Builders']);
        expect(found[0]?.entitlements.find(e => e.module === 'billing')).toMatchObject({ status: 'beta' });
        expect(found[0]?.entitlements.find(e => e.module === 'quotations')).toMatchObject({ status: 'none' });
        expect(found[0]?.entitlements.some(e => e.module === 'workforce')).toBe(false);
        expect(valueOf(await list.execute({ actorId: admin, q: b, limit: 10 })).map(w => w.name)).toEqual(['Other Co']);
    });
});
