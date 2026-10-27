// ─── Crew assignment: a crew on one planned task of a project, first to last day inclusive ───
// Overlapping assignments of the same crew are allowed (the UI warns; W2's board detects the conflicts).
import type { CrewAssignmentId, CrewId, ProjectId, UserId, WorkspaceId } from '../../../../shared/domain';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

export interface CrewAssignmentProps {
    id: CrewAssignmentId;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    /** S-Curve task "1.1" … "8.6". */
    taskId: string;
    crewId: CrewId;
    /** 'YYYY-MM-DD', start ≤ end. */
    start: string;
    end: string;
    note: string | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** The fields an update may change (undefined = keep; note null = clear). */
export interface CrewAssignmentChanges {
    crewId?: CrewId;
    start?: string;
    end?: string;
    note?: string | null;
}

const copyDate = (d: Date): Date => new Date(d.getTime());

export class CrewAssignment {
    private constructor(private props: CrewAssignmentProps) {}

    static create(input: Omit<CrewAssignmentProps, 'createdAt' | 'updatedAt'> & { now: Date }): Result<CrewAssignment, DomainError> {
        const { now, ...rest } = input;
        if (rest.start > rest.end) return err(DomainError.validation('The start comes after the end'));
        return ok(new CrewAssignment({ ...rest, createdAt: copyDate(now), updatedAt: copyDate(now) }));
    }

    static rehydrate(props: CrewAssignmentProps): CrewAssignment {
        return new CrewAssignment({ ...props, createdAt: copyDate(props.createdAt), updatedAt: copyDate(props.updatedAt) });
    }

    get id(): CrewAssignmentId { return this.props.id; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get projectId(): ProjectId { return this.props.projectId; }
    get taskId(): string { return this.props.taskId; }
    get crewId(): CrewId { return this.props.crewId; }
    get start(): string { return this.props.start; }
    get end(): string { return this.props.end; }
    get note(): string | null { return this.props.note; }
    get createdBy(): UserId { return this.props.createdBy; }
    get createdAt(): Date { return copyDate(this.props.createdAt); }
    get updatedAt(): Date { return copyDate(this.props.updatedAt); }

    /** Applies the changes (the resulting range must keep start ≤ end); ok(false) when nothing changed. */
    update(changes: CrewAssignmentChanges, now: Date): Result<boolean, DomainError> {
        const next: CrewAssignmentProps = {
            ...this.props,
            crewId: changes.crewId ?? this.props.crewId,
            start: changes.start ?? this.props.start,
            end: changes.end ?? this.props.end,
            note: changes.note === undefined ? this.props.note : changes.note,
        };
        if (next.start > next.end) return err(DomainError.validation('The start comes after the end'));
        const changed = next.crewId !== this.props.crewId || next.start !== this.props.start || next.end !== this.props.end
            || next.note !== this.props.note;
        if (changed) this.props = { ...next, updatedAt: copyDate(now) };
        return ok(changed);
    }

    toProps(): CrewAssignmentProps {
        return { ...this.props, createdAt: this.createdAt, updatedAt: this.updatedAt };
    }
}
