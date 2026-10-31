import { MODULE_IDS } from '@contrack/contract';
import { WorkspaceModule } from '../../domain/entities/workspace-module.entity';
import { PlatformTestKit, ROLES_UNDER_TEST, outcome, valueOf } from '../../testing/platform-test-kit';
import { ListWorkspaceModulesUseCase } from './list-workspace-modules.use-case';

describe('ListWorkspaceModulesUseCase', () => {
    let kit: PlatformTestKit;
    let useCase: ListWorkspaceModulesUseCase;

    beforeEach(() => {
        kit = new PlatformTestKit(['subcontracting', 'materials']);
        useCase = new ListWorkspaceModulesUseCase(kit.roles, kit.states);
    });

    it.each(ROLES_UNDER_TEST)('a %s sees every module id in MODULE_IDS order', async role => {
        const s = kit.seedWorkspace();
        const views = valueOf(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId }));
        expect(views.map(v => v.module)).toEqual([...MODULE_IDS]);
        expect(views.map(v => v.available)).toEqual(MODULE_IDS.map(m => m === 'subcontracting' || m === 'materials'));
        expect(views.every(v => !v.enabled && v.enabledAt === null)).toBe(true);
    });

    it('shows what the workspace switched on', async () => {
        const s = kit.seedWorkspace();
        const entry = WorkspaceModule.initial(s.workspaceId, 'subcontracting');
        entry.switch(true, s.byRole.owner, kit.clock.now());
        await kit.modules.save(entry);
        const views = valueOf(await useCase.execute({ actorId: s.byRole.viewer, workspaceId: s.workspaceId }));
        expect(views[0]).toEqual({
            module: 'subcontracting', available: true, enabled: true, enabledAt: kit.clock.now(),
            entitlement: { status: 'not_required', expiresAt: null }, active: true, missingDependencies: [], trialAvailable: false,
        });
    });

    it('a module switched on earlier but no longer offered by the platform reads as off', async () => {
        const s = kit.seedWorkspace();
        const entry = WorkspaceModule.initial(s.workspaceId, 'owner-leads');
        entry.switch(true, s.byRole.owner, kit.clock.now());
        await kit.modules.save(entry);
        const views = valueOf(await useCase.execute({ actorId: s.byRole.owner, workspaceId: s.workspaceId }));
        expect(views[2]).toMatchObject({ module: 'owner-leads', available: false, enabled: false, enabledAt: null, active: false });
    });

    it('a non-member gets not_found', async () => {
        const s = kit.seedWorkspace();
        expect(outcome(await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId }))).toBe('not_found');
    });
});
