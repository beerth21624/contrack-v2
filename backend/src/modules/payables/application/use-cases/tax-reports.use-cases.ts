// ─── Tax report use cases (docs/erp/04-implementation-plan.md WP-52): `tax.reports` in a workspace with `payables` on ───
import { Injectable } from '@nestjs/common';
import { type TaxReportDto, type TaxReportKind, type TaxReportSummaryDto, taxMonthRange } from '@contrack/contract';
import { round2 } from '@contrack/domain/money';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { type FinEvent, FinancialEvents } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import { MODULE } from '../payables.service';
import { READS_ALL_DATES, REPORT_EVENT_TYPES, buildTaxReport } from '../tax-reports';

export const TAX_REPORTS = 'tax.reports' as const;

@Injectable()
export class TaxReportsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly events: FinancialEvents) {}

    /** The events a report reads: from the first day of the month on (later reversals mark their original), or all for input VAT. */
    private async load(workspaceId: WorkspaceId, kind: TaxReportKind, month: string): Promise<FinEvent[]> {
        const { from } = taxMonthRange(month);
        return this.events.list(workspaceId, { from: READS_ALL_DATES[kind] ? undefined : from, types: REPORT_EVENT_TYPES[kind] });
    }

    async report(userId: UserId, workspaceId: WorkspaceId, kind: TaxReportKind, month: string): Promise<Result<TaxReportDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, TAX_REPORTS);
        if (!grant.ok) return grant;
        return ok(buildTaxReport(kind, month, await this.load(workspaceId, kind, month)));
    }

    async summary(userId: UserId, workspaceId: WorkspaceId, month: string): Promise<Result<TaxReportSummaryDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, TAX_REPORTS);
        if (!grant.ok) return grant;
        const { from, to } = taxMonthRange(month);
        const sinceMonth = await this.events.list(workspaceId, {
            from, types: [...REPORT_EVENT_TYPES['output-vat'], ...REPORT_EVENT_TYPES.pnd3, ...REPORT_EVENT_TYPES['wht-received']],
        });
        const bills = await this.events.list(workspaceId, { types: REPORT_EVENT_TYPES['input-vat'] });
        const outputVat = buildTaxReport('output-vat', month, sinceMonth).totals;
        const inputVat = buildTaxReport('input-vat', month, bills).totals;
        return ok({
            month, from, to, outputVat, inputVat, vatPayable: round2(outputVat.vat - inputVat.vat),
            pnd3: buildTaxReport('pnd3', month, sinceMonth).totals,
            pnd53: buildTaxReport('pnd53', month, sinceMonth).totals,
            whtReceived: buildTaxReport('wht-received', month, sinceMonth).totals,
        });
    }
}
