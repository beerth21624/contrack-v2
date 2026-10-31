// ─── Shared ports RevisionWriter / RevisionLookup: revisions for other modules (boq-control, baseline, quotations) ───
import { Injectable } from '@nestjs/common';
import type { Project as BoqProject } from '@contrack/domain/project';
import { RevisionLookup, type RevisionInfo, RevisionWriter } from '../../../../shared/application/ports';
import { type DomainError, type ProjectId, type Result, type RevisionId, type UserId, type WorkspaceId, ok } from '../../../../shared/domain';
import { RevisionRepository } from '../../application/ports/revision.repository';
import { CreateRevisionUseCase } from '../../application/use-cases/create-revision.use-case';
import type { Revision } from '../../domain/entities/revision.entity';

const info = (r: Revision): RevisionInfo => ({
    id: r.id, workspaceId: r.workspaceId, projectId: r.projectId, label: r.label, note: r.note, createdBy: r.createdBy, createdAt: r.createdAt,
});

@Injectable()
export class ProjectsRevisionWriter extends RevisionWriter {
    constructor(private readonly createRevision: CreateRevisionUseCase) {
        super();
    }

    async create(
        workspaceId: WorkspaceId, projectId: ProjectId, input: { label: string; note?: string; by: UserId },
    ): Promise<Result<RevisionInfo, DomainError>> {
        const created = await this.createRevision.createIn(workspaceId, projectId, { userId: input.by, label: input.label, note: input.note });
        return created.ok ? ok(info(created.value)) : created;
    }
}

@Injectable()
export class ProjectsRevisionLookup extends RevisionLookup {
    constructor(private readonly revisions: RevisionRepository) {
        super();
    }

    async list(workspaceId: WorkspaceId, projectId: ProjectId): Promise<RevisionInfo[]> {
        const all = await this.revisions.listByProject(workspaceId, projectId);
        return all.map(info).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    }

    async snapshot(workspaceId: WorkspaceId, projectId: ProjectId, revisionId: RevisionId): Promise<BoqProject | undefined> {
        return (await this.revisions.find(workspaceId, projectId, revisionId))?.snapshot;
    }
}
