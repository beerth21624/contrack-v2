import type { CrewId, PersonId, WorkspaceId } from '../../../../shared/domain';
import type { Crew } from '../../domain/entities/crew.entity';
import type { WorkforceName } from '../../domain/value-objects/workforce-name.value-object';

/** The crews of a workspace, with their named members. Every method is scoped by the workspace. */
export abstract class CrewRepository {
    abstract insert(crew: Crew): Promise<void>;
    /** Active or archived. */
    abstract find(workspaceId: WorkspaceId, id: CrewId): Promise<Crew | undefined>;
    /** Active crews, oldest first. */
    abstract listActive(workspaceId: WorkspaceId): Promise<Crew[]>;
    abstract countActive(workspaceId: WorkspaceId): Promise<number>;
    /** The active crew whose name equals `name` ignoring case. */
    abstract findActiveByName(workspaceId: WorkspaceId, name: WorkforceName): Promise<Crew | undefined>;
    /** Crews (active or archived) the person leads or is a named member of. */
    abstract listInvolving(workspaceId: WorkspaceId, personId: PersonId): Promise<Crew[]>;
    /** Writes the fields and replaces the named members. */
    abstract update(crew: Crew): Promise<void>;
}
