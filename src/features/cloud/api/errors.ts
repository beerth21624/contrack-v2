// ─── Errors of the backend API, mapped to one shape ───
import { errorResponseSchema, type ErrorCode } from '@/shared/contract';
import thErrors from '@/i18n/messages/th/errors.json';

/** Codes the client adds on top of the server's: no answer at all, or an answer that does not match the contract. */
export type ClientErrorCode = 'network_error' | 'invalid_response';
export type ApiErrorCode = ErrorCode | ClientErrorCode;

export class ApiError extends Error {
    override readonly name = 'ApiError';

    constructor(
        /** HTTP status; 0 when the request never got an answer (offline, server down, CORS). */
        readonly status: number,
        readonly code: ApiErrorCode,
        message: string,
        readonly details?: unknown,
    ) {
        super(message);
    }

    /** No answer from the server: try again later. */
    get isNetwork(): boolean {
        return this.code === 'network_error';
    }
}

export function isApiError(e: unknown): e is ApiError {
    return e instanceof ApiError;
}

/** Errors worth retrying later (no connection, server busy or broken, rate limit). */
export function isRetryable(e: unknown): boolean {
    if (!isApiError(e)) return true;
    return e.status === 0 || e.status >= 500 || e.status === 429 || e.status === 401;
}

/** Builds an ApiError from a non-2xx response body (an ErrorResponse, or anything else). */
export function errorFromBody(status: number, body: unknown, fallback: string): ApiError {
    const parsed = errorResponseSchema.safeParse(body);
    if (parsed.success) return new ApiError(status, parsed.data.code, parsed.data.message, parsed.data.details);
    return new ApiError(status, status >= 500 ? 'internal' : 'validation_failed', fallback);
}

/** Plain Thai message for people, by error code (the Thai texts live in messages/th/errors.json; screens that moved use useErrorMessage). */
export function thaiErrorMessage(e: unknown): string {
    if (!isApiError(e)) return thErrors.unknown;
    const codes: Record<string, string> = thErrors.codes;
    return codes[e.code] ?? thErrors.unknown;
}
