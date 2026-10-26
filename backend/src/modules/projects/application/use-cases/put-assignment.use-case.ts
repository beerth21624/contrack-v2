import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork, WorkspaceAccess } from '../../../../shared/application/ports';
import { DomainError, type ProjectId, type Result, type UserId, err, ok } from '../../../../shared/domain';
import { ActivityEntry } from '../../domain/entities/activity-entry.entity';
import { LevelAssignment } from '../../domain/entities/level-assignment.entity';
import { LevelId } from '../../domain/value-objects/level-id.value-object';
import { ProjectAccess } from '../project-access';
import { ProjectEvents } from '../project-events';
import { ActivityRepository } from '../ports/activity.repository';
import { AssignmentRepository } from '../ports/assignment.repository';
import { ProjectRepository } from '../ports/project.repository';

export interface PutAssignmentInput {
    userId: UserId;
    projectId: ProjectId;
    levelId: string;
    /** The member responsible for the level; null removes the assignment. */
    assigneeId: UserId | null;
}

@Injectable()
export class PutAssignmentUseCase {
    constructor(
        private readonly access: ProjectAccess,
        private readonly workspaces: WorkspaceAccess,
        private readonly projects: ProjectRepository,
        private readonly assignments: AssignmentRepository,
        private readonly activity: ActivityRepository,
        private readonly events: ProjectEvents,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: PutAssignmentInput): Promise<Result<LevelAssignment | null, DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'levels.assign');
        if (!granted.ok) return granted;
        const { project } = granted.value;
        const levelId = LevelId.create(input.levelId);
        if (!levelId.ok) return levelId;
        if (input.assigneeId !== null && await this.workspaces.roleOf(input.assigneeId, project.workspaceId) === undefined) {
            return err(DomainError.unprocessable('The assignee is not a member of this workspace', { userId: input.assigneeId }));
        }
        const assigneeId = input.assigneeId;

        const outcome = await this.uow.run(async (): Promise<Result<{ assignment: LevelAssignment | null; changed: boolean }, DomainError>> => {
            // Locked so the project cannot be deleted under the write.
            if (await this.projects.lockForUpdate(project.workspaceId, project.id) === undefined) {
                return err(DomainError.notFound('Project'));
            }
            const current = await this.assignments.find(project.workspaceId, project.id, levelId.value.value);
            const now = this.clock.now();
            if (assigneeId === null) {
                if (current === undefined) return ok({ assignment: null, changed: false });
                await this.assignments.remove(project.workspaceId, project.id, levelId.value.value);
                await this.activity.append(ActivityEntry.record({
                    workspaceId: project.workspaceId, projectId: project.id, userId: input.userId, action: 'level.unassigned', at: now,
                }));
                return ok({ assignment: null, changed: true });
            }
            if (current?.userId === assigneeId) return ok({ assignment: current, changed: false });
            const assignment = LevelAssignment.assign({
                projectId: project.id,
                workspaceId: project.workspaceId,
                levelId: levelId.value,
                userId: assigneeId,
                assignedBy: input.userId,
                now,
            });
            await this.assignments.save(assignment);
            await this.activity.append(ActivityEntry.record({
                workspaceId: project.workspaceId, projectId: project.id, userId: input.userId, action: 'level.assigned', at: now,
            }));
            return ok({ assignment, changed: true });
        });

        if (!outcome.ok) return outcome;
        if (outcome.value.changed) await this.events.assignmentUpdated(project.id, levelId.value.value, outcome.value.assignment);
        return ok(outcome.value.assignment);
    }
}
