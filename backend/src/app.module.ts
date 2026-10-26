import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CoreModule, type CoreOptions } from './shared/infrastructure/core.module';
import { AuthGuard } from './shared/presentation/auth';
import { ErrorFilter } from './shared/presentation/http';
import { HealthController } from './shared/presentation/health.controller';
import { ModuleGuard, PlatformController } from './shared/presentation/modules';
import { IdentityModule } from './modules/identity/identity.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RateCardsModule } from './modules/rate-cards/rate-cards.module';
import { WorkforceModule } from './modules/workforce/workforce.module';

@Module({})
export class AppModule {
    static forRoot(options: CoreOptions): DynamicModule {
        return {
            module: AppModule,
            // Business modules are always loaded (a project's deletion still removes their rows while they are off);
            // ModuleGuard answers 404 `module_disabled` on their routes when MODULES_ENABLED leaves them out.
            imports: [
                CoreModule.forRoot(options), IdentityModule, WorkspacesModule, ProjectsModule, RealtimeModule, RateCardsModule,
                WorkforceModule,
            ],
            controllers: [HealthController, PlatformController],
            providers: [
                // Global guards run in this order: a switched-off module answers before authentication.
                { provide: APP_GUARD, useClass: ModuleGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
                { provide: APP_FILTER, useClass: ErrorFilter },
            ],
        };
    }
}
