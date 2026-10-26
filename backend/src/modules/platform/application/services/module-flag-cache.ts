// ─── Short-lived cache of workspace module switches (ModuleFlags.isEnabled runs on every module request) ───
import { Injectable } from '@nestjs/common';
import type { ModuleId } from '@contrack/contract';
import { Clock } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';

/** Another server instance sees a switch after at most this long; the instance that switched sees it at once. */
export const MODULE_FLAG_CACHE_MS = 10_000;

@Injectable()
export class ModuleFlagCache {
    private readonly entries = new Map<string, { enabled: boolean; until: number }>();

    constructor(private readonly clock: Clock) {}

    get(workspaceId: WorkspaceId, module: ModuleId): boolean | undefined {
        const key = `${workspaceId}|${module}`;
        const hit = this.entries.get(key);
        if (hit === undefined) return undefined;
        if (hit.until <= this.clock.now().getTime()) {
            this.entries.delete(key);
            return undefined;
        }
        return hit.enabled;
    }

    set(workspaceId: WorkspaceId, module: ModuleId, enabled: boolean): void {
        if (this.entries.size > 10_000) this.entries.clear();
        this.entries.set(`${workspaceId}|${module}`, { enabled, until: this.clock.now().getTime() + MODULE_FLAG_CACHE_MS });
    }
}
