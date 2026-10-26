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
import { RateCardsModule } from './modules/rate-cards/rate-cards.module';

@Module({})
export class AppModule {
    static forRoot(options: CoreOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [CoreModule.forRoot(options), IdentityModule, WorkspacesModule, ProjectsModule, RealtimeModule, RateCardsModule],
            controllers: [HealthController],
            providers: [
                { provide: APP_GUARD, useClass: AuthGuard },
                { provide: APP_FILTER, useClass: ErrorFilter },
            ],
        };
    }
}
