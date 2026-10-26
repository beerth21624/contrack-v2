import type { SubcontractId, VariationId } from '../../../shared/ids';
import { VariationRepository } from '../../application/ports/variation.repository';
import { Variation, type VariationProps } from '../../domain/entities/variation.entity';

export class InMemoryVariationRepository extends VariationRepository {
    private readonly rows = new Map<VariationId, VariationProps>();

    insert(variation: Variation): Promise<void> {
        if (this.rows.has(variation.id)) throw new Error(`variation ${variation.id} already exists`);
        this.rows.set(variation.id, variation.toProps());
        return Promise.resolve();
    }

    update(variation: Variation): Promise<void> {
        if (!this.rows.has(variation.id)) throw new Error(`variation ${variation.id} not found`);
        this.rows.set(variation.id, variation.toProps());
        return Promise.resolve();
    }

    findById(id: VariationId): Promise<Variation | undefined> {
        const p = this.rows.get(id);
        return Promise.resolve(p === undefined ? undefined : Variation.rehydrate(p));
    }

    listBySubcontracts(ids: readonly SubcontractId[]): Promise<Variation[]> {
        return Promise.resolve([...this.rows.values()].filter(p => ids.includes(p.subcontractId))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(p => Variation.rehydrate(p)));
    }
}
