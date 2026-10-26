import { Injectable } from '@nestjs/common';
import { DomainError, type ProjectId, type Result, type UserId, err, ok } from '../../../../shared/domain';
import type { ActivityEntry } from '../../domain/entities/activity-entry.entity';
import { ProjectAccess } from '../project-access';
import { ActivityRepository } from '../ports/activity.repository';

export const ACTIVITY_DEFAULT_LIMIT = 50;
export const ACTIVITY_MAX_LIMIT = 200;

export interface ListActivityInput {
    userId: UserId;
    projectId: ProjectId;
    /** Cursor: only entries older than this id (the last id of the previous page). */
    before?: bigint;
    limit?: number;
}

@Injectable()
export class ListActivityUseCase {
    constructor(private readonly access: ProjectAccess, private readonly activity: ActivityRepository) {}

    async execute(input: ListActivityInput): Promise<Result<ActivityEntry[], DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'projects.read');
        if (!granted.ok) return granted;
        const limit = input.limit ?? ACTIVITY_DEFAULT_LIMIT;
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > ACTIVITY_MAX_LIMIT) {
            return err(DomainError.validation(`limit must be between 1 and ${ACTIVITY_MAX_LIMIT}`));
        }
        if (input.before !== undefined && input.before < 1n) return err(DomainError.validation('before must be a positive id'));
        const { project } = granted.value;
        return ok(await this.activity.list(project.workspaceId, project.id, { before: input.before, limit }));
    }
}
