import { Controller, Get, Param, Query } from '@nestjs/common';
import {
    type TaxReportDto, type TaxReportKind, type TaxReportQuery, type TaxReportSummaryDto, taxReportQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { TaxReportsUseCase } from '../application/use-cases/tax-reports.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

/** Monthly tax reports from fin_events (WP-52): `?month=YYYY-MM`, permission `tax.reports`. */
@Controller('workspaces/:workspaceId/tax-reports')
@RequiresModule('payables')
export class TaxReportsController {
    constructor(private readonly reports: TaxReportsUseCase) {}

    private async one(user: AuthenticatedUser, workspaceId: string, kind: TaxReportKind, query: TaxReportQuery): Promise<TaxReportDto> {
        return unwrap(await this.reports.report(user.userId, workspaceIdParam(workspaceId), kind, query.month));
    }

    @Get('output-vat')
    outputVat(
        @CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(taxReportQuerySchema)) query: TaxReportQuery,
    ): Promise<TaxReportDto> {
        return this.one(user, workspaceId, 'output-vat', query);
    }

    @Get('input-vat')
    inputVat(
        @CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(taxReportQuerySchema)) query: TaxReportQuery,
    ): Promise<TaxReportDto> {
        return this.one(user, workspaceId, 'input-vat', query);
    }

    @Get('pnd3')
    pnd3(
        @CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(taxReportQuerySchema)) query: TaxReportQuery,
    ): Promise<TaxReportDto> {
        return this.one(user, workspaceId, 'pnd3', query);
    }

    @Get('pnd53')
    pnd53(
        @CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(taxReportQuerySchema)) query: TaxReportQuery,
    ): Promise<TaxReportDto> {
        return this.one(user, workspaceId, 'pnd53', query);
    }

    @Get('wht-received')
    whtReceived(
        @CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(taxReportQuerySchema)) query: TaxReportQuery,
    ): Promise<TaxReportDto> {
        return this.one(user, workspaceId, 'wht-received', query);
    }

    @Get('summary')
    async summary(
        @CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(taxReportQuerySchema)) query: TaxReportQuery,
    ): Promise<TaxReportSummaryDto> {
        return unwrap(await this.reports.summary(user.userId, workspaceIdParam(workspaceId), query.month));
    }
}
