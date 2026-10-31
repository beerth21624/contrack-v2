import type { HubProjectFields } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';

/** The hub columns of a project row as stored (a project without hub data has these). */
export const DEFAULT_HUB_FIELDS: Readonly<HubProjectFields> = {
    code: null,
    status: 'estimating',
    projectType: null,
    customerId: null,
    siteAddress: '',
    plannedStart: null,
    plannedFinish: null,
    actualStart: null,
    actualFinish: null,
    managerUserId: null,
    settings: {},
    description: '',
};

/**
 * The Project Hub columns of `projects` (docs/erp/02-domain-model.md §1.9). Reads and writes only those columns: the
 * projects module owns the rest of the row. Every method filters by workspace.
 */
export abstract class HubProjectRepository {
    /** One read for many projects; a project of the workspace without hub data gets the defaults. */
    abstract findMany(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, HubProjectFields>>;
    abstract find(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HubProjectFields | undefined>;
    /** Locks the project row until the current UnitOfWork ends (`SELECT … FOR UPDATE`). */
    abstract lockForUpdate(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HubProjectFields | undefined>;
    abstract save(workspaceId: WorkspaceId, projectId: ProjectId, fields: HubProjectFields): Promise<void>;
    /** Another project of the workspace already has this code. */
    abstract codeTaken(workspaceId: WorkspaceId, code: string, exceptProjectId: ProjectId): Promise<boolean>;
    /** Forgets a deleted project (memory only: in PostgreSQL the columns go with the row). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
