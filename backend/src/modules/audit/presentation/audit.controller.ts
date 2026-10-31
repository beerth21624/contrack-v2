import { Controller, Get, Param, Query } from '@nestjs/common';
import { type AuditEventDto, type AuditListDto, type AuditListQuery, auditListQuerySchema } from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { type AuditEventView, ListAuditEventsUseCase } from '../application/use-cases/list-audit-events.use-case';

const toDto = (e: AuditEventView): AuditEventDto => ({
    id: e.id.toString(),
    workspaceId: e.workspaceId,
    projectId: e.projectId,
    actorUserId: e.actor,
    actorName: e.actorName,
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    data: e.data,
    at: e.at.toISOString(),
});

@Controller('workspaces/:workspaceId/audit')
@RequiresModule('project-hub')
export class AuditController {
    constructor(private readonly listEvents: ListAuditEventsUseCase) {}

    @Get()
    async list(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') raw: string,
        @Query(new ZodPipe(auditListQuerySchema)) query: AuditListQuery,
    ): Promise<AuditListDto> {
        const workspaceId = unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));
        const page = unwrap(await this.listEvents.execute({
            userId: user.userId, workspaceId, entityType: query.entityType, entityId: query.entityId, before: query.before, limit: query.limit,
        }));
        return { items: page.items.map(toDto), nextBefore: page.nextBefore };
    }
}
