// ─── Loads the flag rows of a workspace and turns them into module states (domain/module-activation.ts) ───
import { Injectable } from '@nestjs/common';
import type { ModuleId } from '@contrack/contract';
import { Clock } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import type { WorkspaceEntitlement } from '../../domain/entities/workspace-entitlement.entity';
import type { WorkspaceModule } from '../../domain/entities/workspace-module.entity';
import type { GrantState, ModuleFlagInputs } from '../../domain/module-activation';
import { PlatformSettings } from '../ports/platform-settings.port';
import { WorkspaceEntitlementRepository } from '../ports/workspace-entitlement.repository';
import { WorkspaceModuleRepository } from '../ports/workspace-module.repository';
import { ModuleFlagCache, type WorkspaceFlagRows } from './module-flag-cache';

/** The stored rows of one workspace, as entities (for use cases that change them). */
export interface WorkspaceModuleRows {
    switches: Map<ModuleId, WorkspaceModule>;
    grants: Map<ModuleId, WorkspaceEntitlement>;
}

const grantState = (g: WorkspaceEntitlement): GrantState => ({ status: g.status, expiresAt: g.expiresAt, trialUsedAt: g.trialUsedAt });

@Injectable()
export class WorkspaceModuleStates {
    private readonly released: ReadonlySet<ModuleId>;

    constructor(
        private readonly settings: PlatformSettings,
        private readonly modules: WorkspaceModuleRepository,
        private readonly entitlements: WorkspaceEntitlementRepository,
        private readonly cache: ModuleFlagCache,
        private readonly clock: Clock,
    ) {
        this.released = new Set(settings.modulesEnabled);
    }

    isReleased(module: ModuleId): boolean {
        return this.released.has(module);
    }

    /** Fresh rows (joins the current transaction). */
    async load(workspaceId: WorkspaceId): Promise<WorkspaceModuleRows> {
        const [switches, grants] = await Promise.all([
            this.modules.listByWorkspace(workspaceId),
            this.entitlements.listByWorkspace(workspaceId),
        ]);
        return {
            switches: new Map(switches.map(s => [s.module, s])),
            grants: new Map(grants.map(g => [g.module, g])),
        };
    }

    /** Flag inputs of rows (as they are now, e.g. after a change not saved yet). */
    inputsOf(rows: WorkspaceModuleRows): ModuleFlagInputs {
        return this.inputs({
            toggled: new Set([...rows.switches.values()].filter(s => s.enabled).map(s => s.module)),
            grants: new Map([...rows.grants.entries()].map(([m, g]) => [m, grantState(g)])),
        });
    }

    /** Flag inputs from the short-lived cache (ModuleFlags). */
    async cachedInputs(workspaceId: WorkspaceId): Promise<ModuleFlagInputs> {
        const hit = this.cache.get(workspaceId);
        if (hit !== undefined) return this.inputs(hit);
        const inputs = this.inputsOf(await this.load(workspaceId));
        this.cache.set(workspaceId, { toggled: inputs.toggled, grants: inputs.grants });
        return inputs;
    }

    /** After a change of the workspace's switches or grants committed. */
    invalidate(workspaceId: WorkspaceId): void {
        this.cache.invalidate(workspaceId);
    }

    private inputs(rows: WorkspaceFlagRows): ModuleFlagInputs {
        return { released: this.released, mode: this.settings.entitlements, now: this.clock.now(), ...rows };
    }
}
