// ─── Realtime fan-out of committed changes ───
// Called only after the UnitOfWork returned (after COMMIT). A failing publish never turns a committed write into an
// error for the writer (they would retry with a stale baseVersion); it is logged and the clients resync on reload.
import { Injectable, Logger } from '@nestjs/common';
import { RealtimePublisher } from '../../../shared/application/ports';
import type { ProjectId } from '../../../shared/domain';
import type { LevelAssignment } from '../domain/entities/level-assignment.entity';
import type { ProjectDoc } from '../domain/entities/project-doc.entity';
import type { Project } from '../domain/entities/project.entity';
import { assignmentToDto, projectDocToDto, projectToDto } from './project-dto.mapper';

@Injectable()
export class ProjectEvents {
    private readonly logger = new Logger('ProjectEvents');

    constructor(private readonly publisher: RealtimePublisher) {}

    async docUpdated(project: Project, doc: ProjectDoc): Promise<void> {
        await this.safely('doc.updated', () => this.publisher.docUpdated({ projectId: project.id, doc: projectDocToDto(doc) }));
        await this.projectUpdated(project);
    }

    async projectUpdated(project: Project): Promise<void> {
        await this.safely('project.updated', () => this.publisher.projectUpdated({ project: projectToDto(project) }));
    }

    async projectDeleted(projectId: ProjectId): Promise<void> {
        await this.safely('project.deleted', () => this.publisher.projectDeleted({ projectId }));
    }

    async assignmentUpdated(projectId: ProjectId, levelId: string, assignment: LevelAssignment | null): Promise<void> {
        await this.safely('assignment.updated', () => this.publisher.assignmentUpdated({
            projectId,
            levelId,
            assignment: assignment === null ? null : assignmentToDto(assignment),
        }));
    }

    private async safely(event: string, publish: () => Promise<void>): Promise<void> {
        try {
            await publish();
        } catch (e) {
            this.logger.error(`publishing ${event} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
