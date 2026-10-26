// ─── Branded ids of the platform module ───
import type { Brand } from '../../../shared/domain/ids';

export type FileId = Brand<string, 'FileId'>;
export type NotificationId = Brand<string, 'NotificationId'>;
export type DeliveryId = Brand<string, 'DeliveryId'>;

export const asFileId = (v: string): FileId => v as FileId;
export const asNotificationId = (v: string): NotificationId => v as NotificationId;
export const asDeliveryId = (v: string): DeliveryId => v as DeliveryId;
