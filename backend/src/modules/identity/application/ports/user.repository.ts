import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import type { Result } from '../../../../shared/domain/result';
import type { User } from '../../domain/entities/user.entity';
import type { Email } from '../../domain/value-objects/email.value-object';

/** Users by id / e-mail. Abstract class = port and Nest DI token. */
export abstract class UserRepository {
    abstract findById(id: UserId): Promise<User | undefined>;
    abstract findByEmail(email: Email): Promise<User | undefined>;
    /** Several users at once (missing ids are left out). */
    abstract findMany(ids: readonly UserId[]): Promise<User[]>;
    /** `email_taken` when the e-mail is already registered (also when a concurrent registration won the race). */
    abstract insert(user: User): Promise<Result<void, DomainError>>;
}
