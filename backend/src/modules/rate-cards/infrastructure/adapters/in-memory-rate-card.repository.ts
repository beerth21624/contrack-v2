import type { RateCardId, WorkspaceId } from '../../../../shared/domain';
import { RateCardRepository } from '../../application/ports/rate-card.repository';
import { RateCard } from '../../domain/entities/rate-card.entity';
import type { RateCardName } from '../../domain/value-objects/rate-card-name.value-object';

const copy = (c: RateCard): RateCard => RateCard.rehydrate(c.toProps());

export class InMemoryRateCardRepository extends RateCardRepository {
    private readonly rows = new Map<RateCardId, RateCard>();
    /** Per workspace: resolves when the current holder's lock is released. */
    private readonly locks = new Map<WorkspaceId, Promise<void>>();

    /**
     * A FIFO lock per workspace. In-memory work never does I/O, so a whole UnitOfWork runs within the microtasks that
     * follow acquiring the lock; releasing it on the next macrotask (setImmediate) releases it after the holder's work,
     * like an advisory lock released at COMMIT.
     */
    async lockLibrary(workspaceId: WorkspaceId): Promise<void> {
        const previous = this.locks.get(workspaceId) ?? Promise.resolve();
        const held = previous.then(() => new Promise<void>(resolve => setImmediate(resolve)));
        this.locks.set(workspaceId, held);
        void held.then(() => {
            if (this.locks.get(workspaceId) === held) this.locks.delete(workspaceId);
        });
        await previous;
    }

    insert(card: RateCard): Promise<void> {
        if (this.rows.has(card.id)) return Promise.reject(new Error(`rate card ${card.id} already exists`));
        // Mirrors the rate_cards_name_key unique index.
        if (!card.isArchived && this.active(card.workspaceId).some(c => c.name.sameKey(card.name))) {
            return Promise.reject(new Error(`rate card name "${card.name.value}" is taken`));
        }
        this.rows.set(card.id, copy(card));
        return Promise.resolve();
    }

    find(workspaceId: WorkspaceId, id: RateCardId): Promise<RateCard | undefined> {
        const c = this.rows.get(id);
        return Promise.resolve(c?.workspaceId === workspaceId ? copy(c) : undefined);
    }

    findMany(workspaceId: WorkspaceId, ids: readonly RateCardId[]): Promise<RateCard[]> {
        const wanted = new Set(ids);
        return Promise.resolve([...this.rows.values()].filter(c => c.workspaceId === workspaceId && wanted.has(c.id)).map(copy));
    }

    listActive(workspaceId: WorkspaceId): Promise<RateCard[]> {
        const list = this.active(workspaceId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
            .map(copy);
        return Promise.resolve(list);
    }

    countActive(workspaceId: WorkspaceId): Promise<number> {
        return Promise.resolve(this.active(workspaceId).length);
    }

    findActiveByName(workspaceId: WorkspaceId, name: RateCardName): Promise<RateCard | undefined> {
        const c = this.active(workspaceId).find(x => x.name.sameKey(name));
        return Promise.resolve(c === undefined ? undefined : copy(c));
    }

    update(card: RateCard): Promise<void> {
        const current = this.rows.get(card.id);
        if (current?.workspaceId !== card.workspaceId) return Promise.resolve();
        if (!card.isArchived && this.active(card.workspaceId).some(c => c.id !== card.id && c.name.sameKey(card.name))) {
            return Promise.reject(new Error(`rate card name "${card.name.value}" is taken`));
        }
        this.rows.set(card.id, copy(card));
        return Promise.resolve();
    }

    private active(workspaceId: WorkspaceId): RateCard[] {
        return [...this.rows.values()].filter(c => c.workspaceId === workspaceId && !c.isArchived);
    }
}
