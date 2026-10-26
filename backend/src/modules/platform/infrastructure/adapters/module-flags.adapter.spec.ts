import { PlatformSettings } from '../../application/ports/platform-settings.port';
import { MODULE_FLAG_CACHE_MS } from '../../application/services/module-flag-cache';
import { WorkspaceModule } from '../../domain/entities/workspace-module.entity';
import { PlatformTestKit } from '../../testing/platform-test-kit';
import { RepositoryModuleFlags } from './module-flags.adapter';

describe('RepositoryModuleFlags', () => {
    let kit: PlatformTestKit;
    let flags: RepositoryModuleFlags;

    beforeEach(() => {
        kit = new PlatformTestKit(['subcontracting']);
        flags = new RepositoryModuleFlags(kit.settings, kit.modules, kit.cache);
    });

    async function switchDirectly(enabled: boolean): Promise<ReturnType<PlatformTestKit['seedWorkspace']>> {
        const s = kit.seedWorkspace();
        const entry = WorkspaceModule.initial(s.workspaceId, 'subcontracting');
        entry.switch(enabled, s.byRole.owner, kit.clock.now());
        await kit.modules.save(entry);
        return s;
    }

    it('platformEnabled follows the env list', () => {
        expect(flags.platformEnabled('subcontracting')).toBe(true);
        expect(flags.platformEnabled('materials')).toBe(false);
    });

    it('isEnabled needs the platform AND the workspace switch', async () => {
        const s = await switchDirectly(true);
        expect(await flags.isEnabled(s.workspaceId, 'subcontracting')).toBe(true);
        expect(await flags.isEnabled(s.workspaceId, 'materials')).toBe(false);
        expect(await flags.isEnabled(kit.newWorkspaceId(), 'subcontracting')).toBe(false);
    });

    it('the platform switch wins over a workspace row', async () => {
        const s = await switchDirectly(true);
        const off = new RepositoryModuleFlags(new PlatformSettings([], 'https://app.test'), kit.modules, kit.cache);
        expect(await off.isEnabled(s.workspaceId, 'subcontracting')).toBe(false);
    });

    it('a change made elsewhere (another instance) shows after the cache time', async () => {
        const s = await switchDirectly(false);
        expect(await flags.isEnabled(s.workspaceId, 'subcontracting')).toBe(false);
        const entry = WorkspaceModule.initial(s.workspaceId, 'subcontracting');
        entry.switch(true, s.byRole.owner, kit.clock.now());
        await kit.modules.save(entry);
        expect(await flags.isEnabled(s.workspaceId, 'subcontracting')).toBe(false);
        kit.clock.advance(MODULE_FLAG_CACHE_MS);
        expect(await flags.isEnabled(s.workspaceId, 'subcontracting')).toBe(true);
    });
});
