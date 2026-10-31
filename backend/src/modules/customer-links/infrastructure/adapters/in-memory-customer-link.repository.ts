import type { CustomerLinkSubject } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import { CustomerLinkRepository } from '../../application/ports/customer-link.repository';
import type { CustomerLink } from '../../domain/customer-link';

/** Memory adapter (tests / trying without a database); stores copies and mimics the unique token hash. */
export class InMemoryCustomerLinkRepository extends CustomerLinkRepository {
    private readonly rows = new Map<string, CustomerLink>();

    findById(linkId: string): Promise<CustomerLink | undefined> {
        const row = this.rows.get(linkId);
        return Promise.resolve(row === undefined ? undefined : structuredClone(row));
    }

    findByTokenHash(tokenHash: string): Promise<CustomerLink | undefined> {
        const row = [...this.rows.values()].find(l => l.tokenHash === tokenHash);
        return Promise.resolve(row === undefined ? undefined : structuredClone(row));
    }

    lockByTokenHash(tokenHash: string): Promise<CustomerLink | undefined> {
        return this.findByTokenHash(tokenHash);
    }

    listForSubject(workspaceId: WorkspaceId, subjectType: CustomerLinkSubject, subjectId: string): Promise<CustomerLink[]> {
        const rows = [...this.rows.values()]
            .filter(l => l.workspaceId === workspaceId && l.subjectType === subjectType && l.subjectId === subjectId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return Promise.resolve(rows.map(l => structuredClone(l)));
    }

    save(link: CustomerLink): Promise<void> {
        const clash = [...this.rows.values()].find(l => l.tokenHash === link.tokenHash && l.id !== link.id);
        if (clash !== undefined) return Promise.reject(new Error('customer_links_token_hash_key'));
        this.rows.set(link.id, structuredClone(link));
        return Promise.resolve();
    }

    recordView(linkId: string, at: Date): Promise<void> {
        const row = this.rows.get(linkId);
        if (row !== undefined) {
            row.viewCount += 1;
            row.lastViewedAt = at;
        }
        return Promise.resolve();
    }
}
