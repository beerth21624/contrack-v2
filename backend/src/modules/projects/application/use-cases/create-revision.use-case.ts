import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator, RevisionHooks, UnitOfWork } from '../../../../shared/application/ports';
import {
    DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, asRevisionId, err, ok,
} from '../../../../shared/domain';
import { ActivityEntry } from '../../domain/entities/activity-entry.entity';
import { Revision } from '../../domain/entities/revision.entity';
import { ProjectAssembler } from '../../domain/services/project-assembler.service';
import { RevisionLabel, revisionNote } from '../../domain/value-objects/revision-label.value-object';
import { ProjectAccess } from '../project-access';
import { ActivityRepository } from '../ports/activity.repository';
import { ProjectDocRepository } from '../ports/project-doc.repository';
import { ProjectRepository } from '../ports/project.repository';
import { RevisionRepository } from '../ports/revision.repository';

export interface CreateRevisionInput {
    userId: UserId;
    projectId: ProjectId;
    label: string;
    note?: string;
}

@Injectable()
export class CreateRevisionUseCase {
    constructor(
        private readonly access: ProjectAccess,
        private readonly projects: ProjectRepository,
        private readonly docs: ProjectDocRepository,
        private readonly revisions: RevisionRepository,
        private readonly activity: ActivityRepository,
        private readonly assembler: ProjectAssembler,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
        /** Core registry (the default keeps hand-built test kits working: no hook). */
        private readonly hooks: RevisionHooks = new RevisionHooks(),
    ) {}

    async execute(input: CreateRevisionInput): Promise<Result<Revision, DomainError>> {
        const granted = await this.access.toProject(input.userId, input.projectId, 'revisions.create');
        if (!granted.ok) return granted;
        return this.createIn(granted.value.project.workspaceId, input.projectId, input);
    }

    /**
     * The revision itself, without the permission check (RevisionWriter for other modules). Joins the caller's
     * transaction when there is one; the registered RevisionHooks run after the insert, inside it.
     */
    async createIn(
        workspaceId: WorkspaceId, projectId: ProjectId, input: { userId: UserId; label: string; note?: string },
    ): Promise<Result<Revision, DomainError>> {
        const label = RevisionLabel.create(input.label);
        if (!label.ok) return label;
        const note = revisionNote(input.note);
        if (!note.ok) return note;

        return this.uow.run(async (): Promise<Result<Revision, DomainError>> => {
            // Locked: no document write can slip between reading the documents and taking the totals.
            const project = await this.projects.lockForUpdate(workspaceId, projectId);
            if (project === undefined) return err(DomainError.notFound('Project'));
            const docs = await this.docs.listByProject(workspaceId, project.id);
            const evaluated = this.assembler.evaluate(project.start, docs.map(d => d.toEntry()));
            if (!evaluated.ok) return evaluated;

            const now = this.clock.now();
            const revision = Revision.create({
                id: asRevisionId(this.ids.newId()),
                projectId: project.id,
                workspaceId,
                label: label.value,
                note: note.value,
                snapshot: this.assembler.snapshot(evaluated.value.project),
                // Recomputed from exactly the snapshot (equals the stored summary, which PutDoc keeps current).
                totals: evaluated.value.summary,
                createdBy: input.userId,
                now,
            });
            if (await this.revisions.insert(revision) === 'label_taken') {
                return err(DomainError.conflict(`A revision labelled "${label.value.value}" already exists`, { label: label.value.value }));
            }
            await this.activity.append(ActivityEntry.record({
                workspaceId, projectId: project.id, userId: input.userId, action: 'revision.created', at: now,
            }));
            await this.hooks.run({
                id: revision.id, workspaceId, projectId: project.id, label: revision.label, note: revision.note,
                createdBy: revision.createdBy, createdAt: revision.createdAt, snapshot: revision.snapshot,
            });
            return ok(revision);
        });
    }
}
