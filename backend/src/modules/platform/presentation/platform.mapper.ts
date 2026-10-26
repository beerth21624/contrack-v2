import type { NotificationDto, NotificationListDto, WorkspaceModuleDto } from '@contrack/contract';
import type { NotificationList } from '../application/use-cases/list-notifications.use-case';
import type { WorkspaceModuleView } from '../application/use-cases/workspace-module.view';
import type { Notification } from '../domain/entities/notification.entity';

export function toWorkspaceModuleDto(view: WorkspaceModuleView): WorkspaceModuleDto {
    return {
        module: view.module,
        available: view.available,
        enabled: view.enabled,
        enabledAt: view.enabledAt === null ? null : view.enabledAt.toISOString(),
    };
}

export function toNotificationDto(n: Notification): NotificationDto {
    return {
        id: n.id,
        template: n.template,
        title: n.title,
        body: n.body,
        href: n.href,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt === null ? null : n.readAt.toISOString(),
    };
}

export function toNotificationListDto(list: NotificationList): NotificationListDto {
    return { items: list.items.map(toNotificationDto), unread: list.unread };
}
