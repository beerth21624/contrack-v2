// ─── LevelAssignment: which member is responsible for one journey level of a project ───
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain';
import type { LevelId } from '../value-objects/level-id.value-object';

export interface LevelAssignmentProps {
    projectId: ProjectId;
    workspaceId: WorkspaceId;
    levelId: string;
    userId: UserId;
    assignedBy: UserId;
    assignedAt: Date;
}

export interface AssignLevelProps {
    projectId: ProjectId;
    workspaceId: WorkspaceId;
    levelId: LevelId;
    userId: UserId;
    assignedBy: UserId;
    now: Date;
}

export class LevelAssignment {
    private constructor(private readonly props: LevelAssignmentProps) {}

    static assign(input: AssignLevelProps): LevelAssignment {
        return new LevelAssignment({
            projectId: input.projectId,
            workspaceId: input.workspaceId,
            levelId: input.levelId.value,
            userId: input.userId,
            assignedBy: input.assignedBy,
            assignedAt: new Date(input.now.getTime()),
        });
    }

    static rehydrate(props: LevelAssignmentProps): LevelAssignment {
        return new LevelAssignment({ ...props, assignedAt: new Date(props.assignedAt.getTime()) });
    }

    get projectId(): ProjectId { return this.props.projectId; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get levelId(): string { return this.props.levelId; }
    get userId(): UserId { return this.props.userId; }
    get assignedBy(): UserId { return this.props.assignedBy; }
    get assignedAt(): Date { return new Date(this.props.assignedAt.getTime()); }

    toProps(): LevelAssignmentProps {
        return { ...this.props, assignedAt: this.assignedAt };
    }
}
