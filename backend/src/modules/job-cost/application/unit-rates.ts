// ─── Unit rate history (WP-55): the closeout writes actual unit rates per line key, the BOQ page reads the averages ───
import { Injectable } from '@nestjs/common';
import { UNIT_RATE_HISTORY_PROJECTS, type UnitRatesDto, type UnitRatesQuery } from '@contrack/contract';
import { averageUnitRates } from '@contrack/domain/job-cost/unit-rates';
import { ModuleAccess } from '../../../shared/application/module-access';
import { IdGenerator, type UnitRateObservation, UnitRateHistory } from '../../../shared/application/ports';
import type { DomainError } from '../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../shared/domain/ids';
import { type Result, ok } from '../../../shared/domain/result';
import { JobCostRepository } from './ports/job-cost.repository';

/** Most observations one read looks at (newest first). */
const READ_LIMIT = 20_000;

@Injectable()
export class RepositoryUnitRateHistory extends UnitRateHistory {
    constructor(private readonly repo: JobCostRepository, private readonly ids: IdGenerator) {
        super();
    }

    async record(workspaceId: WorkspaceId, projectId: ProjectId, observedDate: string, rows: readonly UnitRateObservation[]): Promise<void> {
        await this.repo.replaceUnitRates(workspaceId, projectId, rows.map(r => ({
            id: this.ids.newId(), workspaceId, projectId, lineKey: r.lineKey, descTh: r.descTh, unit: r.unit, qty: r.qty,
            actualMatUnit: r.actualMatUnit, actualLabUnit: r.actualLabUnit, observedDate,
        })));
    }
}

/**
 * GET /workspaces/:workspaceId/unit-rates?lineKeys= — `cost.read`, module `handover` (the closeout writes them): per line
 * key the mean of the latest 3 projects.
 */
@Injectable()
export class GetUnitRatesUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: JobCostRepository) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: UnitRatesQuery): Promise<Result<UnitRatesDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, 'handover', 'cost.read');
        if (!grant.ok) return grant;
        const rows = await this.repo.unitRates(workspaceId, query.lineKeys, READ_LIMIT);
        return ok({ items: averageUnitRates(rows, UNIT_RATE_HISTORY_PROJECTS) });
    }
}
