// ─── HTTP edge: zod validation, Result → response, error codes → status ───
import {
    type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger, type PipeTransform,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';
import type { ErrorCode, ErrorResponse } from '@contrack/contract';
import { DomainError } from '../domain/domain-error';
import type { Result } from '../domain/result';

/** HTTP status for each error code (one place, so every endpoint answers the same way). */
export const STATUS_OF: Record<ErrorCode, number> = {
    validation_failed: 400,
    unauthenticated: 401,
    invalid_credentials: 401,
    invalid_token: 401,
    forbidden: 403,
    not_found: 404,
    conflict: 409,
    version_conflict: 409,
    email_taken: 409,
    last_owner: 409,
    personal_workspace: 409,
    invitation_invalid: 410,
    unprocessable: 422,
    rate_limited: 429,
    internal: 500,
};

/** Thrown at the edge to turn a DomainError into a response (domain/application code never throws it). */
export class DomainHttpException extends HttpException {
    constructor(readonly domainError: DomainError) {
        super({ code: domainError.code, message: domainError.message, details: domainError.details } satisfies ErrorResponse,
            STATUS_OF[domainError.code]);
    }
}

/** Controllers: `return unwrap(await this.useCase.execute(...))`. */
export function unwrap<T>(result: Result<T, DomainError>): T {
    if (result.ok) return result.value;
    throw new DomainHttpException(result.error);
}

/** Validates a body / query / param with a contract schema. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
    constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

    transform(value: unknown): T {
        const parsed = this.schema.safeParse(value);
        if (parsed.success) return parsed.data;
        throw new DomainHttpException(DomainError.validation('Invalid request', parsed.error.flatten()));
    }
}

/** Every error leaves the API as an ErrorResponse; unexpected ones are logged and hidden. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
    private readonly logger = new Logger('ErrorFilter');

    catch(exception: unknown, host: ArgumentsHost): void {
        const res = host.switchToHttp().getResponse<Response>();
        if (exception instanceof DomainHttpException) {
            res.status(exception.getStatus()).json(exception.getResponse());
            return;
        }
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const code: ErrorCode = status === 404 ? 'not_found' : status === 401 ? 'unauthenticated'
                : status === 403 ? 'forbidden' : status === 429 ? 'rate_limited' : status < 500 ? 'validation_failed' : 'internal';
            res.status(status).json({ code, message: exception.message } satisfies ErrorResponse);
            return;
        }
        this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
        res.status(500).json({ code: 'internal', message: 'Something went wrong' } satisfies ErrorResponse);
    }
}
