import type { PriceReferenceItemDto } from '@contrack/contract';
import { PriceReferenceRepository, type PriceReferenceSearch } from '../../application/ports/price-reference.repository';

/** Memory adapter: starts empty (the catalogue is imported with `npm run db:import-prices`). */
export class InMemoryPriceReferenceRepository extends PriceReferenceRepository {
    readonly rows: PriceReferenceItemDto[] = [];

    search({ q, category, limit }: PriceReferenceSearch): Promise<PriceReferenceItemDto[]> {
        const terms = q.split(/\s+/).filter(t => t !== '');
        return Promise.resolve(this.rows
            .filter(r => (category === undefined || r.category === category)
                && terms.every(t => `${r.material} ${r.spec} ${r.brand} ${r.model} ${r.category}`.toLowerCase().includes(t)))
            .slice(0, limit));
    }
}
