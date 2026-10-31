import { RepositoryModuleFlags } from '../../infrastructure/adapters/module-flags.adapter';
import { PlatformTestKit, errorOf, outcome, valueOf } from '../../testing/platform-test-kit';
import { SetWorkspaceModuleUseCase } from './set-workspace-module.use-case';

describe('SetWorkspaceModuleUseCase', () => {
    let kit: PlatformTestKit;
    let useCase: SetWorkspaceModuleUseCase;
    let flags: RepositoryModuleFlags;

    beforeEach(() => {
        kit = new PlatformTestKit(['subcontracting']);
        useCase = new SetWorkspaceModuleUseCase(kit.roles, kit.states, kit.modules, kit.work, kit.uow, kit.clock);
        flags = new RepositoryModuleFlags(kit.states);
    });

    it.each(['owner', 'admin'] as const)('a %s switches a module on (records who and when)', async role => {
        const s = kit.seedWorkspace();
        const view = valueOf(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId, module: 'subcontracting', enabled: true }));
        expect(view).toMatchObject({ module: 'subcontracting', available: true, enabled: true, enabledAt: kit.clock.now(), active: true });
        const stored = await kit.modules.find(s.workspaceId, 'subcontracting');
        expect(stored?.toProps()).toMatchObject({ enabled: true, enabledBy: s.byRole[role] });
    });

    it.each(['estimator', 'viewer'] as const)('a %s may not switch modules (forbidden)', async role => {
        const s = kit.seedWorkspace();
        const r = await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId, module: 'subcontracting', enabled: true });
        expect(outcome(r)).toBe('forbidden');
        expect(await kit.modules.find(s.workspaceId, 'subcontracting')).toBeUndefined();
    });

    it('a non-member gets not_found', async () => {
        const s = kit.seedWorkspace();
        const r = await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId, module: 'subcontracting', enabled: true });
        expect(outcome(r)).toBe('not_found');
        // Membership is checked before anything else: a stranger learns nothing about what the server offers.
        const other = await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId, module: 'materials', enabled: true });
        expect(outcome(other)).toBe('not_found');
    });

    it('a module the platform does not offer is unprocessable (on and off)', async () => {
        const s = kit.seedWorkspace();
        const on = await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'materials', enabled: true });
        expect(errorOf(on)).toMatchObject({ code: 'unprocessable', details: { module: 'materials' } });
        const off = await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'materials', enabled: false });
        expect(outcome(off)).toBe('unprocessable');
    });

    it('switching off with running contracts needs confirm (409 with the count)', async () => {
        const s = kit.seedWorkspace();
        valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: true }));
        kit.usage.set(s.workspaceId, 'subcontracting', 3);
        const r = await useCase.execute({ actorId: s.byRole.admin, workspaceId: s.workspaceId, module: 'subcontracting', enabled: false });
        expect(errorOf(r)).toMatchObject({ code: 'conflict', details: { activeSubcontracts: 3 } });
        expect(await flags.isEnabled(s.workspaceId, 'subcontracting')).toBe(true);
    });

    it('switching off with confirm keeps the data and reports enabledAt null', async () => {
        const s = kit.seedWorkspace();
        valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: true }));
        const switchedOnAt = kit.clock.now();
        kit.usage.set(s.workspaceId, 'subcontracting', 2);
        kit.clock.advance(60_000);
        const view = valueOf(await useCase.execute({
            actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: false, confirm: true,
        }));
        expect(view).toMatchObject({ module: 'subcontracting', available: true, enabled: false, enabledAt: null, active: false });
        const stored = (await kit.modules.find(s.workspaceId, 'subcontracting'))?.toProps();
        expect(stored).toMatchObject({ enabled: false, enabledAt: switchedOnAt });
    });

    it('switching off without running work needs no confirm', async () => {
        const s = kit.seedWorkspace();
        valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: true }));
        const view = valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: false }));
        expect(view.enabled).toBe(false);
        expect(kit.usage.calls).toBe(1);
    });

    it('switching off a module that is already off does not ask for running work', async () => {
        const s = kit.seedWorkspace();
        kit.usage.set(s.workspaceId, 'subcontracting', 5);
        const view = valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: false }));
        expect(view.enabled).toBe(false);
        expect(kit.usage.calls).toBe(0);
    });

    it('switching on again records the new time', async () => {
        const s = kit.seedWorkspace();
        valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: true }));
        valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: false }));
        kit.clock.advance(3_600_000);
        const view = valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: true }));
        expect(view.enabledAt).toEqual(kit.clock.now());
    });

    it('ModuleFlags on the same instance sees the switch at once (even with a cached value)', async () => {
        const s = kit.seedWorkspace();
        expect(await flags.isEnabled(s.workspaceId, 'subcontracting')).toBe(false);
        valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: true }));
        expect(await flags.isEnabled(s.workspaceId, 'subcontracting')).toBe(true);
        valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId, module: 'subcontracting', enabled: false }));
        expect(await flags.isEnabled(s.workspaceId, 'subcontracting')).toBe(false);
    });

    it('a switch in one workspace does not touch another', async () => {
        const a = kit.seedWorkspace();
        const b = kit.seedWorkspace();
        valueOf(await useCase.execute({ actorId: a.byRole.owner, workspaceId: a.workspaceId, module: 'subcontracting', enabled: true }));
        expect(await flags.isEnabled(b.workspaceId, 'subcontracting')).toBe(false);
        const r = await useCase.execute({ actorId: a.byRole.owner, workspaceId: b.workspaceId, module: 'subcontracting', enabled: true });
        expect(outcome(r)).toBe('not_found');
    });
});
