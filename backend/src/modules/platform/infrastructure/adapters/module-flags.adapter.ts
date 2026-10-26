// ─── Shared port ModuleFlags: platform list (env) AND the workspace's switch (cached briefly) ───
import { Injectable } from '@nestjs/common';
import type { ModuleId } from '@contrack/contract';
import { ModuleFlags } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { PlatformSettings } from '../../application/ports/platform-settings.port';
import { WorkspaceModuleRepository } from '../../application/ports/workspace-module.repository';
import { ModuleFlagCache } from '../../application/services/module-flag-cache';

@Injectable()
export class RepositoryModuleFlags extends ModuleFlags {
    private readonly offered: ReadonlySet<ModuleId>;

    constructor(
        settings: PlatformSettings,
        private readonly modules: WorkspaceModuleRepository,
        private readonly cache: ModuleFlagCache,
    ) {
        super();
        this.offered = new Set(settings.modulesEnabled);
    }

    platformEnabled(module: ModuleId): boolean {
        return this.offered.has(module);
    }

    async isEnabled(workspaceId: WorkspaceId, module: ModuleId): Promise<boolean> {
        if (!this.offered.has(module)) return false;
        const cached = this.cache.get(workspaceId, module);
        if (cached !== undefined) return cached;
        const entry = await this.modules.find(workspaceId, module);
        const enabled = entry?.enabled ?? false;
        this.cache.set(workspaceId, module, enabled);
        return enabled;
    }
}
