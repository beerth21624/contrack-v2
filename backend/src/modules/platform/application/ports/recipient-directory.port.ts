import type { UserLocale } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** A user a notification reaches, with their language and the outside channels they can be reached on. */
export interface Recipient {
    userId: UserId;
    /** `users.locale`: the language the notification is rendered in. */
    locale: UserLocale;
    /** Verified phone (E.164) or null. */
    phone: string | null;
    /** LINE user id from a verified `user_channel_links` row (LINE linking comes later), else null. */
    lineUserId: string | null;
}

/** Resolves the users of a notification: the listed users plus every member of the listed workspaces (deduplicated). */
export abstract class RecipientDirectory {
    abstract resolve(userIds: readonly UserId[], workspaceIds: readonly WorkspaceId[]): Promise<Recipient[]>;
}
