import type { ProjectId, WorkspaceId } from '../../../../shared/domain';
import { ActivityRepository, type ActivityPage } from '../../application/ports/activity.repository';
import { ActivityEntry, type NewActivity } from '../../domain/entities/activity-entry.entity';

export class InMemoryActivityRepository extends ActivityRepository {
    private readonly rows: ActivityEntry[] = [];
    /** Like bigserial: never reused, even after deletes. */
    private nextId = 1n;

    append(entry: NewActivity): Promise<ActivityEntry> {
        const stored = ActivityEntry.rehydrate({ ...entry, id: this.nextId });
        this.nextId += 1n;
        this.rows.push(stored);
        return Promise.resolve(stored);
    }

    list(workspaceId: WorkspaceId, projectId: ProjectId, page: ActivityPage): Promise<ActivityEntry[]> {
        const { before } = page;
        const list = this.rows
            .filter(e => e.workspaceId === workspaceId && e.projectId === projectId && (before === undefined || e.id < before))
            .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
            .slice(0, Math.max(0, page.limit));
        return Promise.resolve(list);
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (let i = this.rows.length - 1; i >= 0; i -= 1) {
            const e = this.rows[i];
            if (e?.workspaceId === workspaceId && e.projectId === projectId) this.rows.splice(i, 1);
        }
        return Promise.resolve();
    }
}
