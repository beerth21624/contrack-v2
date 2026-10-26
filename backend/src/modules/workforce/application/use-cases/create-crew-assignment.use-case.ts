import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import {
    type CrewId, type DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, asCrewAssignmentId, ok,
} from '../../../../shared/domain';
import { CrewAssignment } from '../../domain/entities/crew-assignment.entity';
import { dayRange, planTaskId } from '../../domain/value-objects/plan-day.value-object';
import { workforceNote } from '../../domain/value-objects/workforce-fields';
import { CrewAssignmentRepository } from '../ports/crew-assignment.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess } from '../workforce-access';
import { WorkforceReferences } from '../workforce-references';

export interface CreateCrewAssignmentInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    taskId: string;
    crewId: CrewId;
    start: string;
    end: string;
    note?: string | null;
}

/**
 * Puts a crew on a planned task of a project of the same workspace (not archived; unknown or another workspace's →
 * not_found). The crew must be active (422 otherwise). Overlapping assignments of one crew are allowed: the UI warns.
 */
@Injectable()
export class CreateCrewAssignmentUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly assignments: CrewAssignmentRepository,
        private readonly refs: WorkforceReferences,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: CreateCrewAssignmentInput): Promise<Result<CrewAssignment, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.assign');
        if (!granted.ok) return granted;
        const task = planTaskId(input.taskId);
        if (!task.ok) return task;
        const range = dayRange(input.start, input.end);
        if (!range.ok) return range;
        const note = workforceNote(input.note);
        if (!note.ok) return note;
        const project = await this.access.projectOfWorkspace(input.workspaceId, input.projectId);
        if (!project.ok) return project;

        return this.uow.run(async (): Promise<Result<CrewAssignment, DomainError>> => {
            await this.lock.lock(input.workspaceId);
            const crew = await this.refs.activeCrew(input.workspaceId, input.crewId);
            if (!crew.ok) return crew;
            const created = CrewAssignment.create({
                id: asCrewAssignmentId(this.ids.newId()),
                workspaceId: input.workspaceId,
                projectId: input.projectId,
                taskId: task.value,
                crewId: input.crewId,
                start: range.value.start,
                end: range.value.end,
                note: note.value,
                createdBy: input.userId,
                now: this.clock.now(),
            });
            if (!created.ok) return created;
            await this.assignments.insert(created.value);
            return ok(created.value);
        });
    }
}
