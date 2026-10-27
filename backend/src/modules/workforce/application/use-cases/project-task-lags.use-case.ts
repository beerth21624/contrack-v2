// ─── Waiting windows after planned tasks (W2, ช่วงรอ): a project's overrides of the default waits ───
// The server stores only what the project changed; it never applies the defaults (src/domain/workforce/task-lags.ts).
import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import {
    type DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, err, ok,
} from '../../../../shared/domain';
import { type TaskLag, type TaskLagInput, taskLagSet } from '../../domain/value-objects/task-lag.value-object';
import { ProjectTaskLagRepository } from '../ports/project-task-lag.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess, projectArchived } from '../workforce-access';

export interface ProjectTaskLags {
    projectId: ProjectId;
    /** In task order ("1.9" before "1.10"). */
    lags: TaskLag[];
}

export interface GetProjectTaskLagsInput {
    userId: UserId;
    projectId: ProjectId;
}

/** Any member of the project's workspace reads them (also for an archived project). */
@Injectable()
export class GetProjectTaskLagsUseCase {
    constructor(private readonly access: WorkforceAccess, private readonly lags: ProjectTaskLagRepository) {}

    async execute(input: GetProjectTaskLagsInput): Promise<Result<ProjectTaskLags, DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'workforce.read');
        if (!granted.ok) return granted;
        return ok({ projectId: input.projectId, lags: await this.lags.list(granted.value.workspaceId, input.projectId) });
    }
}

export interface PutProjectTaskLagsInput {
    userId: UserId;
    projectId: ProjectId;
    lags: readonly TaskLagInput[];
}

/**
 * Makes the project's overrides exactly `lags` ([] clears them): one per task (a duplicate task → 400), days 0–90.
 * `workforce.assign`; an archived project → 409 `conflict`. Serialised per workspace, so two PUTs never merge.
 */
@Injectable()
export class PutProjectTaskLagsUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly lags: ProjectTaskLagRepository,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: PutProjectTaskLagsInput): Promise<Result<ProjectTaskLags, DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'workforce.assign');
        if (!granted.ok) return granted;
        const { workspaceId, archived } = granted.value;
        if (archived) return err(projectArchived());
        const lags = taskLagSet(input.lags);
        if (!lags.ok) return lags;

        return this.uow.run(async (): Promise<Result<ProjectTaskLags, DomainError>> => {
            await this.lock.lock(workspaceId);
            await this.lags.replace(workspaceId, input.projectId, lags.value, input.userId, this.clock.now());
            return ok({ projectId: input.projectId, lags: lags.value });
        });
    }
}

export interface ListWorkspaceTaskLagsInput {
    userId: UserId;
    workspaceId: WorkspaceId;
}

/**
 * The overrides of every non-archived project of the workspace that has at least one (for the crew board), by project
 * id. A project with no override is left out: its waits are all the defaults.
 */
@Injectable()
export class ListWorkspaceTaskLagsUseCase {
    constructor(private readonly access: WorkforceAccess, private readonly lags: ProjectTaskLagRepository) {}

    async execute(input: ListWorkspaceTaskLagsInput): Promise<Result<ProjectTaskLags[], DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.read');
        if (!granted.ok) return granted;
        const rows = (await this.lags.listByWorkspace(input.workspaceId)).filter(r => r.lags.length > 0);
        const active = await this.access.activeProjectsOf(input.workspaceId, rows.map(r => r.projectId));
        return ok(rows.filter(r => active.has(r.projectId)));
    }
}
