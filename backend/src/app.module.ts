import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CoreModule, type CoreOptions } from './shared/infrastructure/core.module';
import { AuthGuard } from './shared/presentation/auth';
import { ErrorFilter } from './shared/presentation/http';
import { HealthController } from './shared/presentation/health.controller';
import { IdentityModule } from './modules/identity/identity.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SubcontractingModule } from './modules/subcontracting/subcontracting.module';
import { AiAssistModule } from './modules/ai-assist/ai-assist.module';

@Module({})
export class AppModule {
    static forRoot(options: CoreOptions): DynamicModule {
        return {
            module: AppModule,
            // Business modules are always registered; each is switched on/off by flags (docs/marketplace/README.md §1).
            imports: [
                CoreModule.forRoot(options), IdentityModule, WorkspacesModule, ProjectsModule, RealtimeModule,
                PlatformModule, SubcontractingModule, AiAssistModule,
            ],
            controllers: [HealthController],
            providers: [
                { provide: APP_GUARD, useClass: AuthGuard },
                { provide: APP_FILTER, useClass: ErrorFilter },
            ],
        };
    }
}
