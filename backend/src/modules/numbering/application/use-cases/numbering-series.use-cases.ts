import { Injectable } from '@nestjs/common';
import { DOC_TYPES, type DocType, type PutNumberingSeriesRequest } from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { validatePattern } from '@contrack/domain/erp/numbering';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { AuditLog, Clock, UnitOfWork } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { type NumberingSeries, effectiveSeries, seriesChanged, seriesPeriodKey } from '../../domain/numbering-series';
import { RepositoryDocumentNumbering } from '../../infrastructure/adapters/document-numbering.adapter';
import { NumberingRepository } from '../ports/numbering.repository';

export interface NumberingSeriesView extends NumberingSeries {
    nextNumber: string;
    periodKey: string;
    issuedInPeriod: number;
}

/** Shared by list and put: the series with today's period, its count and the next number (nothing reserved). */
async function viewOf(
    repo: NumberingRepository, numbering: RepositoryDocumentNumbering, workspaceId: WorkspaceId, series: NumberingSeries, today: string,
): Promise<NumberingSeriesView> {
    const periodKey = seriesPeriodKey(series, today);
    return {
        ...series,
        periodKey,
        issuedInPeriod: await repo.countInPeriod(workspaceId, series.docType, periodKey),
        nextNumber: await numbering.previewOf(workspaceId, series, today),
    };
}

/** GET /workspaces/:workspaceId/numbering: `project-hub` active, `company.read`; every document type in order. */
@Injectable()
export class ListNumberingSeriesUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: NumberingRepository,
        private readonly numbering: RepositoryDocumentNumbering,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId): Promise<Result<NumberingSeriesView[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, 'project-hub', 'company.read');
        if (!grant.ok) return grant;
        const today = bangkokToday(this.clock.now());
        const saved = new Map((await this.repo.listSeries(workspaceId)).map(s => [s.docType, s]));
        const out: NumberingSeriesView[] = [];
        for (const docType of DOC_TYPES) {
            out.push(await viewOf(this.repo, this.numbering, workspaceId, effectiveSeries(docType, saved.get(docType)), today));
        }
        return ok(out);
    }
}

export interface PutNumberingSeriesInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    docType: DocType;
    body: PutNumberingSeriesRequest;
}

/**
 * PUT /workspaces/:workspaceId/numbering/:docType: `project-hub` active, `company.manage`. Pattern problems → 422
 * `invalid_pattern`; any change while today's period (old or new reset) already has numbers → 409
 * `period_has_documents`. Audited as `numbering_series` / `set` with the changed fields.
 */
@Injectable()
export class PutNumberingSeriesUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: NumberingRepository,
        private readonly numbering: RepositoryDocumentNumbering,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: PutNumberingSeriesInput): Promise<Result<NumberingSeriesView, DomainError>> {
        const grant = await this.access.inWorkspace(input.userId, input.workspaceId, 'project-hub', 'company.manage');
        if (!grant.ok) return grant;
        const next = { prefix: input.body.prefix.trim(), pattern: input.body.pattern.trim(), reset: input.body.reset, yearStyle: input.body.yearStyle };
        const problems = validatePattern(next.pattern, next.reset);
        if (problems.length > 0) return err(DomainError.unprocessable('The number pattern is not valid', { reason: 'invalid_pattern', problems }));
        const now = this.clock.now();
        const today = bangkokToday(now);
        const saved = await this.uow.run(async (): Promise<Result<NumberingSeries, DomainError>> => {
            const before = effectiveSeries(input.docType, await this.repo.findSeries(input.workspaceId, input.docType));
            if (!seriesChanged(before, next)) return ok(before);
            const periods = new Set([seriesPeriodKey(before, today), seriesPeriodKey({ ...before, ...next }, today)]);
            for (const periodKey of periods) {
                if (await this.repo.countInPeriod(input.workspaceId, input.docType, periodKey) > 0) {
                    return err(DomainError.conflict('Documents were already numbered in the current period', { reason: 'period_has_documents', periodKey }));
                }
            }
            await this.repo.saveSeries(input.workspaceId, { docType: input.docType, ...next, updatedBy: input.userId, updatedAt: now });
            const changed: Record<string, unknown> = {};
            for (const key of ['prefix', 'pattern', 'reset', 'yearStyle'] as const) {
                if (before[key] !== next[key]) changed[key] = [before[key], next[key]];
            }
            await this.audit.record({
                workspaceId: input.workspaceId, projectId: null, actor: input.userId,
                entityType: 'numbering_series', entityId: input.docType, action: 'set', data: changed,
            });
            return ok({ docType: input.docType, ...next, isDefault: false, updatedBy: input.userId, updatedAt: now });
        });
        if (!saved.ok) return saved;
        return ok(await viewOf(this.repo, this.numbering, input.workspaceId, saved.value, today));
    }
}
