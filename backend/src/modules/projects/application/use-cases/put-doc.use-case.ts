// ─── PutDoc: the one way a project's data changes ───
// Optimistic concurrency per document (baseVersion), the project row locked per write so the stored summary is
// always the shared engine's result for the latest documents, and realtime only after COMMIT.
import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError, type ProjectId, type Result, type UserId, err, ok } from '../../../../shared/domain';
import { ActivityEntry } from '../../domain/entities/activity-entry.entity';
import { ProjectDoc } from '../../domain/entities/project-doc.entity';
import type { Project } from '../../domain/entities/project.entity';
import { ProjectAssembler } from '../../domain/services/project-assembler.service';
import { ProjectAccess } from '../project-access';
import { versionConflict } from '../project-dto.mapper';
import { ProjectEvents } from '../project-events';
import { ActivityRepository } from '../ports/activity.repository';
import { ProjectDocRepository } from '../ports/project-doc.repository';
import { ProjectRepository } from '../ports/project.repository';

export interface PutDocInput {
    userId: UserId;
    projectId: ProjectId;
    docKey: string;
    /** null = reset the document to its default. */
    data: unknown;
    /** Version the client edited; 0 when the document does not exist yet. */
    baseVersion: number;
}

export interface PutDocOutput {
    doc: ProjectDoc;
    project: Project;
}

const archived = (): DomainError => DomainError.conflict('The project is archived; restore it to edit');

@Injectable()
export class PutDocUseCase {
    constructor(
        private readonly access: ProjectAccess,
        private readonly projects: ProjectRepository,
        private readonly docs: ProjectDocRepository,
        private readonly activity: ActivityRepository,
        private readonly assembler: ProjectAssembler,
        private readonly events: ProjectEvents,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: PutDocInput): Promise<Result<PutDocOutput, DomainError>> {
        // 1–2. who, and which project (in the caller's workspace)
        const granted = await this.access.toProject(input.userId, input.projectId, 'projects.edit');
        if (!granted.ok) return granted;
        const { workspaceId } = granted.value.project;
        if (granted.value.project.isArchived) return err(archived());

        // 3. the document on its own: key, size, shape
        if (!Number.isSafeInteger(input.baseVersion) || input.baseVersion < 0) {
            return err(DomainError.validation('baseVersion must be a non-negative integer'));
        }
        const checked = this.assembler.checkDoc(input.docKey, input.data);
        if (!checked.ok) return checked;
        const docKey = checked.value;

        // 4. in one transaction, with the project locked
        const outcome = await this.uow.run(async (): Promise<Result<PutDocOutput, DomainError>> => {
            const project = await this.projects.lockForUpdate(workspaceId, input.projectId);
            if (project === undefined) return err(DomainError.notFound('Project'));
            if (project.isArchived) return err(archived());

            const stored = await this.docs.listByProject(workspaceId, project.id);
            const current = stored.find(d => d.docKey === docKey);
            if ((current?.version ?? 0) !== input.baseVersion) return err(versionConflict(current));

            const now = this.clock.now();
            const doc = ProjectDoc.write({
                projectId: project.id,
                workspaceId,
                docKey,
                data: input.data,
                baseVersion: input.baseVersion,
                updatedBy: input.userId,
                now,
            });
            const entries = [...stored.filter(d => d.docKey !== docKey).map(d => d.toEntry()), doc.toEntry()];
            const evaluated = this.assembler.evaluate(project.start, entries);
            if (!evaluated.ok) return evaluated;

            const written = await this.docs.write(doc, input.baseVersion);
            if (written === 'conflict') {
                return err(versionConflict(await this.docs.find(workspaceId, project.id, docKey)));
            }
            project.applySummary(evaluated.value.summary, now);
            await this.projects.update(project);
            await this.activity.append(ActivityEntry.record({
                workspaceId,
                projectId: project.id,
                userId: input.userId,
                action: doc.isReset ? 'doc.reset' : 'doc.updated',
                docKey,
                at: now,
            }));
            return ok({ doc, project });
        });

        // 5. after COMMIT
        if (outcome.ok) await this.events.docUpdated(outcome.value.project, outcome.value.doc);
        return outcome;
    }
}
