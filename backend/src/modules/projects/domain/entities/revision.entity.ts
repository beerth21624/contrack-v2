// ─── Revision: an immutable snapshot of a project (the assembled Project and its totals) ───
import type { Project as BoqProject } from '@contrack/domain/project';
import type { ProjectId, RevisionId, UserId, WorkspaceId } from '../../../../shared/domain';
import type { RevisionLabel } from '../value-objects/revision-label.value-object';
import type { ProjectSummary } from './project.entity';

export interface RevisionProps {
    id: RevisionId;
    projectId: ProjectId;
    workspaceId: WorkspaceId;
    label: string;
    note: string | null;
    /** The whole project as it was (the frontend Project shape, JSON only). */
    snapshot: BoqProject;
    totals: ProjectSummary;
    createdBy: UserId;
    createdAt: Date;
}

export interface CreateRevisionProps {
    id: RevisionId;
    projectId: ProjectId;
    workspaceId: WorkspaceId;
    label: RevisionLabel;
    note: string | null;
    snapshot: BoqProject;
    totals: ProjectSummary;
    createdBy: UserId;
    now: Date;
}

export class Revision {
    private constructor(private readonly props: RevisionProps) {}

    static create(input: CreateRevisionProps): Revision {
        return new Revision({
            id: input.id,
            projectId: input.projectId,
            workspaceId: input.workspaceId,
            label: input.label.value,
            note: input.note,
            snapshot: input.snapshot,
            totals: { ...input.totals },
            createdBy: input.createdBy,
            createdAt: new Date(input.now.getTime()),
        });
    }

    static rehydrate(props: RevisionProps): Revision {
        return new Revision({ ...props, totals: { ...props.totals }, createdAt: new Date(props.createdAt.getTime()) });
    }

    get id(): RevisionId { return this.props.id; }
    get projectId(): ProjectId { return this.props.projectId; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get label(): string { return this.props.label; }
    get note(): string | null { return this.props.note; }
    get snapshot(): BoqProject { return this.props.snapshot; }
    get totals(): ProjectSummary { return { ...this.props.totals }; }
    get createdBy(): UserId { return this.props.createdBy; }
    get createdAt(): Date { return new Date(this.props.createdAt.getTime()); }

    toProps(): RevisionProps {
        return { ...this.props, totals: this.totals, createdAt: this.createdAt };
    }
}
