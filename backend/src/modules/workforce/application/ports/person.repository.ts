import type { PersonId, WorkspaceId } from '../../../../shared/domain';
import type { Person } from '../../domain/entities/person.entity';

/** The people of a workspace. Every method is scoped by the workspace. */
export abstract class PersonRepository {
    abstract insert(person: Person): Promise<void>;
    /** Active or archived. */
    abstract find(workspaceId: WorkspaceId, id: PersonId): Promise<Person | undefined>;
    /** People of the workspace among `ids` (active or archived); unknown and other workspaces' ids are left out. */
    abstract findMany(workspaceId: WorkspaceId, ids: readonly PersonId[]): Promise<Person[]>;
    /** Active people, oldest first. */
    abstract listActive(workspaceId: WorkspaceId): Promise<Person[]>;
    abstract countActive(workspaceId: WorkspaceId): Promise<number>;
    abstract update(person: Person): Promise<void>;
}
