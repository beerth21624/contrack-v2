import type { SubcontractingSettingsDto } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../../shared/domain';

export abstract class ScSettingsRepository {
    /** undefined when the workspace never saved settings. */
    abstract get(workspaceId: WorkspaceId): Promise<SubcontractingSettingsDto | undefined>;
    abstract put(workspaceId: WorkspaceId, data: SubcontractingSettingsDto, by: UserId, at: Date): Promise<void>;
}
