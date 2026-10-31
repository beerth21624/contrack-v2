import { Controller, Get, Param, Query } from '@nestjs/common';
import { type PriceReferenceItemDto, type PriceReferenceQuery, priceReferenceQuerySchema } from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { SearchPriceReferenceUseCase } from '../application/use-cases/search-price-reference.use-case';

@Controller()
@RequiresModule('project-hub')
export class PriceReferenceController {
    constructor(private readonly search: SearchPriceReferenceUseCase) {}

    @Get('workspaces/:workspaceId/price-reference/items')
    async items(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(priceReferenceQuerySchema)) query: PriceReferenceQuery,
    ): Promise<PriceReferenceItemDto[]> {
        const id: WorkspaceId = unwrap(parseId<'WorkspaceId'>(workspaceId, 'Workspace'));
        return unwrap(await this.search.execute(user.userId, id, query));
    }
}
