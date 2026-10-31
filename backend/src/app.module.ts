import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CoreModule, type CoreOptions } from './shared/infrastructure/core.module';
import { AuthGuard } from './shared/presentation/auth';
import { ErrorFilter } from './shared/presentation/http';
import { HealthController } from './shared/presentation/health.controller';
import { ModuleGuard } from './shared/presentation/modules';
import { IdentityModule } from './modules/identity/identity.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SubcontractingModule } from './modules/subcontracting/subcontracting.module';
import { AiAssistModule } from './modules/ai-assist/ai-assist.module';
import { RateCardsModule } from './modules/rate-cards/rate-cards.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { AuditModule } from './modules/audit/audit.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { CompanyModule } from './modules/company/company.module';
import { CustomersModule } from './modules/customers/customers.module';
import { NumberingModule } from './modules/numbering/numbering.module';
import { CustomerLinksModule } from './modules/customer-links/customer-links.module';
import { HubModule } from './modules/hub/hub.module';
import { BoqControlModule } from './modules/boq-control/boq-control.module';
import { LedgerModule } from './modules/ledger/ledger.module';

@Module({})
export class AppModule {
    static forRoot(options: CoreOptions): DynamicModule {
        return {
            module: AppModule,
            // Business modules are always registered; each is switched on/off by flags (docs/marketplace/README.md §1).
            // A project's deletion still removes their rows while they are off.
            imports: [
                CoreModule.forRoot(options), IdentityModule, WorkspacesModule, ProjectsModule, RealtimeModule,
                PlatformModule, SubcontractingModule, AiAssistModule, RateCardsModule, WorkforceModule, AuditModule, ApprovalsModule,
                NumberingModule,
                CompanyModule,
                CustomersModule,
                CustomerLinksModule,
                HubModule,
                BoqControlModule,
                LedgerModule,
            ],
            controllers: [HealthController],
            providers: [
                // Global guards run in this order: a switched-off module answers before authentication.
                { provide: APP_GUARD, useClass: ModuleGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
                { provide: APP_FILTER, useClass: ErrorFilter },
            ],
        };
    }
}
