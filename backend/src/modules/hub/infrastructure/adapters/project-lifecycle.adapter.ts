import { Injectable } from '@nestjs/common';
import type { HubProjectFields, HubProjectStatus } from '@contrack/contract';
import { addDays } from '@contrack/domain/dates/business-date';
import { AuditLog, ProjectCatalog, ProjectLifecycle, UnitOfWork } from '../../../../shared/application/ports';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { HubProjectRepository } from '../../application/ports/hub-project.repository';
import { advancedStatus } from '../../domain/hub-state';

/** `ProjectLifecycle` over the hub columns: forward-only status changes from other modules' events, hub fields. */
@Injectable()
export class HubProjectLifecycle extends ProjectLifecycle {
    constructor(
        private readonly repo: HubProjectRepository,
        private readonly catalog: ProjectCatalog,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
    ) {
        super();
    }

    advance(workspaceId: WorkspaceId, projectId: ProjectId, to: HubProjectStatus, by: UserId | null): Promise<HubProjectStatus | undefined> {
        return this.uow.run(async () => {
            if ((await this.catalog.find(workspaceId, projectId)) === undefined) return undefined;
            const before = await this.repo.lockForUpdate(workspaceId, projectId);
            if (before === undefined) return undefined;
            const next = advancedStatus(before.status, to);
            if (next === before.status) return next;
            await this.repo.save(workspaceId, projectId, { ...before, status: next });
            await this.audit.record({
                workspaceId, projectId, actor: by, entityType: 'project', entityId: projectId, action: 'status_change',
                data: { status: [before.status, next], automatic: true },
            });
            return next;
        });
    }

    shiftPlannedFinish(workspaceId: WorkspaceId, projectId: ProjectId, days: number, by: UserId | null): Promise<void> {
        if (days === 0 || !Number.isInteger(days)) return Promise.resolve();
        return this.uow.run(async () => {
            if ((await this.catalog.find(workspaceId, projectId)) === undefined) return;
            const before = await this.repo.lockForUpdate(workspaceId, projectId);
            if (before === undefined || before.plannedFinish === null) return;
            const plannedFinish = addDays(before.plannedFinish, days);
            await this.repo.save(workspaceId, projectId, { ...before, plannedFinish });
            await this.audit.record({
                workspaceId, projectId, actor: by, entityType: 'project', entityId: projectId, action: 'hub_update',
                data: { plannedFinish: [before.plannedFinish, plannedFinish], automatic: true },
            });
        });
    }

    async hubFields(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HubProjectFields | undefined> {
        if ((await this.catalog.find(workspaceId, projectId)) === undefined) return undefined;
        return this.repo.find(workspaceId, projectId);
    }
}
