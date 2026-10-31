import { MODULE_IDS, type ModuleId } from '@contrack/contract';
import { WorkspaceEntitlement } from '../../domain/entities/workspace-entitlement.entity';
import { RepositoryModuleFlags } from '../../infrastructure/adapters/module-flags.adapter';
import { PlatformTestKit, errorOf, outcome, valueOf } from '../../testing/platform-test-kit';
import { ListWorkspaceModulesUseCase } from './list-workspace-modules.use-case';
import { SetWorkspaceModuleUseCase } from './set-workspace-module.use-case';
import { StartTrialUseCase } from './start-trial.use-case';

const DAY_MS = 86_400_000;
const ALL: readonly ModuleId[] = MODULE_IDS.filter(m => m !== 'materials' && m !== 'owner-leads');

describe('ERP module flags with ENTITLEMENTS=enforce', () => {
    let kit: PlatformTestKit;
    let trial: StartTrialUseCase;
    let set: SetWorkspaceModuleUseCase;
    let list: ListWorkspaceModulesUseCase;
    let flags: RepositoryModuleFlags;

    beforeEach(() => {
        kit = new PlatformTestKit(ALL, 'enforce');
        trial = new StartTrialUseCase(kit.roles, kit.states, kit.modules, kit.entitlements, kit.uow, kit.clock);
        set = new SetWorkspaceModuleUseCase(kit.roles, kit.states, kit.modules, kit.work, kit.uow, kit.clock);
        list = new ListWorkspaceModulesUseCase(kit.roles, kit.states);
        flags = new RepositoryModuleFlags(kit.states);
    });

    async function grant(ws: ReturnType<PlatformTestKit['seedWorkspace']>['workspaceId'], module: ModuleId): Promise<void> {
        await kit.entitlements.save(WorkspaceEntitlement.rehydrate({
            workspaceId: ws, module, status: 'purchased', startsAt: kit.clock.now(), expiresAt: null, trialUsedAt: null,
            grantedBy: null, note: '', updatedAt: kit.clock.now(),
        }));
    }

    it('an ERP module without a grant is not active even when switched on; legacy modules work as before', async () => {
        const s = kit.seedWorkspace();
        const r = await set.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'project-hub', enabled: true });
        expect(errorOf(r)).toMatchObject({ code: 'unprocessable', details: { reason: 'not_entitled' } });
        valueOf(await set.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'workforce', enabled: true }));
        expect(await flags.isEnabled(s.workspaceId, 'workforce')).toBe(true);
        expect(await flags.isEnabled(s.workspaceId, 'project-hub')).toBe(false);
        const views = valueOf(await list.execute({ actorId: s.byRole.viewer, workspaceId: s.workspaceId }));
        expect(views.find(v => v.module === 'project-hub')).toMatchObject({
            available: true, enabled: false, active: false, entitlement: { status: 'none', expiresAt: null }, trialAvailable: true,
        });
        expect(views.find(v => v.module === 'workforce')).toMatchObject({
            active: true, entitlement: { status: 'not_required' }, trialAvailable: false, missingDependencies: [],
        });
    });

    it('switching on with an inactive dependency is 422 missing_dependencies', async () => {
        const s = kit.seedWorkspace();
        for (const m of ['project-hub', 'boq-control', 'site-diary', 'labour'] as const) await grant(s.workspaceId, m);
        const r = await set.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'labour', enabled: true });
        expect(errorOf(r)).toMatchObject({
            code: 'unprocessable', details: { reason: 'missing_dependencies', missing: ['project-hub', 'boq-control', 'site-diary', 'workforce'] },
        });
    });

    it('the first trial grants 30 days, switches on and brings dependencies along; the second is 409 trial_used', async () => {
        const s = kit.seedWorkspace();
        await grant(s.workspaceId, 'project-hub');
        const out = valueOf(await trial.execute({ actorId: s.byRole.admin, workspaceId: s.workspaceId, module: 'billing' }));
        expect(out.started).toEqual(['boq-control', 'contracts', 'billing']);
        expect(out.module).toMatchObject({
            module: 'billing', enabled: true, active: true, trialAvailable: false, missingDependencies: [],
            entitlement: { status: 'trial', expiresAt: new Date(kit.clock.now().getTime() + 30 * DAY_MS) },
        });
        const stored = (await kit.entitlements.find(s.workspaceId, 'billing'))?.toProps();
        expect(stored).toMatchObject({ status: 'trial', trialUsedAt: kit.clock.now(), grantedBy: null });
        // project-hub already had a grant: it stays purchased (no trial used).
        expect((await kit.entitlements.find(s.workspaceId, 'project-hub'))?.toProps()).toMatchObject({ status: 'purchased', trialUsedAt: null });
        for (const m of ['project-hub', 'boq-control', 'contracts', 'billing'] as const) expect(await flags.isEnabled(s.workspaceId, m)).toBe(true);

        const again = await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'billing' });
        expect(errorOf(again)).toMatchObject({ code: 'conflict', details: { reason: 'trial_used' } });
        const dependency = await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'contracts' });
        expect(errorOf(dependency)).toMatchObject({ code: 'conflict', details: { reason: 'trial_used' } });
        const purchased = await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'project-hub' });
        expect(errorOf(purchased)).toMatchObject({ code: 'conflict', details: { reason: 'already_entitled' } });
    });

    it('a trial ends by itself: after 30 days the module is inactive and reads expired', async () => {
        const s = kit.seedWorkspace();
        valueOf(await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'project-hub' }));
        expect(await flags.isEnabled(s.workspaceId, 'project-hub')).toBe(true);
        kit.clock.advance(30 * DAY_MS);
        expect(await flags.isEnabled(s.workspaceId, 'project-hub')).toBe(false);
        const views = valueOf(await list.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId }));
        expect(views.find(v => v.module === 'project-hub')).toMatchObject({ enabled: true, active: false, trialAvailable: false, entitlement: { status: 'expired' } });
    });

    it('refuses: not offered (422), no trial (422), a dependency whose own trial is used (422), estimator (403), outsider (404)', async () => {
        const narrow = new PlatformTestKit(['project-hub'], 'enforce');
        const t2 = new StartTrialUseCase(narrow.roles, narrow.states, narrow.modules, narrow.entitlements, narrow.uow, narrow.clock);
        const n = narrow.seedWorkspace();
        expect(outcome(await t2.execute({ actorId: n.byRole.owner, workspaceId: n.workspaceId, module: 'portal' }))).toBe('unprocessable');

        const s = kit.seedWorkspace();
        expect(errorOf(await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'workforce' })))
            .toMatchObject({ code: 'unprocessable', details: { reason: 'no_trial' } });
        valueOf(await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'project-hub' }));
        kit.clock.advance(31 * DAY_MS);
        expect(errorOf(await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'portal' })))
            .toMatchObject({ code: 'unprocessable', details: { reason: 'missing_dependencies', missing: ['project-hub'] } });
        expect(outcome(await trial.execute({ actorId: s.byRole.estimator, workspaceId: s.workspaceId, module: 'portal' }))).toBe('forbidden');
        expect(outcome(await trial.execute({ actorId: s.outsider, workspaceId: s.workspaceId, module: 'portal' }))).toBe('not_found');
    });

    it('switching off a module with switched-on dependents needs confirm (409 has_dependents), then cascades', async () => {
        const s = kit.seedWorkspace();
        valueOf(await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'billing' }));
        valueOf(await trial.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'quotations' }));
        kit.usage.setWork(s.workspaceId, 'billing', { openInvoices: 2 });
        const blocked = await set.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'boq-control', enabled: false });
        expect(errorOf(blocked)).toMatchObject({
            code: 'conflict', details: { reason: 'has_dependents', dependents: ['quotations', 'contracts', 'billing'], work: { openInvoices: 2 } },
        });
        expect((errorOf(blocked).details as Record<string, unknown>).activeSubcontracts).toBeUndefined();
        const view = valueOf(await set.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'boq-control', enabled: false, confirm: true }));
        expect(view).toMatchObject({ enabled: false, active: false });
        for (const m of ['boq-control', 'quotations', 'contracts', 'billing'] as const) expect(await flags.isEnabled(s.workspaceId, m)).toBe(false);
        expect(await flags.isEnabled(s.workspaceId, 'project-hub')).toBe(true);
        // Switching back on does not bring the dependents back.
        valueOf(await set.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'boq-control', enabled: true }));
        expect(await flags.isEnabled(s.workspaceId, 'billing')).toBe(false);
    });
});
