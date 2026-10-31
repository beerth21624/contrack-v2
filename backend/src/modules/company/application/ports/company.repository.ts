import type { CompanyProfile } from '../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../shared/domain/ids';

/** A saved `company_profiles` row. */
export type SavedCompany = Omit<CompanyProfile, 'isDefault' | 'workspaceName'>;

/** The company profile of a workspace (one row). Every method filters by `workspaceId`. */
export abstract class CompanyRepository {
    abstract find(workspaceId: WorkspaceId): Promise<SavedCompany | undefined>;
    abstract save(company: SavedCompany): Promise<void>;
}
