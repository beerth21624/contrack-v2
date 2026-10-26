import type { SubcontractingSettingsDto } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../../shared/domain';
import { ScSettingsRepository } from '../../application/ports/sc-settings.repository';

export class InMemoryScSettingsRepository extends ScSettingsRepository {
    private readonly rows = new Map<WorkspaceId, SubcontractingSettingsDto>();

    get(workspaceId: WorkspaceId): Promise<SubcontractingSettingsDto | undefined> {
        const s = this.rows.get(workspaceId);
        return Promise.resolve(s === undefined ? undefined : { ...s });
    }

    put(workspaceId: WorkspaceId, data: SubcontractingSettingsDto, _by: UserId, _at: Date): Promise<void> {
        this.rows.set(workspaceId, { ...data });
        return Promise.resolve();
    }
}
