// ─── Audit log (ERP foundation, docs/erp/01-architecture.md §10): append-only trail of money / status actions ───
// Provides AuditLog (src/shared/application/ports.ts) to every module; GET /workspaces/:id/audit (`audit.read`, gated by
// `project-hub`). Needs ModuleAccess (platform) and UserDirectory (identity).
import { Global, Module } from '@nestjs/common';
import { AuditLog } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { AuditEventRepository } from './application/ports/audit-event.repository';
import { ListAuditEventsUseCase } from './application/use-cases/list-audit-events.use-case';
import { RepositoryAuditLog } from './infrastructure/adapters/audit-log.adapter';
import { DrizzleAuditEventRepository } from './infrastructure/adapters/drizzle-audit-event.repository';
import { InMemoryAuditEventRepository } from './infrastructure/adapters/in-memory-audit-event.repository';
import { AuditController } from './presentation/audit.controller';

@Global()
@Module({
    controllers: [AuditController],
    providers: [
        persistence(AuditEventRepository, () => new InMemoryAuditEventRepository(), ctx => new DrizzleAuditEventRepository(ctx)),
        ListAuditEventsUseCase,
        { provide: AuditLog, useClass: RepositoryAuditLog },
    ],
    exports: [AuditLog],
})
export class AuditModule {}
