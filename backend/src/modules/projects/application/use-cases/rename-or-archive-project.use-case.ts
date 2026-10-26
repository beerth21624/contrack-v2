import { Injectable } from '@nestjs/common';
import type { ActivityAction } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError, type ProjectId, type Result, type UserId, err, ok } from '../../../../shared/domain';
import type { Permission } from '../../../../shared/domain/permissions';
import { ActivityEntry } from '../../domain/entities/activity-entry.entity';
import type { Project } from '../../domain/entities/project.entity';
import { ProjectName } from '../../domain/value-objects/project-name.value-object';
import { ProjectAccess } from '../project-access';
import { ProjectEvents } from '../project-events';
import { ActivityRepository } from '../ports/activity.repository';
import { ProjectRepository } from '../ports/project.repository';

export interface RenameOrArchiveProjectInput {
    userId: UserId;
    projectId: ProjectId;
    /** New name (needs projects.edit). */
    name?: string;
    /** true = archive, false = restore (needs projects.archive). */
    archived?: boolean;
}

@Injectable()
export class RenameOrArchiveProjectUseCase {
    constructor(
        private readonly access: ProjectAccess,
        private readonly projects: ProjectRepository,
        private readonly activity: ActivityRepository,
        private readonly events: ProjectEvents,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: RenameOrArchiveProjectInput): Promise<Result<Project, DomainError>> {
        if (input.name === undefined && input.archived === undefined) {
            return err(DomainError.validation('Nothing to update'));
        }
        const permissions: Permission[] = [];
        if (input.name !== undefined) permissions.push('projects.edit');
        if (input.archived !== undefined) permissions.push('projects.archive');
        const granted = await this.access.toProject(input.userId, input.projectId, ...permissions);
        if (!granted.ok) return granted;

        let name: ProjectName | undefined;
        if (input.name !== undefined) {
            const parsed = ProjectName.create(input.name);
            if (!parsed.ok) return parsed;
            name = parsed.value;
        }

        const outcome = await this.uow.run(async (): Promise<Result<{ project: Project; changed: boolean }, DomainError>> => {
            // Locked and re-read so a concurrent document write's summary is never overwritten with an old one.
            const project = await this.projects.lockForUpdate(granted.value.project.workspaceId, input.projectId);
            if (project === undefined) return err(DomainError.notFound('Project'));
            const now = this.clock.now();
            const actions: ActivityAction[] = [];
            // Restore first, so "restore and rename" works; an archived project cannot be renamed otherwise.
            if (input.archived === false && project.restore(now)) actions.push('project.restored');
            if (name !== undefined) {
                if (project.isArchived) return err(DomainError.conflict('The project is archived; restore it first'));
                if (project.rename(name, now)) actions.push('project.renamed');
            }
            if (input.archived === true && project.archive(now)) actions.push('project.archived');
            if (actions.length === 0) return ok({ project, changed: false });

            await this.projects.update(project);
            for (const action of actions) {
                await this.activity.append(ActivityEntry.record({
                    workspaceId: project.workspaceId, projectId: project.id, userId: input.userId, action, at: now,
                }));
            }
            return ok({ project, changed: true });
        });
        if (!outcome.ok) return outcome;
        if (outcome.value.changed) await this.events.projectUpdated(outcome.value.project);
        return ok(outcome.value.project);
    }
}
