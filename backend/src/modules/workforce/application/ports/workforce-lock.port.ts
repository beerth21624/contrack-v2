import type { WorkspaceId } from '../../../../shared/domain';

/**
 * Serialises the workforce writers of one workspace until the current UnitOfWork ends (a transaction-scoped advisory
 * lock in PostgreSQL): the limits, the crew-name check and the in-use check cannot be raced past (e.g. a crew archived
 * while an assignment of it is being created).
 */
export abstract class WorkforceLock {
    abstract lock(workspaceId: WorkspaceId): Promise<void>;
}
