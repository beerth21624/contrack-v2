import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Recipient, RecipientDirectory } from '../../application/ports/recipient-directory.port';

/** Lists the user ids of the members of a workspace (for PERSISTENCE=memory, where there is no table to read). */
export type WorkspaceMembersLookup = (workspaceId: WorkspaceId) => Promise<readonly UserId[]>;

/**
 * In-memory recipients: every listed user id is a recipient (phone / LINE id only when registered with `addUser`);
 * workspace members come from `addMember` and, when given, from `lookup`.
 * The app wires `lookup` to WorkspaceDirectory.memberIds (platform.module.ts), so `toWorkspaceIds` reach members.
 */
export class InMemoryRecipientDirectory extends RecipientDirectory {
    private readonly users = new Map<UserId, { phone: string | null; lineUserId: string | null }>();
    private readonly members = new Map<WorkspaceId, Set<UserId>>();

    constructor(private readonly lookup?: WorkspaceMembersLookup) {
        super();
    }

    addUser(userId: UserId, contact: { phone?: string | null; lineUserId?: string | null } = {}): void {
        this.users.set(userId, { phone: contact.phone ?? null, lineUserId: contact.lineUserId ?? null });
    }

    addMember(workspaceId: WorkspaceId, userId: UserId): void {
        const set = this.members.get(workspaceId) ?? new Set<UserId>();
        set.add(userId);
        this.members.set(workspaceId, set);
        if (!this.users.has(userId)) this.addUser(userId);
    }

    async resolve(userIds: readonly UserId[], workspaceIds: readonly WorkspaceId[]): Promise<Recipient[]> {
        const ids = new Set<UserId>(userIds);
        for (const workspaceId of new Set(workspaceIds)) {
            for (const id of this.members.get(workspaceId) ?? []) ids.add(id);
            if (this.lookup !== undefined) for (const id of await this.lookup(workspaceId)) ids.add(id);
        }
        return [...ids].map(userId => {
            const contact = this.users.get(userId);
            return { userId, phone: contact?.phone ?? null, lineUserId: contact?.lineUserId ?? null };
        });
    }
}
