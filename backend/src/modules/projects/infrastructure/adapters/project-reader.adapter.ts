// ─── Shared port ProjectReader: a project rebuilt from its documents (for subcontracting snapshots) ───
import { Injectable } from '@nestjs/common';
import { ProjectReader, type ProjectRead } from '../../../../shared/application/ports';
import type { ProjectId } from '../../../../shared/domain';
import { ProjectDocRepository } from '../../application/ports/project-doc.repository';
import { ProjectRepository } from '../../application/ports/project.repository';
import { ProjectAssembler } from '../../domain/services/project-assembler.service';

@Injectable()
export class RepositoryProjectReader extends ProjectReader {
    constructor(
        private readonly projects: ProjectRepository,
        private readonly docs: ProjectDocRepository,
        private readonly assembler: ProjectAssembler,
    ) {
        super();
    }

    async read(projectId: ProjectId): Promise<ProjectRead | undefined> {
        const project = await this.projects.findById(projectId);
        if (project === undefined) return undefined;
        const docs = await this.docs.listByProject(project.workspaceId, project.id);
        return {
            projectId: project.id,
            workspaceId: project.workspaceId,
            name: project.name.value,
            archived: project.toProps().archivedAt !== null,
            project: this.assembler.assemble(project.start, docs.map(d => d.toEntry())),
        };
    }
}
