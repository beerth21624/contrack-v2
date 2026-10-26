// ─── Shared API contract: in-app notifications (every message also lands here, whatever else delivers it) ───
// GET /notifications?limit=30 → NotificationListDto · POST /notifications/read → 204
import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';

export const notificationDtoSchema = z.object({
    id: uuidSchema,
    template: z.string(),
    title: z.string(),
    body: z.string(),
    /** In-app path to open (e.g. /subcontracting/packages/…); '' when there is nothing to open. */
    href: z.string(),
    createdAt: isoDateTimeSchema,
    readAt: isoDateTimeSchema.nullable(),
});
export type NotificationDto = z.infer<typeof notificationDtoSchema>;

export const notificationListDtoSchema = z.object({
    items: z.array(notificationDtoSchema),
    unread: z.number().int().nonnegative(),
});
export type NotificationListDto = z.infer<typeof notificationListDtoSchema>;

export const notificationQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

export const markNotificationsReadRequestSchema = z.object({
    ids: z.array(uuidSchema).max(100).optional(),
    all: z.boolean().optional(),
});
export type MarkNotificationsReadRequest = z.infer<typeof markNotificationsReadRequestSchema>;
