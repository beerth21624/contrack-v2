import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain';
import { AssignmentRepository } from '../../application/ports/assignment.repository';
import { LevelAssignment } from '../../domain/entities/level-assignment.entity';

const copy = (a: LevelAssignment): LevelAssignment => LevelAssignment.rehydrate(a.toProps());
const rowKey = (projectId: ProjectId, levelId: string): string => `${projectId}\u0000${levelId}`;

export class InMemoryAssignmentRepository extends AssignmentRepository {
    private readonly rows = new Map<string, LevelAssignment>();

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<LevelAssignment[]> {
        const list = [...this.rows.values()]
            .filter(a => a.workspaceId === workspaceId && a.projectId === projectId)
            .sort((a, b) => (a.levelId < b.levelId ? -1 : a.levelId > b.levelId ? 1 : 0))
            .map(copy);
        return Promise.resolve(list);
    }

    find(workspaceId: WorkspaceId, projectId: ProjectId, levelId: string): Promise<LevelAssignment | undefined> {
        const a = this.rows.get(rowKey(projectId, levelId));
        return Promise.resolve(a?.workspaceId === workspaceId ? copy(a) : undefined);
    }

    save(assignment: LevelAssignment): Promise<void> {
        const key = rowKey(assignment.projectId, assignment.levelId);
        const current = this.rows.get(key);
        if (current !== undefined && current.workspaceId !== assignment.workspaceId) {
            return Promise.reject(new Error('assignment belongs to another workspace'));
        }
        this.rows.set(key, copy(assignment));
        return Promise.resolve();
    }

    remove(workspaceId: WorkspaceId, projectId: ProjectId, levelId: string): Promise<void> {
        const key = rowKey(projectId, levelId);
        if (this.rows.get(key)?.workspaceId === workspaceId) this.rows.delete(key);
        return Promise.resolve();
    }

    removeByUser(workspaceId: WorkspaceId, userId: UserId): Promise<LevelAssignment[]> {
        const removed: LevelAssignment[] = [];
        for (const [key, a] of this.rows) {
            if (a.workspaceId === workspaceId && a.userId === userId) {
                this.rows.delete(key);
                removed.push(a);
            }
        }
        return Promise.resolve(removed.map(copy));
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const [key, a] of this.rows) {
            if (a.workspaceId === workspaceId && a.projectId === projectId) this.rows.delete(key);
        }
        return Promise.resolve();
    }
}
