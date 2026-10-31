// ─── Short-lived cache of the flag rows of a workspace (ModuleFlags.isEnabled runs on every module request) ───
// Holds the workspace's switches (layer 3) and entitlement grants (layer 2) together; `active` is computed from them
// on every read, so a grant that expires stops counting at once even while cached.
import { Injectable } from '@nestjs/common';
import type { ModuleId } from '@contrack/contract';
import { Clock } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import type { GrantState } from '../../domain/module-activation';

/** Another server instance sees a switch / grant after at most this long; the instance that changed it sees it at once. */
export const MODULE_FLAG_CACHE_MS = 10_000;

export interface WorkspaceFlagRows {
    /** Modules the workspace switched on. */
    toggled: ReadonlySet<ModuleId>;
    grants: ReadonlyMap<ModuleId, GrantState>;
}

@Injectable()
export class ModuleFlagCache {
    private readonly entries = new Map<WorkspaceId, { rows: WorkspaceFlagRows; until: number }>();

    constructor(private readonly clock: Clock) {}

    get(workspaceId: WorkspaceId): WorkspaceFlagRows | undefined {
        const hit = this.entries.get(workspaceId);
        if (hit === undefined) return undefined;
        if (hit.until <= this.clock.now().getTime()) {
            this.entries.delete(workspaceId);
            return undefined;
        }
        return hit.rows;
    }

    set(workspaceId: WorkspaceId, rows: WorkspaceFlagRows): void {
        if (this.entries.size > 10_000) this.entries.clear();
        this.entries.set(workspaceId, { rows, until: this.clock.now().getTime() + MODULE_FLAG_CACHE_MS });
    }

    /** Call after a switch or a grant of the workspace changed (after the transaction committed). */
    invalidate(workspaceId: WorkspaceId): void {
        this.entries.delete(workspaceId);
    }
}
