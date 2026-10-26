import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** A user a notification reaches, with the outside channels they can be reached on. */
export interface Recipient {
    userId: UserId;
    /** Verified phone (E.164) or null. */
    phone: string | null;
    /** LINE user id once the user linked LINE (TODO: LINE account linking), else null. */
    lineUserId: string | null;
}

/** Resolves the users of a notification: the listed users plus every member of the listed workspaces (deduplicated). */
export abstract class RecipientDirectory {
    abstract resolve(userIds: readonly UserId[], workspaceIds: readonly WorkspaceId[]): Promise<Recipient[]>;
}
