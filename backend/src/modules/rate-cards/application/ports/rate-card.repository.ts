import type { RateCardId, WorkspaceId } from '../../../../shared/domain';
import type { RateCard } from '../../domain/entities/rate-card.entity';
import type { RateCardName } from '../../domain/value-objects/rate-card-name.value-object';

/** The rate cards of a workspace. Every method is scoped by the workspace. */
export abstract class RateCardRepository {
    /**
     * Serialises the writers of one workspace's library until the current UnitOfWork ends (a transaction-scoped
     * advisory lock in PostgreSQL), so the 50-card limit and the name check cannot be raced past.
     */
    abstract lockLibrary(workspaceId: WorkspaceId): Promise<void>;
    abstract insert(card: RateCard): Promise<void>;
    /** Active or archived. */
    abstract find(workspaceId: WorkspaceId, id: RateCardId): Promise<RateCard | undefined>;
    /** Cards of the workspace among `ids` (active or archived); unknown and other workspaces' ids are left out. */
    abstract findMany(workspaceId: WorkspaceId, ids: readonly RateCardId[]): Promise<RateCard[]>;
    /** Active cards, oldest first (the order a picker shows them in). */
    abstract listActive(workspaceId: WorkspaceId): Promise<RateCard[]>;
    abstract countActive(workspaceId: WorkspaceId): Promise<number>;
    /** The active card whose name equals `name` ignoring case. */
    abstract findActiveByName(workspaceId: WorkspaceId, name: RateCardName): Promise<RateCard | undefined>;
    abstract update(card: RateCard): Promise<void>;
}
