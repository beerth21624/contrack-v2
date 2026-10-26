// ─── Domain errors: every expected failure has a stable code from the shared contract ───
import type { ErrorCode } from '@contrack/contract';

export class DomainError {
    constructor(
        readonly code: ErrorCode,
        readonly message: string,
        readonly details?: unknown,
    ) {}

    static validation(message: string, details?: unknown): DomainError {
        return new DomainError('validation_failed', message, details);
    }

    /** Also used when the caller may not know the thing exists (tenant isolation: never reveal other tenants). */
    static notFound(what: string): DomainError {
        return new DomainError('not_found', `${what} not found`);
    }

    static forbidden(message = 'You do not have permission to do this'): DomainError {
        return new DomainError('forbidden', message);
    }

    static conflict(message: string, details?: unknown): DomainError {
        return new DomainError('conflict', message, details);
    }

    static unprocessable(message: string, details?: unknown): DomainError {
        return new DomainError('unprocessable', message, details);
    }
}
