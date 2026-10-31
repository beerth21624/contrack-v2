// ─── Platform services: module flags (4 layers) and entitlements, uploaded files, notifications (platform work stream) ───
// Provides ModuleFlags, FileService, Notifier, AppLinks, SweepMarks (src/shared/application/ports.ts), ModuleAccess
// (src/shared/application/module-access.ts, every ERP use case) and SmsSender (./application/ports/sms-sender.port.ts,
// used by identity for OTP codes) to every module.
// Needs WorkspaceAccess / WorkspaceDirectory (workspaces), ProjectStatusLookup (projects) and ModuleWorkRegistry (core,
// filled by the business modules) and DailySweeps (core; DailySweepsRunner runs them).
import { Global, Module } from '@nestjs/common';
import { ModuleAccess } from '../../shared/application/module-access';
import { AppLinks, FileService, ModuleFlags, Notifier, SweepMarks, WorkspaceDirectory } from '../../shared/application/ports';
import { AppConfig } from '../../shared/infrastructure/config/env';
import { persistence } from '../../shared/infrastructure/core.module';
import { FileLinkSigner } from './application/ports/file-link-signer.port';
import { FileRepository } from './application/ports/file.repository';
import { FileStorage } from './application/ports/file-storage.port';
import { LineSender } from './application/ports/line-sender.port';
import { NotificationChannels } from './application/ports/notification-channel.port';
import { NotificationDeliveryRepository } from './application/ports/notification-delivery.repository';
import { NotificationRepository } from './application/ports/notification.repository';
import { PlatformSettings } from './application/ports/platform-settings.port';
import { RecipientDirectory } from './application/ports/recipient-directory.port';
import { SmsSender } from './application/ports/sms-sender.port';
import { WorkspaceEntitlementRepository } from './application/ports/workspace-entitlement.repository';
import { WorkspaceModuleRepository } from './application/ports/workspace-module.repository';
import { PlatformAdminAccess } from './application/platform-admin-access';
import { FileLinks } from './application/services/file-links';
import { ModuleFlagCache } from './application/services/module-flag-cache';
import { TrialExpiringSweep } from './application/services/trial-expiring.sweep';
import { WorkspaceModuleStates } from './application/services/workspace-module-states';
import { DeliverQueuedUseCase } from './application/use-cases/deliver-queued.use-case';
import { GetPlatformAdminStatusUseCase } from './application/use-cases/get-platform-admin-status.use-case';
import { ListAdminWorkspacesUseCase } from './application/use-cases/list-admin-workspaces.use-case';
import { ListNotificationsUseCase } from './application/use-cases/list-notifications.use-case';
import { ListPlatformModulesUseCase } from './application/use-cases/list-platform-modules.use-case';
import { ListWorkspaceModulesUseCase } from './application/use-cases/list-workspace-modules.use-case';
import { MarkNotificationsReadUseCase } from './application/use-cases/mark-notifications-read.use-case';
import { ReadFileContentUseCase } from './application/use-cases/read-file-content.use-case';
import { SendNotificationUseCase } from './application/use-cases/send-notification.use-case';
import { SetWorkspaceModuleUseCase } from './application/use-cases/set-workspace-module.use-case';
import { SetEntitlementUseCase } from './application/use-cases/set-entitlement.use-case';
import { StartTrialUseCase } from './application/use-cases/start-trial.use-case';
import { UploadFileUseCase } from './application/use-cases/upload-file.use-case';
import { DailySweepsRunner } from './infrastructure/adapters/daily-sweeps.runner';
import { DeliveryWorker } from './infrastructure/adapters/delivery-worker';
import { DrizzleFileRepository } from './infrastructure/adapters/drizzle-file.repository';
import { DrizzleNotificationDeliveryRepository } from './infrastructure/adapters/drizzle-notification-delivery.repository';
import { DrizzleNotificationRepository } from './infrastructure/adapters/drizzle-notification.repository';
import { DrizzleRecipientDirectory } from './infrastructure/adapters/drizzle-recipient-directory.adapter';
import { DrizzleWorkspaceEntitlementRepository } from './infrastructure/adapters/drizzle-workspace-entitlement.repository';
import { DrizzleWorkspaceModuleRepository } from './infrastructure/adapters/drizzle-workspace-module.repository';
import { RepositoryFileService } from './infrastructure/adapters/file-service.adapter';
import { InMemoryFileStorage, LocalDiskFileStorage } from './infrastructure/adapters/file-storage.adapter';
import { HmacFileLinkSigner } from './infrastructure/adapters/hmac-file-link-signer.adapter';
import { InMemoryFileRepository } from './infrastructure/adapters/in-memory-file.repository';
import { InMemoryNotificationDeliveryRepository } from './infrastructure/adapters/in-memory-notification-delivery.repository';
import { InMemoryNotificationRepository } from './infrastructure/adapters/in-memory-notification.repository';
import { InMemoryRecipientDirectory } from './infrastructure/adapters/in-memory-recipient-directory.adapter';
import { InMemoryWorkspaceEntitlementRepository } from './infrastructure/adapters/in-memory-workspace-entitlement.repository';
import { InMemoryWorkspaceModuleRepository } from './infrastructure/adapters/in-memory-workspace-module.repository';
import { LoggingLineSender } from './infrastructure/adapters/logging-line-sender.adapter';
import { RepositoryModuleFlags } from './infrastructure/adapters/module-flags.adapter';
import { SenderNotificationChannels } from './infrastructure/adapters/notification-channels.adapter';
import { ConfigAppLinks, UseCaseNotifier } from './infrastructure/adapters/notifier.adapter';
import { ConsoleSmsSender, ThaiBulkSmsSender } from './infrastructure/adapters/sms-sender.adapter';
import { DrizzleSweepMarks, InMemorySweepMarks } from './infrastructure/adapters/sweep-marks.adapter';
import { FilesController } from './presentation/files.controller';
import { PlatformModulesController, WorkspaceModulesController } from './presentation/modules.controller';
import { PlatformAdminController } from './presentation/platform-admin.controller';
import { NotificationsController } from './presentation/notifications.controller';
import { RecordingSmsSender } from './testing/recording-sms-sender';

/** NODE_ENV=test: recorded (tests read OTP codes); else SMS_PROVIDER. */
function smsSender(config: AppConfig): SmsSender {
    const env = config.env;
    if (env.NODE_ENV === 'test') return new RecordingSmsSender();
    if (env.SMS_PROVIDER === 'thaibulksms' && env.SMS_API_KEY !== undefined && env.SMS_API_SECRET !== undefined) {
        return new ThaiBulkSmsSender(env.SMS_API_KEY, env.SMS_API_SECRET, env.SMS_SENDER);
    }
    return new ConsoleSmsSender();
}

@Global()
@Module({
    controllers: [PlatformModulesController, PlatformAdminController, WorkspaceModulesController, FilesController, NotificationsController],
    providers: [
        {
            provide: PlatformSettings,
            inject: [AppConfig],
            useFactory: (config: AppConfig): PlatformSettings =>
                new PlatformSettings(config.modulesEnabled, config.env.PUBLIC_APP_URL, config.entitlements),
        },
        persistence(WorkspaceModuleRepository, () => new InMemoryWorkspaceModuleRepository(), ctx => new DrizzleWorkspaceModuleRepository(ctx)),
        persistence(
            WorkspaceEntitlementRepository,
            () => new InMemoryWorkspaceEntitlementRepository(),
            ctx => new DrizzleWorkspaceEntitlementRepository(ctx),
        ),
        persistence(FileRepository, () => new InMemoryFileRepository(), ctx => new DrizzleFileRepository(ctx)),
        persistence(NotificationRepository, () => new InMemoryNotificationRepository(), ctx => new DrizzleNotificationRepository(ctx)),
        persistence(
            NotificationDeliveryRepository,
            () => new InMemoryNotificationDeliveryRepository(),
            ctx => new DrizzleNotificationDeliveryRepository(ctx),
        ),
        // Memory mode has no tables to read: workspace members come from the workspaces module (everyone reads Thai).
        persistence(RecipientDirectory, (dir: WorkspaceDirectory) => new InMemoryRecipientDirectory(ws => dir.memberIds(ws)),
            ctx => new DrizzleRecipientDirectory(ctx), [WorkspaceDirectory]),
        persistence(SweepMarks, () => new InMemorySweepMarks(), ctx => new DrizzleSweepMarks(ctx)),
        {
            provide: FileStorage,
            inject: [AppConfig],
            useFactory: (config: AppConfig): FileStorage => (config.env.FILE_STORAGE === 'memory' || config.persistence === 'memory'
                ? new InMemoryFileStorage()
                : new LocalDiskFileStorage(config.env.FILE_STORAGE_DIR)),
        },
        {
            provide: FileLinkSigner,
            inject: [AppConfig],
            useFactory: (config: AppConfig): FileLinkSigner => new HmacFileLinkSigner(config.env.JWT_ACCESS_SECRET, config.env.FILE_URL_TTL_SECONDS),
        },
        { provide: SmsSender, inject: [AppConfig], useFactory: smsSender },
        {
            provide: LineSender,
            inject: [AppConfig],
            useFactory: (config: AppConfig): LineSender => new LoggingLineSender(config.env.LINE_CHANNEL_ACCESS_TOKEN),
        },
        {
            provide: NotificationChannels,
            inject: [SmsSender, LineSender],
            useFactory: (sms: SmsSender, line: LineSender): NotificationChannels => new SenderNotificationChannels(sms, line),
        },
        ModuleFlagCache,
        WorkspaceModuleStates,
        FileLinks,
        ListPlatformModulesUseCase,
        ListWorkspaceModulesUseCase,
        SetWorkspaceModuleUseCase,
        StartTrialUseCase,
        PlatformAdminAccess,
        GetPlatformAdminStatusUseCase,
        ListAdminWorkspacesUseCase,
        SetEntitlementUseCase,
        UploadFileUseCase,
        ReadFileContentUseCase,
        ListNotificationsUseCase,
        MarkNotificationsReadUseCase,
        SendNotificationUseCase,
        DeliverQueuedUseCase,
        DeliveryWorker,
        TrialExpiringSweep,
        DailySweepsRunner,
        { provide: ModuleFlags, useClass: RepositoryModuleFlags },
        ModuleAccess,
        { provide: FileService, useClass: RepositoryFileService },
        { provide: Notifier, useClass: UseCaseNotifier },
        { provide: AppLinks, inject: [PlatformSettings], useFactory: (s: PlatformSettings): AppLinks => new ConfigAppLinks(s.publicAppUrl) },
    ],
    exports: [ModuleFlags, ModuleAccess, FileService, Notifier, AppLinks, SmsSender, SweepMarks],
})
export class PlatformModule {}
