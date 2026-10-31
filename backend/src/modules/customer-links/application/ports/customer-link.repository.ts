import type { CustomerLinkSubject } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import type { CustomerLink } from '../../domain/customer-link';

/** The `customer_links` table. `findById` / token lookups are unscoped (the caller authorizes on the row's workspace). */
export abstract class CustomerLinkRepository {
    abstract findById(linkId: string): Promise<CustomerLink | undefined>;
    abstract findByTokenHash(tokenHash: string): Promise<CustomerLink | undefined>;
    /** Same, locking the row (call inside `uow.run`). */
    abstract lockByTokenHash(tokenHash: string): Promise<CustomerLink | undefined>;
    /** Newest first. */
    abstract listForSubject(workspaceId: WorkspaceId, subjectType: CustomerLinkSubject, subjectId: string): Promise<CustomerLink[]>;
    abstract save(link: CustomerLink): Promise<void>;
    /** `view_count + 1`, `last_viewed_at = at` (atomic). */
    abstract recordView(linkId: string, at: Date): Promise<void>;
}

/** Sliding-window limiter of the public routes (in process memory: one server instance). */
export abstract class LinkRateLimiter {
    /** Records one hit and answers true while `key` has fewer than `limit` hits in the window; false (nothing recorded) otherwise. */
    abstract tryHit(key: string, limit: number, windowMs: number): boolean;
}
