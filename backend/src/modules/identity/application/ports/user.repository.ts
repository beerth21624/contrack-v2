import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import type { Result } from '../../../../shared/domain/result';
import type { User } from '../../domain/entities/user.entity';
import type { Email } from '../../domain/value-objects/email.value-object';
import type { Phone } from '../../domain/value-objects/phone.value-object';

/** Users by id / e-mail / phone. Abstract class = port and Nest DI token. */
export abstract class UserRepository {
    abstract findById(id: UserId): Promise<User | undefined>;
    abstract findByEmail(email: Email): Promise<User | undefined>;
    abstract findByPhone(phone: Phone): Promise<User | undefined>;
    /** Several users at once (missing ids are left out). */
    abstract findMany(ids: readonly UserId[]): Promise<User[]>;
    /**
     * `email_taken` when the e-mail is already registered, `conflict` when the phone is (also when a concurrent
     * registration / phone sign-in won the race).
     */
    abstract insert(user: User): Promise<Result<void, DomainError>>;
    /** Sets the verified phone of an existing user. */
    abstract markPhoneVerified(id: UserId, phone: Phone, at: Date): Promise<void>;
}
