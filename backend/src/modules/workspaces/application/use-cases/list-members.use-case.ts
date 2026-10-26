import { Injectable } from '@nestjs/common';
import { UserDirectory, type UserProfile } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can, roleRank } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import type { Membership } from '../../domain/entities/membership.entity';
import { WorkspaceErrors } from '../../domain/workspace.errors';
import { MembershipRepository } from '../ports/membership.repository';

/** A member with the public profile from identity (mapped to `MemberDto` at the edge). */
export interface MemberView {
    membership: Membership;
    profile: UserProfile;
}

/** Joins memberships with profiles; members whose user no longer exists are left out. Strongest role first. */
export async function toMemberViews(directory: UserDirectory, members: readonly Membership[]): Promise<MemberView[]> {
    if (members.length === 0) return [];
    const profiles = await directory.findMany(members.map(m => m.userId));
    const views: MemberView[] = [];
    for (const membership of members) {
        const profile = profiles.get(membership.userId);
        if (profile !== undefined) views.push({ membership, profile });
    }
    return views.sort((a, b) =>
        roleRank(b.membership.role) - roleRank(a.membership.role)
        || a.membership.joinedAt.getTime() - b.membership.joinedAt.getTime()
        || a.membership.userId.localeCompare(b.membership.userId));
}

export interface ListMembersInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
}

/** Needs `members.read` (every role). */
@Injectable()
export class ListMembersUseCase {
    constructor(
        private readonly memberships: MembershipRepository,
        private readonly users: UserDirectory,
    ) {}

    async execute(input: ListMembersInput): Promise<Result<MemberView[], DomainError>> {
        const membership = await this.memberships.find(input.workspaceId, input.actorId);
        if (membership === undefined) return err(WorkspaceErrors.workspaceNotFound());
        if (!can(membership.role, 'members.read')) return err(DomainError.forbidden());
        const members = await this.memberships.listByWorkspace(input.workspaceId);
        return ok(await toMemberViews(this.users, members));
    }
}
