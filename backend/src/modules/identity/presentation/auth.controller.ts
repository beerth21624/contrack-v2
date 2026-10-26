// ─── /auth: register, login, refresh, logout. The refresh token travels only in the httpOnly cookie ───
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import {
    type AuthResponse, type LoginRequest, REFRESH_COOKIE, type RegisterRequest, loginRequestSchema,
    registerRequestSchema,
} from '@contrack/contract';
import { AppConfig } from '../../../shared/infrastructure/config/env';
import { Public } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { AuthSettings } from '../application/ports/auth-settings.port';
import type { AuthSession } from '../application/services/session-issuer.service';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { toAuthResponse } from './identity.mapper';

/** The refresh token from the cookie, if any. */
export function readRefreshCookie(req: Request): string | undefined {
    const cookies: unknown = req.cookies;
    if (typeof cookies !== 'object' || cookies === null) return undefined;
    const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE];
    return typeof value === 'string' && value !== '' ? value : undefined;
}

@Public()
@Controller('auth')
export class AuthController {
    constructor(
        private readonly registerUser: RegisterUserUseCase,
        private readonly login: LoginUseCase,
        private readonly refreshSession: RefreshSessionUseCase,
        private readonly logout: LogoutUseCase,
        private readonly config: AppConfig,
        private readonly settings: AuthSettings,
    ) {}

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(
        @Body(new ZodPipe(registerRequestSchema)) body: RegisterRequest,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AuthResponse> {
        return this.respond(unwrap(await this.registerUser.execute(body)), res);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async signIn(
        @Body(new ZodPipe(loginRequestSchema)) body: LoginRequest,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AuthResponse> {
        return this.respond(unwrap(await this.login.execute(body)), res);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
        const result = await this.refreshSession.execute({ refreshToken: readRefreshCookie(req) });
        // A dead cookie is useless to the browser: drop it together with the 401.
        if (!result.ok) this.clearCookie(res);
        return this.respond(unwrap(result), res);
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        unwrap(await this.logout.execute({ refreshToken: readRefreshCookie(req) }));
        this.clearCookie(res);
    }

    private respond(session: AuthSession, res: Response): AuthResponse {
        res.cookie(REFRESH_COOKIE, session.refreshToken, {
            ...this.cookieOptions(),
            maxAge: this.settings.refreshTokenTtlSeconds * 1000,
        });
        return toAuthResponse(session);
    }

    private clearCookie(res: Response): void {
        res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    }

    /**
     * Same attributes when setting and clearing (a browser only drops a cookie whose path matches). The path is the
     * one the browser sees: `/api/auth` behind the Next rewrite, so the cookie reaches only the auth routes.
     */
    private cookieOptions(): CookieOptions {
        return {
            httpOnly: true,
            sameSite: 'lax',
            secure: this.config.env.COOKIE_SECURE,
            path: this.config.env.REFRESH_COOKIE_PATH,
        };
    }
}
