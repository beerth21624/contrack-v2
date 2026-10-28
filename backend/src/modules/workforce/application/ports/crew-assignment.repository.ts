import type { CrewAssignmentId, CrewId, ProjectId, WorkspaceId } from '../../../../shared/domain';
import type { CrewAssignment } from '../../domain/entities/crew-assignment.entity';

export interface CrewAssignmentFilter {
    projectId?: ProjectId;
    crewId?: CrewId;
    /** Keeps the assignments whose range overlaps [from, to] (either end may be open). */
    from?: string;
    to?: string;
}

/** The crew assignments of a workspace. Every method is scoped by the workspace. */
export abstract class CrewAssignmentRepository {
    abstract insert(assignment: CrewAssignment): Promise<void>;
    abstract find(workspaceId: WorkspaceId, id: CrewAssignmentId): Promise<CrewAssignment | undefined>;
    /** Ordered by start, end, creation. */
    abstract list(workspaceId: WorkspaceId, filter: CrewAssignmentFilter): Promise<CrewAssignment[]>;
    /** How many assignments of these crews end on `day` or later (the in-use rule). */
    abstract countEndingOnOrAfter(workspaceId: WorkspaceId, crewIds: readonly CrewId[], day: string): Promise<number>;
    abstract update(assignment: CrewAssignment): Promise<void>;
    abstract delete(workspaceId: WorkspaceId, id: CrewAssignmentId): Promise<void>;
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
