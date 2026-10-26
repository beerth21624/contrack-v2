import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { UserRepository } from '../../application/ports/user.repository';
import { User } from '../../domain/entities/user.entity';
import { IdentityErrors } from '../../domain/identity-errors';
import type { Email } from '../../domain/value-objects/email.value-object';

/** Map-based users (unit tests, e2e, PERSISTENCE=memory). E-mails are unique like the database index. */
export class InMemoryUserRepository extends UserRepository {
    private readonly byId = new Map<UserId, User>();

    findById(id: UserId): Promise<User | undefined> {
        return Promise.resolve(this.copy(this.byId.get(id)));
    }

    findByEmail(email: Email): Promise<User | undefined> {
        for (const user of this.byId.values()) {
            if (user.email.equals(email)) return Promise.resolve(this.copy(user));
        }
        return Promise.resolve(undefined);
    }

    findMany(ids: readonly UserId[]): Promise<User[]> {
        const found: User[] = [];
        for (const id of new Set(ids)) {
            const user = this.copy(this.byId.get(id));
            if (user !== undefined) found.push(user);
        }
        return Promise.resolve(found);
    }

    insert(user: User): Promise<Result<void, DomainError>> {
        for (const existing of this.byId.values()) {
            if (existing.email.equals(user.email)) return Promise.resolve(err(IdentityErrors.emailTaken()));
        }
        if (this.byId.has(user.id)) throw new Error(`InMemoryUserRepository: duplicate id ${user.id}`);
        this.byId.set(user.id, this.copy(user) ?? user);
        return Promise.resolve(okVoid());
    }

    private copy(user: User | undefined): User | undefined {
        if (user === undefined) return undefined;
        return User.rehydrate({
            id: user.id, email: user.email, displayName: user.displayName,
            passwordHash: user.passwordHash, createdAt: user.createdAt,
        });
    }
}
