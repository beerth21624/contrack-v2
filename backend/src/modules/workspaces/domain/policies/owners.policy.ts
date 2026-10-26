// ─── Owner counting: a workspace always keeps at least one owner ───
import type { Role } from '@contrack/contract';

export function countOwners(members: readonly { role: Role }[]): number {
    return members.filter(m => m.role === 'owner').length;
}

/** True when taking `owner` away from someone who has it would leave the workspace without an owner. */
export function wouldLeaveNoOwner(targetRole: Role, newRole: Role | null, ownerCount: number): boolean {
    return targetRole === 'owner' && newRole !== 'owner' && ownerCount <= 1;
}
