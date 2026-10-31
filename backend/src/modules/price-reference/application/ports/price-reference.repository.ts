import type { PriceReferenceItemDto } from '@contrack/contract';

export interface PriceReferenceSearch {
    /** Already normalised (lower-case, trimmed); empty = no text filter. */
    q: string;
    category?: string;
    limit: number;
}

/** `price_reference_items` (read side; the importer writes through the CLI). Platform-wide books: no workspace filter. */
export abstract class PriceReferenceRepository {
    abstract search(query: PriceReferenceSearch): Promise<PriceReferenceItemDto[]>;
}
