// ─── Authentication at the HTTP edge: Bearer access token → @CurrentUser() ───
import {
    type CanActivate, createParamDecorator, type ExecutionContext, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AccessTokenVerifier, type AuthenticatedUser } from '../application/ports';
import { DomainError } from '../domain/domain-error';
import { DomainHttpException } from './http';

const PUBLIC = 'contrack:public';
/** Marks a route that needs no access token (register, login, refresh, health). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC, true);

interface AuthedRequest extends Request {
    user?: AuthenticatedUser;
}

export function bearerToken(header: string | undefined): string | undefined {
    if (header === undefined) return undefined;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token !== undefined && token !== '' ? token : undefined;
}

/** Global guard: every route needs a valid access token unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly reflector: Reflector, private readonly verifier: AccessTokenVerifier) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC, [context.getHandler(), context.getClass()]) === true) {
            return true;
        }
        const req = context.switchToHttp().getRequest<AuthedRequest>();
        const token = bearerToken(req.headers.authorization);
        const user = token === undefined ? undefined : await this.verifier.verify(token);
        if (user === undefined) throw new DomainHttpException(new DomainError('unauthenticated', 'Sign in required'));
        req.user = user;
        return true;
    }
}

/** The signed-in user of the request (only on routes behind AuthGuard). */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (user === undefined) throw new DomainHttpException(new DomainError('unauthenticated', 'Sign in required'));
    return user;
});
