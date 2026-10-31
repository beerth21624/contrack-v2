import { Injectable } from '@nestjs/common';
import { ProjectDeletionGuards, ProjectDependents, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError, type ProjectId, type Result, type UserId, err, okVoid } from '../../../../shared/domain';
import { ProjectAccess } from '../project-access';
import { ProjectEvents } from '../project-events';
import { ActivityRepository } from '../ports/activity.repository';
import { AssignmentRepository } from '../ports/assignment.repository';
import { ProjectDocRepository } from '../ports/project-doc.repository';
import { ProjectRepository } from '../ports/project.repository';
import { RevisionRepository } from '../ports/revision.repository';

export interface DeleteProjectInput {
    userId: UserId;
    projectId: ProjectId;
}

@Injectable()
export class DeleteProjectUseCase {
    constructor(
        private readonly access: ProjectAccess,
        private readonly projects: ProjectRepository,
        private readonly docs: ProjectDocRepository,
        private readonly revisions: RevisionRepository,
        private readonly assignments: AssignmentRepository,
        private readonly activity: ActivityRepository,
        private readonly events: ProjectEvents,
        private readonly uow: UnitOfWork,
        private readonly dependents: ProjectDependents,
        // Default for unit tests built by hand; Nest injects the core registry.
        private readonly guards: ProjectDeletionGuards = new ProjectDeletionGuards(),
    ) {}

    async execute(input: DeleteProjectInput): Promise<Result<undefined, DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'projects.delete');
        if (!granted.ok) return granted;
        const { workspaceId, id } = granted.value.project;
        const done = await this.uow.run(async (): Promise<Result<undefined, DomainError>> => {
            // Waits for a write in progress on this project, then removes everything it owns
            // (PostgreSQL would cascade; the explicit deletes keep the in-memory adapters identical).
            await this.projects.lockForUpdate(workspaceId, id);
            // ERP modules refuse while the project has issued documents (none registered / no rows in release 1).
            const blockers = await this.guards.blockers(workspaceId, id);
            const first = blockers[0];
            if (first !== undefined) {
                return err(DomainError.conflict('The project has issued documents and cannot be deleted', { reason: first.reason, blockers }));
            }
            await this.docs.deleteByProject(workspaceId, id);
            await this.revisions.deleteByProject(workspaceId, id);
            await this.assignments.deleteByProject(workspaceId, id);
            await this.activity.deleteByProject(workspaceId, id);
            // Other modules' rows of the project (crew assignments, site supervisors).
            await this.dependents.deleteByProject(workspaceId, id);
            await this.projects.delete(workspaceId, id);
            return okVoid();
        });
        if (!done.ok) return done;
        // After COMMIT: viewers leave the project and drop queued edits.
        await this.events.projectDeleted(id);
        return okVoid();
    }
}
