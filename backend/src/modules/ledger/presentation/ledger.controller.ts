import { Controller, Get, Param, Query } from '@nestjs/common';
import {
    type CostLedgerDto, type CostLedgerQuery, type FinEventDto, type FinEventListQuery, costLedgerQuerySchema, finEventListQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { GetCostLedgerUseCase, ListFinEventsUseCase } from '../application/use-cases/ledger.use-cases';

@Controller()
@RequiresModule('project-hub')
export class LedgerController {
    constructor(private readonly getLedger: GetCostLedgerUseCase, private readonly listEvents: ListFinEventsUseCase) {}

    @Get('projects/:projectId/cost-ledger')
    async costLedger(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Query(new ZodPipe(costLedgerQuerySchema)) query: CostLedgerQuery,
    ): Promise<CostLedgerDto> {
        const id: ProjectId = unwrap(parseId<'ProjectId'>(projectId, 'Project'));
        return unwrap(await this.getLedger.execute(user.userId, id, query));
    }

    @Get('workspaces/:workspaceId/fin-events')
    async finEvents(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(finEventListQuerySchema)) query: FinEventListQuery,
    ): Promise<FinEventDto[]> {
        const id: WorkspaceId = unwrap(parseId<'WorkspaceId'>(workspaceId, 'Workspace'));
        return unwrap(await this.listEvents.execute(user.userId, id, query));
    }
}
