import { Controller, Get, Param, Query } from '@nestjs/common';
import { type PortalDto, type SearchHit, type SearchQuery, searchQuerySchema } from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { GetPortalUseCase, GlobalSearchUseCase } from '../application/portal.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller()
@RequiresModule('portal')
export class PortalController {
    constructor(private readonly portal: GetPortalUseCase, private readonly search: GlobalSearchUseCase) {}

    @Get('workspaces/:workspaceId/portal')
    async getPortal(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<PortalDto> {
        return unwrap(await this.portal.execute(user.userId, workspaceIdParam(workspaceId)));
    }

    @Get('workspaces/:workspaceId/search')
    async getSearch(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(searchQuerySchema)) query: SearchQuery,
    ): Promise<SearchHit[]> {
        return unwrap(await this.search.execute(user.userId, workspaceIdParam(workspaceId), query.q));
    }
}
