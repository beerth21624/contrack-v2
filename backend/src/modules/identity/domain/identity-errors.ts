// ─── Expected failures of the identity context (codes from the shared contract) ───
import { DomainError } from '../../../shared/domain/domain-error';

export const IdentityErrors = {
    emailTaken: (): DomainError => new DomainError('email_taken', 'An account with this e-mail address already exists'),
    /** A concurrent phone sign-in created the user with this phone first. */
    phoneTaken: (): DomainError => DomainError.conflict('An account with this phone number already exists'),
    /** Same answer for an unknown e-mail and a wrong password (never reveal which accounts exist). */
    invalidCredentials: (): DomainError => new DomainError('invalid_credentials', 'E-mail or password is wrong'),
    invalidToken: (): DomainError => new DomainError('invalid_token', 'The session has expired, please sign in again'),
    unauthenticated: (): DomainError => new DomainError('unauthenticated', 'Sign in required'),
    /** Same answer for a wrong, expired, used or replaced code and for too many attempts. */
    otpInvalid: (): DomainError => new DomainError('otp_invalid', 'The code is wrong or has expired, please request a new one'),
    rateLimited: (): DomainError => new DomainError('rate_limited', 'Too many requests, please wait a moment and try again'),
    /** Phone sign-in is off: the platform does not offer the module it exists for. */
    phoneSignInDisabled: (): DomainError => new DomainError('module_disabled', 'Phone sign-in is not available'),
} as const;
