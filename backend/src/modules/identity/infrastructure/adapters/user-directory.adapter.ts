// ─── Shared UserDirectory port: public profiles for member lists and presence ───
import { UserDirectory, type UserProfile } from '../../../../shared/application/ports';
import type { UserId } from '../../../../shared/domain/ids';
import type { UserRepository } from '../../application/ports/user.repository';

export class IdentityUserDirectory extends UserDirectory {
    constructor(private readonly users: UserRepository) {
        super();
    }

    async findMany(ids: readonly UserId[]): Promise<Map<UserId, UserProfile>> {
        const found = await this.users.findMany(ids);
        return new Map(found.map(u => [u.id, { id: u.id, email: u.email.value, displayName: u.displayName.value }]));
    }
}
