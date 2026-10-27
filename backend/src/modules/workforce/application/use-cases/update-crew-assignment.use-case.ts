import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import {
    type CrewAssignmentId, type CrewId, DomainError, type Result, type UserId, type WorkspaceId, err, ok,
} from '../../../../shared/domain';
import type { CrewAssignment, CrewAssignmentChanges } from '../../domain/entities/crew-assignment.entity';
import { planDay } from '../../domain/value-objects/plan-day.value-object';
import { workforceNote } from '../../domain/value-objects/workforce-fields';
import { CrewAssignmentRepository } from '../ports/crew-assignment.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess } from '../workforce-access';
import { WorkforceReferences } from '../workforce-references';

export interface UpdateCrewAssignmentInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    assignmentId: CrewAssignmentId;
    crewId?: CrewId;
    start?: string;
    end?: string;
    note?: string | null;
}

function parseChanges(input: UpdateCrewAssignmentInput): Result<CrewAssignmentChanges, DomainError> {
    const changes: CrewAssignmentChanges = {};
    if (input.crewId !== undefined) changes.crewId = input.crewId;
    if (input.start !== undefined) {
        const r = planDay(input.start, 'start');
        if (!r.ok) return r;
        changes.start = r.value;
    }
    if (input.end !== undefined) {
        const r = planDay(input.end, 'end');
        if (!r.ok) return r;
        changes.end = r.value;
    }
    if (input.note !== undefined) {
        const r = workforceNote(input.note);
        if (!r.ok) return r;
        changes.note = r.value;
    }
    return ok(changes);
}

/**
 * Moves an assignment to other days or another crew, or changes its note (the project and task stay). The resulting
 * range keeps start ≤ end; the crew it ends up with must be active (422); an archived project → 409 `conflict`.
 */
@Injectable()
export class UpdateCrewAssignmentUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly assignments: CrewAssignmentRepository,
        private readonly refs: WorkforceReferences,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: UpdateCrewAssignmentInput): Promise<Result<CrewAssignment, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.assign');
        if (!granted.ok) return granted;
        if (input.crewId === undefined && input.start === undefined && input.end === undefined && input.note === undefined) {
            return err(DomainError.validation('Nothing to update'));
        }
        const changes = parseChanges(input);
        if (!changes.ok) return changes;

        return this.uow.run(async (): Promise<Result<CrewAssignment, DomainError>> => {
            await this.lock.lock(input.workspaceId);
            const assignment = await this.assignments.find(input.workspaceId, input.assignmentId);
            if (assignment === undefined) return err(DomainError.notFound('Crew assignment'));
            const project = await this.access.projectOfWorkspace(input.workspaceId, assignment.projectId);
            if (!project.ok) return project;
            // The crew it will have must be active (a past assignment of an archived crew can only be moved to another).
            const crew = await this.refs.activeCrew(input.workspaceId, changes.value.crewId ?? assignment.crewId);
            if (!crew.ok) return crew;
            const changed = assignment.update(changes.value, this.clock.now());
            if (!changed.ok) return changed;
            if (changed.value) await this.assignments.update(assignment);
            return ok(assignment);
        });
    }
}
