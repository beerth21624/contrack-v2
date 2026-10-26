// ─── Socket.IO room names: one room per project, everyone viewing it ───
import type { ProjectId } from '../../../../shared/domain/ids';

const PROJECT_ROOM_PREFIX = 'project:';

export function projectRoom(projectId: ProjectId): string {
    return `${PROJECT_ROOM_PREFIX}${projectId}`;
}
