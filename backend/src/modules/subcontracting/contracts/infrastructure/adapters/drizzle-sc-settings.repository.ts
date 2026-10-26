import { eq } from 'drizzle-orm';
import type { SubcontractingSettingsDto } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../../shared/domain';
import type { DatabaseContext } from '../../../../../shared/infrastructure/database/database';
import { scSettings } from '../../../../../shared/infrastructure/database/schema-sc-contracts';
import { ScSettingsRepository } from '../../application/ports/sc-settings.repository';

export class DrizzleScSettingsRepository extends ScSettingsRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async get(workspaceId: WorkspaceId): Promise<SubcontractingSettingsDto | undefined> {
        const rows = await this.ctx.executor.select().from(scSettings).where(eq(scSettings.workspaceId, workspaceId)).limit(1);
        return rows[0]?.data;
    }

    async put(workspaceId: WorkspaceId, data: SubcontractingSettingsDto, by: UserId, at: Date): Promise<void> {
        await this.ctx.executor.insert(scSettings).values({ workspaceId, data, updatedBy: by, updatedAt: at })
            .onConflictDoUpdate({ target: scSettings.workspaceId, set: { data, updatedBy: by, updatedAt: at } });
    }
}
