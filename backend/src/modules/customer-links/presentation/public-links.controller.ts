import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { type CustomerLinkViewDto, type RespondRequest, respondRequestSchema } from '@contrack/contract';
import { Public } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { type PublicCaller, RespondPublicLinkUseCase, ViewPublicLinkUseCase } from '../application/use-cases/public-links.use-cases';

/** Express `req.ip` honours X-Forwarded-For only from the proxies env TRUST_PROXY names (bootstrap.ts). */
const caller = (req: Request): PublicCaller => ({
    ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: req.get('user-agent') ?? '',
});

/**
 * The customer's side: no sign-in and deliberately no @RequiresModule — a switched-off project-hub answers the same
 * 404 as a wrong token (checked in the use case).
 */
@Public()
@Controller('public/links')
export class PublicLinksController {
    constructor(private readonly view: ViewPublicLinkUseCase, private readonly respond: RespondPublicLinkUseCase) {}

    @Get(':token')
    async viewLink(@Param('token') token: string, @Req() req: Request): Promise<CustomerLinkViewDto> {
        return unwrap(await this.view.execute(token, caller(req)));
    }

    @Post(':token/respond')
    @HttpCode(200)
    async respondLink(
        @Param('token') token: string,
        @Req() req: Request,
        @Body(new ZodPipe(respondRequestSchema)) body: RespondRequest,
    ): Promise<CustomerLinkViewDto> {
        return unwrap(await this.respond.execute(token, body, caller(req)));
    }
}
