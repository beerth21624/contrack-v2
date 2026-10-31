// ─── Cost ledger + financial events (ERP foundation `ledger`, WP-20, docs/erp/02-domain-model.md §1.11) ───
// Provides CostLedger and FinancialEvents (append-only, written inside the caller's transaction) to every ERP module;
// read routes gated by `project-hub`. Guards: a project with financial events may not be deleted; a baseline with
// ledger rows may not be unlocked (both whatever the module flags: money already recorded must be kept).
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import {
    BaselineUnlockGuards, CostLedger, FinancialEvents, ProjectDeletionGuards, ProjectDependents,
} from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { FinancialEventsService, LedgerService } from './application/ledger.services';
import { CostLedgerRepository, FinEventRepository } from './application/ports/ledger.repository';
import { GetCostLedgerUseCase, ListFinEventsUseCase } from './application/use-cases/ledger.use-cases';
import { DrizzleCostLedgerRepository, DrizzleFinEventRepository } from './infrastructure/adapters/drizzle-ledger.repository';
import { InMemoryCostLedgerRepository, InMemoryFinEventRepository } from './infrastructure/adapters/in-memory-ledger.repository';
import { LedgerController } from './presentation/ledger.controller';

@Global()
@Module({
    controllers: [LedgerController],
    providers: [
        persistence(CostLedgerRepository, () => new InMemoryCostLedgerRepository(), ctx => new DrizzleCostLedgerRepository(ctx)),
        persistence(FinEventRepository, () => new InMemoryFinEventRepository(), ctx => new DrizzleFinEventRepository(ctx)),
        LedgerService,
        FinancialEventsService,
        { provide: CostLedger, useExisting: LedgerService },
        { provide: FinancialEvents, useExisting: FinancialEventsService },
        GetCostLedgerUseCase,
        ListFinEventsUseCase,
    ],
    exports: [CostLedger, FinancialEvents],
})
export class LedgerModule implements OnModuleInit {
    constructor(
        private readonly deletionGuards: ProjectDeletionGuards,
        private readonly unlockGuards: BaselineUnlockGuards,
        private readonly dependents: ProjectDependents,
        private readonly ledger: CostLedgerRepository,
        private readonly events: FinEventRepository,
    ) {}

    onModuleInit(): void {
        this.deletionGuards.register(async (ws, projectId) => {
            const n = await this.events.countByProject(ws, projectId);
            return n > 0 ? [{ reason: 'financial_events_exist', count: n }] : [];
        });
        this.unlockGuards.register(async (ws, projectId) => {
            const n = await this.ledger.countByProject(ws, projectId);
            return n > 0 ? [{ reason: 'ledger', count: n }] : [];
        });
        // Memory adapter: forget a deleted project's cost rows (PostgreSQL drops them with the project).
        this.dependents.register((ws, projectId) => this.ledger.deleteByProject(ws, projectId));
    }
}
