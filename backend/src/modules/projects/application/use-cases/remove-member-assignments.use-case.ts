// ─── A member left / was removed from a workspace: forget their level assignments there ───
// Runs inside the caller's UnitOfWork (nested `run` joins it). It cannot know when that transaction commits, so it
// does not publish: it returns `publish`, the after-commit step, for whoever owns the transaction to call.
import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import type { UserId, WorkspaceId } from '../../../../shared/domain';
import { ActivityEntry } from '../../domain/entities/activity-entry.entity';
import type { LevelAssignment } from '../../domain/entities/level-assignment.entity';
import { ProjectEvents } from '../project-events';
import { ActivityRepository } from '../ports/activity.repository';
import { AssignmentRepository } from '../ports/assignment.repository';

export interface RemovedMemberAssignments {
    removed: LevelAssignment[];
    /** Publishes `assignment.updated` (assignment null) per removed assignment. Call only after COMMIT. */
    publish: () => Promise<void>;
}

@Injectable()
export class RemoveMemberAssignmentsUseCase {
    constructor(
        private readonly assignments: AssignmentRepository,
        private readonly activity: ActivityRepository,
        private readonly events: ProjectEvents,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(workspaceId: WorkspaceId, userId: UserId): Promise<RemovedMemberAssignments> {
        const removed = await this.uow.run(async () => {
            const list = await this.assignments.removeByUser(workspaceId, userId);
            const now = this.clock.now();
            for (const a of list) {
                // The port names no actor: the entry is attributed to the member whose assignment ended.
                await this.activity.append(ActivityEntry.record({
                    workspaceId, projectId: a.projectId, userId, action: 'level.unassigned', at: now,
                }));
            }
            return list;
        });
        return {
            removed,
            publish: async () => {
                for (const a of removed) await this.events.assignmentUpdated(a.projectId, a.levelId, null);
            },
        };
    }
}
