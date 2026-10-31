// ─── WorkspaceEntitlement: what a workspace may use of one module that needs an entitlement (layer 2) ───
import type { EntitlementGrantStatus, ModuleId } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';

const DAY_MS = 86_400_000;

export interface WorkspaceEntitlementProps {
    workspaceId: WorkspaceId;
    module: ModuleId;
    status: EntitlementGrantStatus;
    startsAt: Date;
    /** null = no end. */
    expiresAt: Date | null;
    /** When the workspace started its one trial of this module (never cleared). */
    trialUsedAt: Date | null;
    /** The platform admin who granted it; null for a self-started trial. */
    grantedBy: UserId | null;
    note: string;
    updatedAt: Date;
}

const copyDate = (d: Date | null): Date | null => (d === null ? null : new Date(d.getTime()));

export class WorkspaceEntitlement {
    private constructor(private props: WorkspaceEntitlementProps) {}

    static rehydrate(props: WorkspaceEntitlementProps): WorkspaceEntitlement {
        return new WorkspaceEntitlement(WorkspaceEntitlement.copy(props));
    }

    /** A first-ever trial of `days` days starting `now`. */
    static trial(workspaceId: WorkspaceId, module: ModuleId, days: number, now: Date): WorkspaceEntitlement {
        return new WorkspaceEntitlement({
            workspaceId, module, status: 'trial', startsAt: now, expiresAt: null, trialUsedAt: null, grantedBy: null, note: '', updatedAt: now,
        }).withTrial(days, now);
    }

    private static copy(p: WorkspaceEntitlementProps): WorkspaceEntitlementProps {
        return {
            ...p,
            startsAt: new Date(p.startsAt.getTime()),
            expiresAt: copyDate(p.expiresAt),
            trialUsedAt: copyDate(p.trialUsedAt),
            updatedAt: new Date(p.updatedAt.getTime()),
        };
    }

    get workspaceId(): WorkspaceId {
        return this.props.workspaceId;
    }

    get module(): ModuleId {
        return this.props.module;
    }

    get status(): EntitlementGrantStatus {
        return this.props.status;
    }

    get expiresAt(): Date | null {
        return copyDate(this.props.expiresAt);
    }

    get trialUsedAt(): Date | null {
        return copyDate(this.props.trialUsedAt);
    }

    get note(): string {
        return this.props.note;
    }

    get updatedAt(): Date {
        return new Date(this.props.updatedAt.getTime());
    }

    /**
     * A platform admin sets the grant (replaces status, end and note). `trialUsedAt` is never cleared; an admin-granted
     * trial counts as the workspace's trial (set when still empty), so it cannot start another one after it ends.
     */
    grant(status: EntitlementGrantStatus, expiresAt: Date | null, by: UserId, note: string, now: Date): void {
        this.props = {
            ...this.props,
            status,
            startsAt: new Date(now.getTime()),
            expiresAt: copyDate(expiresAt),
            trialUsedAt: status === 'trial' && this.props.trialUsedAt === null ? new Date(now.getTime()) : this.props.trialUsedAt,
            grantedBy: by,
            note,
            updatedAt: new Date(now.getTime()),
        };
    }

    /** A grant that never existed before, set by a platform admin (no trial used yet). */
    static granted(
        workspaceId: WorkspaceId, module: ModuleId, status: EntitlementGrantStatus, expiresAt: Date | null, by: UserId, note: string, now: Date,
    ): WorkspaceEntitlement {
        const entity = new WorkspaceEntitlement({
            workspaceId, module, status, startsAt: now, expiresAt: null, trialUsedAt: null, grantedBy: by, note: '', updatedAt: now,
        });
        entity.grant(status, expiresAt, by, note, now);
        return entity;
    }

    /** Starts the one trial of this module on an existing row (the caller checked `trialUsedAt` is null). */
    startTrial(days: number, now: Date): void {
        this.withTrial(days, now);
    }

    private withTrial(days: number, now: Date): this {
        this.props = {
            ...this.props,
            status: 'trial',
            startsAt: new Date(now.getTime()),
            expiresAt: new Date(now.getTime() + days * DAY_MS),
            trialUsedAt: new Date(now.getTime()),
            grantedBy: null,
            updatedAt: new Date(now.getTime()),
        };
        return this;
    }

    toProps(): WorkspaceEntitlementProps {
        return WorkspaceEntitlement.copy(this.props);
    }
}
