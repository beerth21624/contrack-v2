import { Injectable } from '@nestjs/common';
import type { ProjectStart } from '@contrack/domain/project';
import type { DocKey } from '@contrack/domain/sync';
import { Clock, IdGenerator, UnitOfWork } from '../../../../shared/application/ports';
import {
    DomainError, type Result, type UserId, type WorkspaceId, asProjectId, err, ok,
} from '../../../../shared/domain';
import { ActivityEntry } from '../../domain/entities/activity-entry.entity';
import { ProjectDoc } from '../../domain/entities/project-doc.entity';
import { Project } from '../../domain/entities/project.entity';
import { ProjectAssembler } from '../../domain/services/project-assembler.service';
import { ProjectName } from '../../domain/value-objects/project-name.value-object';
import { ProjectAccess } from '../project-access';
import { ActivityRepository } from '../ports/activity.repository';
import { ProjectDocRepository } from '../ports/project-doc.repository';
import { ProjectRepository } from '../ports/project.repository';
import type { ProjectWithDocs } from './get-project.use-case';

export interface InitialDocInput {
    docKey: string;
    /** A missing data field is refused (null resets; it never means "nothing"). */
    data?: unknown;
}

export interface CreateProjectInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    name: string;
    start: ProjectStart;
    /** Upload of a guest project: every document is validated, and the project they make must compute. */
    docs?: readonly InitialDocInput[];
}

@Injectable()
export class CreateProjectUseCase {
    constructor(
        private readonly access: ProjectAccess,
        private readonly projects: ProjectRepository,
        private readonly docs: ProjectDocRepository,
        private readonly activity: ActivityRepository,
        private readonly assembler: ProjectAssembler,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: CreateProjectInput): Promise<Result<ProjectWithDocs, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'projects.create');
        if (!granted.ok) return granted;
        const name = ProjectName.create(input.name);
        if (!name.ok) return name;

        const entries: { docKey: DocKey; data: unknown }[] = [];
        const seen = new Set<string>();
        for (const doc of input.docs ?? []) {
            const key = this.assembler.checkDoc(doc.docKey, doc.data);
            if (!key.ok) return key;
            if (seen.has(key.value)) {
                return err(DomainError.unprocessable(`document "${key.value}" is listed twice`, { docKey: key.value }));
            }
            seen.add(key.value);
            entries.push({ docKey: key.value, data: doc.data });
        }
        const evaluated = this.assembler.evaluate(input.start, entries);
        if (!evaluated.ok) return evaluated;

        const now = this.clock.now();
        const project = Project.create({
            id: asProjectId(this.ids.newId()),
            workspaceId: input.workspaceId,
            name: name.value,
            start: input.start,
            summary: evaluated.value.summary,
            createdBy: input.userId,
            now,
        });
        const docs = entries.map(e => ProjectDoc.write({
            projectId: project.id,
            workspaceId: project.workspaceId,
            docKey: e.docKey,
            data: e.data,
            baseVersion: 0,
            updatedBy: input.userId,
            now,
        }));

        await this.uow.run(async () => {
            await this.projects.insert(project);
            if (docs.length > 0) await this.docs.insertMany(docs);
            await this.activity.append(ActivityEntry.record({
                workspaceId: project.workspaceId, projectId: project.id, userId: input.userId, action: 'project.created', at: now,
            }));
        });
        return ok({ project, docs });
    }
}
