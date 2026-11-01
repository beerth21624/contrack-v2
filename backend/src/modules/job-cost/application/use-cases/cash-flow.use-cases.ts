// ─── Cash flow use cases (WP-47): project / company cash flow, company cash settings ───
import { Injectable } from '@nestjs/common';
import type { CashFlowDto, CashFlowQuery, CashSettingsDto, PutCashSettingsRequest } from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { round2 } from '@contrack/domain/money';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { AuditLog, Clock, ProjectCatalog, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, ok } from '../../../../shared/domain/result';
import { CashFlowEngine, settingsDto } from '../cash-flow.service';
import { MODULE, transact } from '../job-cost.service';
import { JobCostRepository } from '../ports/job-cost.repository';

/** GET /projects/:projectId/cash-flow?weeks=&pastWeeks= — `cost.read`. */
@Injectable()
export class GetProjectCashFlowUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly engine: CashFlowEngine,
        private readonly catalog: ProjectCatalog,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, projectId: ProjectId, query: CashFlowQuery): Promise<Result<CashFlowDto, DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['cost.read'], write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const name = (await this.catalog.find(ws, projectId))?.name ?? '';
        const today = bangkokToday(this.clock.now());
        return ok(await this.engine.project(ws, projectId, name, { today, weeks: query.weeks, pastWeeks: query.pastWeeks }));
    }
}

/** GET /workspaces/:workspaceId/cash-flow?weeks=13&pastWeeks= — `cost.read`: every live project + money without a project. */
@Injectable()
export class GetCompanyCashFlowUseCase {
    constructor(private readonly access: ModuleAccess, private readonly engine: CashFlowEngine, private readonly clock: Clock) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: CashFlowQuery): Promise<Result<CashFlowDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, 'cost.read');
        if (!grant.ok) return grant;
        const today = bangkokToday(this.clock.now());
        const { dto } = await this.engine.company(workspaceId, { today, weeks: query.weeks, pastWeeks: query.pastWeeks });
        return ok(dto);
    }
}

/** GET /workspaces/:workspaceId/cash-settings — `cost.read`. */
@Injectable()
export class GetCashSettingsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: JobCostRepository) {}

    async execute(userId: UserId, workspaceId: WorkspaceId): Promise<Result<CashSettingsDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, 'cost.read');
        if (!grant.ok) return grant;
        return ok(settingsDto(await this.repo.cashSettings(workspaceId)));
    }
}

/** PUT /workspaces/:workspaceId/cash-settings — `cost.manage`; audited (`cash_settings` / `update`). */
@Injectable()
export class PutCashSettingsUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: JobCostRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, body: PutCashSettingsRequest): Promise<Result<CashSettingsDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, 'cost.manage');
        if (!grant.ok) return grant;
        const record = {
            workspaceId, openingBalance: round2(body.openingBalance), asOf: body.asOf, minBalance: round2(body.minBalance),
            updatedBy: userId, updatedAt: this.clock.now(),
        };
        const saved = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const before = await this.repo.cashSettings(workspaceId);
            await this.repo.saveCashSettings(record);
            await this.audit.record({
                workspaceId, projectId: null, actor: userId, entityType: 'cash_settings', entityId: workspaceId, action: 'update',
                data: {
                    openingBalance: [before?.openingBalance ?? null, record.openingBalance],
                    asOf: [before?.asOf ?? null, record.asOf],
                    minBalance: [before?.minBalance ?? null, record.minBalance],
                },
            });
            return ok(undefined);
        });
        if (!saved.ok) return saved;
        return ok(settingsDto(record));
    }
}
