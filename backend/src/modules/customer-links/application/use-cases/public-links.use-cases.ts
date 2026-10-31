// ─── The customer's side of a link: view and answer, no sign-in (docs/erp/02-domain-model.md §1.8) ───
// Every "not there" case — wrong / expired / revoked token, project-hub not active for the workspace, no handler for the
// subject, the subject gone or its module off — answers the same 404 so a token reveals nothing.
import { Injectable, Logger } from '@nestjs/common';
import { CUSTOMER_LINK_SUBJECT_ACTIONS, type CustomerLinkAction, type CustomerLinkViewDto, type RespondRequest } from '@contrack/contract';
import {
    AuditLog, Clock, CompanyProfiles, type CustomerLinkHandler, CustomerLinkHandlers, type CustomerLinkRespondInput, type CustomerLinkSubjectView,
    ModuleFlags, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { sha256 } from '../../../../shared/infrastructure/crypto';
import { type CustomerLink, PUBLIC_LINK_RATE_LIMIT, isLinkUsable } from '../../domain/customer-link';
import { CustomerLinkRepository, LinkRateLimiter } from '../ports/customer-link.repository';

/** Raw tokens are 43 base64url characters; anything far off is not looked up. */
const MAX_TOKEN_LENGTH = 200;

export interface PublicCaller {
    ip: string;
    userAgent: string;
}

const linkNotFound = (): DomainError => DomainError.notFound('Link');

/** Thrown inside the transaction so a refused answer rolls back (the UnitOfWork commits on a normal return). */
class AnswerRefused extends Error {
    constructor(readonly error: DomainError) {
        super(error.message);
    }
}

interface Resolved {
    link: CustomerLink;
    handler: CustomerLinkHandler;
    subject: CustomerLinkSubjectView;
}

/** Shared lookups of the public routes. */
@Injectable()
export class PublicLinkResolver {
    constructor(
        private readonly repo: CustomerLinkRepository,
        private readonly handlers: CustomerLinkHandlers,
        private readonly flags: ModuleFlags,
        private readonly company: CompanyProfiles,
        private readonly limiter: LinkRateLimiter,
        private readonly clock: Clock,
    ) {}

    /** 429 after 30 hits per token + IP in 10 minutes. */
    throttle(token: string, caller: PublicCaller): Result<void, DomainError> {
        const key = `customer-link:${sha256(token)}:${caller.ip}`;
        return this.limiter.tryHit(key, PUBLIC_LINK_RATE_LIMIT.limit, PUBLIC_LINK_RATE_LIMIT.windowMs)
            ? ok(undefined)
            : err(new DomainError('rate_limited', 'Too many requests for this link; try again later'));
    }

    /** The usable link, its handler and its subject — or the one 404. */
    async resolve(token: string, link?: CustomerLink): Promise<Result<Resolved, DomainError>> {
        if (token === '' || token.length > MAX_TOKEN_LENGTH) return err(linkNotFound());
        const found = link ?? await this.repo.findByTokenHash(sha256(token));
        if (found === undefined || !isLinkUsable(found, this.clock.now())) return err(linkNotFound());
        if (!(await this.flags.isEnabled(found.workspaceId, 'project-hub'))) return err(linkNotFound());
        const handler = this.handlers.handlerOf(found.subjectType);
        if (handler === undefined) return err(linkNotFound());
        const subject = await handler.view(found.workspaceId, found.subjectId);
        if (subject === undefined) return err(linkNotFound());
        return ok({ link: found, handler, subject });
    }

    allowedActions(r: Pick<Resolved, 'link' | 'handler'>): readonly CustomerLinkAction[] {
        return r.handler.respond === undefined ? [] : CUSTOMER_LINK_SUBJECT_ACTIONS[r.link.subjectType];
    }

    async toView(r: Resolved): Promise<CustomerLinkViewDto> {
        const company = await this.company.snapshot(r.link.workspaceId, r.subject.language);
        const actions = [...this.allowedActions(r)];
        const answer = r.link.response;
        return {
            subjectType: r.link.subjectType,
            language: r.subject.language,
            title: r.subject.title,
            companyName: company.legalName,
            expiresAt: r.link.expiresAt.toISOString(),
            canRespond: r.subject.respondable && r.link.respondedAt === null && actions.length > 0,
            actions,
            response: answer === null ? null : { action: answer.action, name: answer.name, at: answer.at.toISOString() },
            payload: r.subject.payload,
        };
    }
}

/** GET /public/links/:token — counts the view. */
@Injectable()
export class ViewPublicLinkUseCase {
    private readonly logger = new Logger(ViewPublicLinkUseCase.name);

    constructor(private readonly links: PublicLinkResolver, private readonly repo: CustomerLinkRepository, private readonly clock: Clock) {}

    async execute(token: string, caller: PublicCaller): Promise<Result<CustomerLinkViewDto, DomainError>> {
        const throttled = this.links.throttle(token, caller);
        if (!throttled.ok) return throttled;
        const resolved = await this.links.resolve(token);
        if (!resolved.ok) return resolved;
        const now = this.clock.now();
        const { link, handler } = resolved.value;
        await this.repo.recordView(link.id, now);
        if (handler.onViewed !== undefined) {
            try {
                await handler.onViewed({
                    workspaceId: link.workspaceId, projectId: link.projectId, subjectId: link.subjectId, linkId: link.id,
                    firstView: link.viewCount === 0,
                });
            } catch (e) {
                this.logger.error(`onViewed of ${link.subjectType} failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        return ok(await this.links.toView({ ...resolved.value, link: { ...resolved.value.link, viewCount: resolved.value.link.viewCount + 1, lastViewedAt: now } }));
    }
}

/**
 * POST /public/links/:token/respond — once per link. Action the subject does not take → 422 (`respond_not_supported` for a
 * view-only subject, `action_not_supported` otherwise); answered already → 409 `already_responded`; the document no longer
 * answerable → 409 `invalid_transition`.
 */
@Injectable()
export class RespondPublicLinkUseCase {
    private readonly logger = new Logger(RespondPublicLinkUseCase.name);

    constructor(
        private readonly links: PublicLinkResolver,
        private readonly repo: CustomerLinkRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(token: string, body: RespondRequest, caller: PublicCaller): Promise<Result<CustomerLinkViewDto, DomainError>> {
        const throttled = this.links.throttle(token, caller);
        if (!throttled.ok) return throttled;
        const first = await this.links.resolve(token);
        if (!first.ok) return first;
        const allowed = this.links.allowedActions(first.value);
        if (allowed.length === 0) {
            return err(DomainError.unprocessable('This document cannot be answered from a link', { reason: 'respond_not_supported' }));
        }
        if (!allowed.includes(body.action)) {
            return err(DomainError.unprocessable('This document does not take that answer', { reason: 'action_not_supported' }));
        }

        try {
            const { view, input } = await this.uow.run(async () => {
                const locked = await this.repo.lockByTokenHash(sha256(token));
                const current = await this.links.resolve(token, locked);
                if (!current.ok) throw new AnswerRefused(current.error);
                const { link, handler, subject } = current.value;
                if (link.respondedAt !== null) {
                    throw new AnswerRefused(DomainError.conflict('This link has already been answered', { reason: 'already_responded' }));
                }
                if (!subject.respondable || handler.respond === undefined) {
                    throw new AnswerRefused(DomainError.conflict('The document can no longer be answered', { reason: 'invalid_transition' }));
                }
                const at = this.clock.now();
                const input: CustomerLinkRespondInput = {
                    workspaceId: link.workspaceId, projectId: link.projectId, subjectId: link.subjectId, linkId: link.id,
                    action: body.action, name: body.name, note: body.note, at,
                };
                const handled = await handler.respond(input);
                if (!handled.ok) throw new AnswerRefused(handled.error);
                const saved: CustomerLink = {
                    ...link,
                    respondedAt: at,
                    response: { action: body.action, name: body.name, note: body.note, ip: caller.ip, userAgent: caller.userAgent.slice(0, 500), at },
                };
                await this.repo.save(saved);
                await this.audit.record({
                    workspaceId: link.workspaceId, projectId: link.projectId, actor: null, entityType: 'customer_link', entityId: link.id,
                    action: 'respond', data: { subjectType: link.subjectType, subjectId: link.subjectId, action: body.action },
                });
                // The subject may have changed state through the handler: show it as it is now.
                const after = await handler.view(link.workspaceId, link.subjectId);
                return { view: await this.links.toView({ link: saved, handler, subject: after ?? subject }), input };
            });
            if (first.value.handler.afterRespond !== undefined) {
                try {
                    await first.value.handler.afterRespond(input);
                } catch (e) {
                    this.logger.error(`afterRespond failed: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            return ok(view);
        } catch (e) {
            if (e instanceof AnswerRefused) return err(e.error);
            throw e;
        }
    }
}
