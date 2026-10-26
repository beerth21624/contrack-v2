// ─── Expected failures of the identity context (codes from the shared contract) ───
import { DomainError } from '../../../shared/domain/domain-error';

export const IdentityErrors = {
    emailTaken: (): DomainError => new DomainError('email_taken', 'An account with this e-mail address already exists'),
    /** Same answer for an unknown e-mail and a wrong password (never reveal which accounts exist). */
    invalidCredentials: (): DomainError => new DomainError('invalid_credentials', 'E-mail or password is wrong'),
    invalidToken: (): DomainError => new DomainError('invalid_token', 'The session has expired, please sign in again'),
    unauthenticated: (): DomainError => new DomainError('unauthenticated', 'Sign in required'),
} as const;
