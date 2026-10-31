import type { WorkspaceId } from '../../../../shared/domain/ids';
import { CompanyRepository, type SavedCompany } from '../../application/ports/company.repository';

/** Memory adapter (tests / trying without a database); stores copies. */
export class InMemoryCompanyRepository extends CompanyRepository {
    private readonly rows = new Map<string, SavedCompany>();

    find(workspaceId: WorkspaceId): Promise<SavedCompany | undefined> {
        const row = this.rows.get(workspaceId);
        return Promise.resolve(row === undefined ? undefined : structuredClone(row));
    }

    save(company: SavedCompany): Promise<void> {
        this.rows.set(company.workspaceId, structuredClone(company));
        return Promise.resolve();
    }
}
