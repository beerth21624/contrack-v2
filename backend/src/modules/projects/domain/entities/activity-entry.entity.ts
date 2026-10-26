// ─── ActivityEntry: one line of a project's activity feed (append-only; ids grow, used as paging cursor) ───
import type { ActivityAction } from '@contrack/contract';
import type { DocKey } from '@contrack/domain/sync';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain';

export interface NewActivity {
    readonly workspaceId: WorkspaceId;
    readonly projectId: ProjectId;
    readonly userId: UserId;
    readonly action: ActivityAction;
    readonly docKey: DocKey | null;
    readonly at: Date;
}

export interface ActivityEntryProps extends NewActivity {
    readonly id: bigint;
}

export class ActivityEntry {
    private constructor(private readonly props: ActivityEntryProps) {}

    /** What to append (the repository gives it its id). */
    static record(input: Omit<NewActivity, 'docKey'> & { docKey?: DocKey | null }): NewActivity {
        return { ...input, docKey: input.docKey ?? null, at: new Date(input.at.getTime()) };
    }

    static rehydrate(props: ActivityEntryProps): ActivityEntry {
        if (props.id < 1n) throw new Error(`activity id must be ≥ 1, got ${props.id.toString()}`);
        return new ActivityEntry({ ...props, at: new Date(props.at.getTime()) });
    }

    get id(): bigint { return this.props.id; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get projectId(): ProjectId { return this.props.projectId; }
    get userId(): UserId { return this.props.userId; }
    get action(): ActivityAction { return this.props.action; }
    get docKey(): DocKey | null { return this.props.docKey; }
    get at(): Date { return new Date(this.props.at.getTime()); }
}
