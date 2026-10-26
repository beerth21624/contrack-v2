import type { PlainPassword } from '../../domain/value-objects/plain-password.value-object';

/** Slow, salted password hashing. */
export abstract class PasswordHasher {
    abstract hash(password: PlainPassword): Promise<string>;
    /** False on a wrong password or a malformed / tampered hash (never throws for those). */
    abstract verify(password: string, hash: string): Promise<boolean>;
    /** Spends the same time as `verify` when there is no user, so response time does not reveal unknown e-mails. */
    abstract dummyVerify(password: string): Promise<void>;
}
