import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { UserRepository } from '../../application/ports/user.repository';
import { User } from '../../domain/entities/user.entity';
import { IdentityErrors } from '../../domain/identity-errors';
import type { Email } from '../../domain/value-objects/email.value-object';
import type { Phone } from '../../domain/value-objects/phone.value-object';

/**
 * Map-based users (unit tests, e2e, PERSISTENCE=memory). E-mails and phones are unique like the database indexes.
 */
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

    findByPhone(phone: Phone): Promise<User | undefined> {
        for (const user of this.byId.values()) {
            if (user.phone?.equals(phone) === true) return Promise.resolve(this.copy(user));
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
        const phone = user.phone;
        for (const existing of this.byId.values()) {
            if (existing.email.equals(user.email)) return Promise.resolve(err(IdentityErrors.emailTaken()));
            if (phone !== null && existing.phone?.equals(phone) === true) {
                return Promise.resolve(err(IdentityErrors.phoneTaken()));
            }
        }
        if (this.byId.has(user.id)) throw new Error(`InMemoryUserRepository: duplicate id ${user.id}`);
        this.byId.set(user.id, this.copy(user) ?? user);
        return Promise.resolve(okVoid());
    }

    markPhoneVerified(id: UserId, phone: Phone, at: Date): Promise<void> {
        const user = this.byId.get(id);
        if (user !== undefined) this.byId.set(id, user.withVerifiedPhone(phone, at));
        return Promise.resolve();
    }

    private copy(user: User | undefined): User | undefined {
        return user === undefined ? undefined : User.rehydrate(user.toProps());
    }
}
