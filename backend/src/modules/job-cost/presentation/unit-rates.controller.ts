import { Controller, Get, Param, Query } from '@nestjs/common';
import { type UnitRatesDto, type UnitRatesQuery, unitRatesQuerySchema } from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { GetUnitRatesUseCase } from '../application/unit-rates';

/** The unit rate history lives in job-cost but is written by the closeout, so it follows the `handover` module. */
@Controller()
@RequiresModule('handover')
export class UnitRatesController {
    constructor(private readonly unitRates: GetUnitRatesUseCase) {}

    @Get('workspaces/:workspaceId/unit-rates')
    async list(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(unitRatesQuerySchema)) query: UnitRatesQuery,
    ): Promise<UnitRatesDto> {
        return unwrap(await this.unitRates.execute(user.userId, unwrap(parseId<'WorkspaceId'>(workspaceId, 'Workspace')), query));
    }
}
