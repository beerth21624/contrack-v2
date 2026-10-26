// ─── /auth: register, login, refresh, logout, phone sign-in (otp/*). The refresh token travels only in the cookie ───
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import {
    type AuthResponse, type LoginRequest, type PhoneAuthResponse, type PhoneStatusResponse, REFRESH_COOKIE,
    type RegisterRequest, type RequestOtpRequest, type VerifyOtpRequest, loginRequestSchema, registerRequestSchema,
    requestOtpRequestSchema, verifyOtpRequestSchema,
} from '@contrack/contract';
import { AppConfig } from '../../../shared/infrastructure/config/env';
import { Public } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { AuthSettings } from '../application/ports/auth-settings.port';
import type { AuthSession } from '../application/services/session-issuer.service';
import { CheckPhoneUseCase } from '../application/use-cases/check-phone.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { RequestOtpUseCase } from '../application/use-cases/request-otp.use-case';
import { VerifyOtpUseCase } from '../application/use-cases/verify-otp.use-case';
import { toAuthResponse, toPhoneAuthResponse } from './identity.mapper';

/** The refresh token from the cookie, if any. */
export function readRefreshCookie(req: Request): string | undefined {
    const cookies: unknown = req.cookies;
    if (typeof cookies !== 'object' || cookies === null) return undefined;
    const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE];
    return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * The caller's IP for rate limits (Express `req.ip`: honours X-Forwarded-For only from the proxies env TRUST_PROXY
 * names; by default only the local Next server).
 */
export function clientIp(req: Request): string {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

@Public()
@Controller('auth')
export class AuthController {
    constructor(
        private readonly registerUser: RegisterUserUseCase,
        private readonly login: LoginUseCase,
        private readonly refreshSession: RefreshSessionUseCase,
        private readonly logout: LogoutUseCase,
        private readonly checkPhone: CheckPhoneUseCase,
        private readonly requestOtp: RequestOtpUseCase,
        private readonly verifyOtp: VerifyOtpUseCase,
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

    @Post('otp/check')
    @HttpCode(HttpStatus.OK)
    async otpCheck(
        @Body(new ZodPipe(requestOtpRequestSchema)) body: RequestOtpRequest,
        @Req() req: Request,
    ): Promise<PhoneStatusResponse> {
        return unwrap(await this.checkPhone.execute({ phone: body.phone, ip: clientIp(req) }));
    }

    @Post('otp/request')
    @HttpCode(HttpStatus.NO_CONTENT)
    async otpRequest(
        @Body(new ZodPipe(requestOtpRequestSchema)) body: RequestOtpRequest,
        @Req() req: Request,
    ): Promise<void> {
        unwrap(await this.requestOtp.execute({ phone: body.phone, ip: clientIp(req) }));
    }

    /** Signs in (or up) with the code; sets the refresh cookie exactly like login. */
    @Post('otp/verify')
    @HttpCode(HttpStatus.OK)
    async otpVerify(
        @Body(new ZodPipe(verifyOtpRequestSchema)) body: VerifyOtpRequest,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<PhoneAuthResponse> {
        const signIn = unwrap(await this.verifyOtp.execute({ ...body, ip: clientIp(req) }));
        this.setRefreshCookie(signIn.session, res);
        return toPhoneAuthResponse(signIn);
    }

    private respond(session: AuthSession, res: Response): AuthResponse {
        this.setRefreshCookie(session, res);
        return toAuthResponse(session);
    }

    private setRefreshCookie(session: AuthSession, res: Response): void {
        res.cookie(REFRESH_COOKIE, session.refreshToken, {
            ...this.cookieOptions(),
            maxAge: this.settings.refreshTokenTtlSeconds * 1000,
        });
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
