// ─── WorkspaceModule: one business module switched on/off for one workspace ───
import type { ModuleId } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';

export interface WorkspaceModuleProps {
    workspaceId: WorkspaceId;
    module: ModuleId;
    enabled: boolean;
    settings: Record<string, unknown>;
    /** Who last switched it. */
    enabledBy: UserId | null;
    /** When it was last switched on (kept while off). */
    enabledAt: Date | null;
}

export class WorkspaceModule {
    private constructor(private props: WorkspaceModuleProps) {}

    /** A module the workspace never switched (off). */
    static initial(workspaceId: WorkspaceId, module: ModuleId): WorkspaceModule {
        return new WorkspaceModule({ workspaceId, module, enabled: false, settings: {}, enabledBy: null, enabledAt: null });
    }

    static rehydrate(props: WorkspaceModuleProps): WorkspaceModule {
        return new WorkspaceModule({ ...props, settings: { ...props.settings } });
    }

    get workspaceId(): WorkspaceId {
        return this.props.workspaceId;
    }

    get module(): ModuleId {
        return this.props.module;
    }

    get enabled(): boolean {
        return this.props.enabled;
    }

    get enabledAt(): Date | null {
        return this.props.enabledAt === null ? null : new Date(this.props.enabledAt.getTime());
    }

    /** Switches on or off. Switching on again records the new time; switching off keeps the data (and the time). */
    switch(enabled: boolean, by: UserId, now: Date): void {
        if (enabled === this.props.enabled) return;
        this.props = {
            ...this.props,
            enabled,
            enabledBy: by,
            enabledAt: enabled ? new Date(now.getTime()) : this.props.enabledAt,
        };
    }

    toProps(): WorkspaceModuleProps {
        return { ...this.props, settings: { ...this.props.settings }, enabledAt: this.enabledAt };
    }
}
