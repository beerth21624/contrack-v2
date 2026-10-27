// ─── Site supervisors (ผู้คุมงาน) of a project: read them, or replace the whole list ───
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/application/ports';
import {
    DomainError, type PersonId, type ProjectId, type Result, type UserId, asPersonId, err, ok,
} from '../../../../shared/domain';
import { distinct } from '../../domain/value-objects/workforce-fields';
import { ProjectSupervisorRepository } from '../ports/project-supervisor.repository';
import { WorkforceLock } from '../ports/workforce-lock.port';
import { WorkforceAccess, projectArchived } from '../workforce-access';
import { WorkforceReferences } from '../workforce-references';

export interface ProjectSupervisors {
    projectId: ProjectId;
    personIds: PersonId[];
}

export interface GetProjectSupervisorsInput {
    userId: UserId;
    projectId: ProjectId;
}

@Injectable()
export class GetProjectSupervisorsUseCase {
    constructor(private readonly access: WorkforceAccess, private readonly supervisors: ProjectSupervisorRepository) {}

    async execute(input: GetProjectSupervisorsInput): Promise<Result<ProjectSupervisors, DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'workforce.read');
        if (!granted.ok) return granted;
        return ok({ projectId: input.projectId, personIds: await this.supervisors.list(granted.value.workspaceId, input.projectId) });
    }
}

export interface PutProjectSupervisorsInput {
    userId: UserId;
    projectId: ProjectId;
    personIds: readonly string[];
}

export const MAX_SUPERVISORS = 20;

/**
 * Makes the project's supervisors exactly `personIds` (order kept, duplicates dropped; [] clears them). They must be
 * active people of the project's workspace (422 otherwise). An archived project → 409 `conflict`.
 */
@Injectable()
export class PutProjectSupervisorsUseCase {
    constructor(
        private readonly access: WorkforceAccess,
        private readonly supervisors: ProjectSupervisorRepository,
        private readonly refs: WorkforceReferences,
        private readonly lock: WorkforceLock,
        private readonly uow: UnitOfWork,
    ) {}

    async execute(input: PutProjectSupervisorsInput): Promise<Result<ProjectSupervisors, DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'workforce.assign');
        if (!granted.ok) return granted;
        const { workspaceId, archived } = granted.value;
        if (archived) return err(projectArchived());
        const personIds = distinct(input.personIds.map(id => asPersonId(id.toLowerCase())));
        if (personIds.length > MAX_SUPERVISORS) {
            return err(DomainError.validation(`A project has at most ${MAX_SUPERVISORS} supervisors`));
        }

        return this.uow.run(async (): Promise<Result<ProjectSupervisors, DomainError>> => {
            await this.lock.lock(workspaceId);
            const people = await this.refs.activePeople(workspaceId, personIds, 'personIds');
            if (!people.ok) return people;
            await this.supervisors.replace(workspaceId, input.projectId, personIds);
            return ok({ projectId: input.projectId, personIds });
        });
    }
}
