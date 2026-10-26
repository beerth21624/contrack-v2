// ─── Platform services: module switches, uploaded files, notifications (owned by the platform work stream) ───
// Provides ModuleFlags, FileService, Notifier, AppLinks (src/shared/application/ports.ts) and SmsSender
// (./application/ports/sms-sender.port.ts, used by identity for OTP codes) to every module.
// Needs WorkspaceAccess (workspaces) and ModuleUsage (business modules).
import { Global, Module } from '@nestjs/common';
import { AppLinks, FileService, ModuleFlags, Notifier, WorkspaceDirectory } from '../../shared/application/ports';
import { AppConfig } from '../../shared/infrastructure/config/env';
import { persistence } from '../../shared/infrastructure/core.module';
import { FileLinkSigner } from './application/ports/file-link-signer.port';
import { FileRepository } from './application/ports/file.repository';
import { FileStorage } from './application/ports/file-storage.port';
import { LineSender } from './application/ports/line-sender.port';
import { NotificationDeliveryRepository } from './application/ports/notification-delivery.repository';
import { NotificationRepository } from './application/ports/notification.repository';
import { PlatformSettings } from './application/ports/platform-settings.port';
import { RecipientDirectory } from './application/ports/recipient-directory.port';
import { SmsSender } from './application/ports/sms-sender.port';
import { WorkspaceModuleRepository } from './application/ports/workspace-module.repository';
import { FileLinks } from './application/services/file-links';
import { ModuleFlagCache } from './application/services/module-flag-cache';
import { DeliverQueuedUseCase } from './application/use-cases/deliver-queued.use-case';
import { ListNotificationsUseCase } from './application/use-cases/list-notifications.use-case';
import { ListPlatformModulesUseCase } from './application/use-cases/list-platform-modules.use-case';
import { ListWorkspaceModulesUseCase } from './application/use-cases/list-workspace-modules.use-case';
import { MarkNotificationsReadUseCase } from './application/use-cases/mark-notifications-read.use-case';
import { ReadFileContentUseCase } from './application/use-cases/read-file-content.use-case';
import { SendNotificationUseCase } from './application/use-cases/send-notification.use-case';
import { SetWorkspaceModuleUseCase } from './application/use-cases/set-workspace-module.use-case';
import { UploadFileUseCase } from './application/use-cases/upload-file.use-case';
import { DeliveryWorker } from './infrastructure/adapters/delivery-worker';
import { DrizzleFileRepository } from './infrastructure/adapters/drizzle-file.repository';
import { DrizzleNotificationDeliveryRepository } from './infrastructure/adapters/drizzle-notification-delivery.repository';
import { DrizzleNotificationRepository } from './infrastructure/adapters/drizzle-notification.repository';
import { DrizzleRecipientDirectory } from './infrastructure/adapters/drizzle-recipient-directory.adapter';
import { DrizzleWorkspaceModuleRepository } from './infrastructure/adapters/drizzle-workspace-module.repository';
import { RepositoryFileService } from './infrastructure/adapters/file-service.adapter';
import { InMemoryFileStorage, LocalDiskFileStorage } from './infrastructure/adapters/file-storage.adapter';
import { HmacFileLinkSigner } from './infrastructure/adapters/hmac-file-link-signer.adapter';
import { InMemoryFileRepository } from './infrastructure/adapters/in-memory-file.repository';
import { InMemoryNotificationDeliveryRepository } from './infrastructure/adapters/in-memory-notification-delivery.repository';
import { InMemoryNotificationRepository } from './infrastructure/adapters/in-memory-notification.repository';
import { InMemoryRecipientDirectory } from './infrastructure/adapters/in-memory-recipient-directory.adapter';
import { InMemoryWorkspaceModuleRepository } from './infrastructure/adapters/in-memory-workspace-module.repository';
import { LoggingLineSender } from './infrastructure/adapters/logging-line-sender.adapter';
import { RepositoryModuleFlags } from './infrastructure/adapters/module-flags.adapter';
import { ConfigAppLinks, UseCaseNotifier } from './infrastructure/adapters/notifier.adapter';
import { ConsoleSmsSender, ThaiBulkSmsSender } from './infrastructure/adapters/sms-sender.adapter';
import { FilesController } from './presentation/files.controller';
import { PlatformModulesController, WorkspaceModulesController } from './presentation/modules.controller';
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
    controllers: [PlatformModulesController, WorkspaceModulesController, FilesController, NotificationsController],
    providers: [
        {
            provide: PlatformSettings,
            inject: [AppConfig],
            useFactory: (config: AppConfig): PlatformSettings => new PlatformSettings(config.modulesEnabled, config.env.PUBLIC_APP_URL),
        },
        persistence(WorkspaceModuleRepository, () => new InMemoryWorkspaceModuleRepository(), ctx => new DrizzleWorkspaceModuleRepository(ctx)),
        persistence(FileRepository, () => new InMemoryFileRepository(), ctx => new DrizzleFileRepository(ctx)),
        persistence(NotificationRepository, () => new InMemoryNotificationRepository(), ctx => new DrizzleNotificationRepository(ctx)),
        persistence(
            NotificationDeliveryRepository,
            () => new InMemoryNotificationDeliveryRepository(),
            ctx => new DrizzleNotificationDeliveryRepository(ctx),
        ),
        // Memory mode has no tables to read: workspace members come from the workspaces module.
        persistence(RecipientDirectory, (dir: WorkspaceDirectory) => new InMemoryRecipientDirectory(ws => dir.memberIds(ws)),
            ctx => new DrizzleRecipientDirectory(ctx), [WorkspaceDirectory]),
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
        ModuleFlagCache,
        FileLinks,
        ListPlatformModulesUseCase,
        ListWorkspaceModulesUseCase,
        SetWorkspaceModuleUseCase,
        UploadFileUseCase,
        ReadFileContentUseCase,
        ListNotificationsUseCase,
        MarkNotificationsReadUseCase,
        SendNotificationUseCase,
        DeliverQueuedUseCase,
        DeliveryWorker,
        { provide: ModuleFlags, useClass: RepositoryModuleFlags },
        { provide: FileService, useClass: RepositoryFileService },
        { provide: Notifier, useClass: UseCaseNotifier },
        { provide: AppLinks, inject: [PlatformSettings], useFactory: (s: PlatformSettings): AppLinks => new ConfigAppLinks(s.publicAppUrl) },
    ],
    exports: [ModuleFlags, FileService, Notifier, AppLinks, SmsSender],
})
export class PlatformModule {}
