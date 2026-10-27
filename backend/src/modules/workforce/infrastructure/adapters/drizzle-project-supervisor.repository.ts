import { and, asc, eq } from 'drizzle-orm';
import { asPersonId, type PersonId, type ProjectId, type WorkspaceId } from '../../../../shared/domain';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { projectSupervisors } from '../../../../shared/infrastructure/database/schema';
import { ProjectSupervisorRepository } from '../../application/ports/project-supervisor.repository';

export class DrizzleProjectSupervisorRepository extends ProjectSupervisorRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async list(workspaceId: WorkspaceId, projectId: ProjectId): Promise<PersonId[]> {
        const rows = await this.ctx.executor.select({ personId: projectSupervisors.personId }).from(projectSupervisors)
            .where(and(eq(projectSupervisors.workspaceId, workspaceId), eq(projectSupervisors.projectId, projectId)))
            .orderBy(asc(projectSupervisors.position));
        return rows.map(r => asPersonId(r.personId));
    }

    async replace(workspaceId: WorkspaceId, projectId: ProjectId, personIds: readonly PersonId[]): Promise<void> {
        await this.ctx.transaction(async () => {
            await this.deleteByProject(workspaceId, projectId);
            const ids = [...new Set(personIds)];
            if (ids.length === 0) return;
            await this.ctx.executor.insert(projectSupervisors)
                .values(ids.map((personId, position) => ({ projectId, workspaceId, personId, position })));
        });
    }

    async removePerson(workspaceId: WorkspaceId, personId: PersonId): Promise<void> {
        await this.ctx.executor.delete(projectSupervisors)
            .where(and(eq(projectSupervisors.workspaceId, workspaceId), eq(projectSupervisors.personId, personId)));
    }

    async deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        await this.ctx.executor.delete(projectSupervisors)
            .where(and(eq(projectSupervisors.workspaceId, workspaceId), eq(projectSupervisors.projectId, projectId)));
    }
}
