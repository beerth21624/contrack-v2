// ─── Me: the signed-in user and the workspaces they belong to ───
import { Injectable } from '@nestjs/common';
import { MembershipDirectory, type MembershipSummary } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import type { User } from '../../domain/entities/user.entity';
import { IdentityErrors } from '../../domain/identity-errors';
import { UserRepository } from '../ports/user.repository';

export interface GetMeInput {
    userId: UserId;
}

export interface Me {
    user: User;
    workspaces: MembershipSummary[];
}

@Injectable()
export class GetMeUseCase {
    constructor(private readonly users: UserRepository, private readonly memberships: MembershipDirectory) {}

    async execute(input: GetMeInput): Promise<Result<Me, DomainError>> {
        const user = await this.users.findById(input.userId);
        // A valid access token of a user that no longer exists: the client must sign in again.
        if (user === undefined) return err(IdentityErrors.unauthenticated());
        return ok({ user, workspaces: await this.memberships.listForUser(user.id) });
    }
}
