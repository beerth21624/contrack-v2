// ─── Links the team creates, lists and revokes (signed in; permission from the subject's handler) ───
import { Injectable } from '@nestjs/common';
import {
    CUSTOMER_LINK_DEFAULT_DAYS, type CreateCustomerLinkRequest, type CreateCustomerLinkResponse, type CustomerLinkDto, type CustomerLinkListQuery,
} from '@contrack/contract';
import { ModuleAccess } from '../../../../shared/application/module-access';
import {
    AppLinks, AuditLog, Clock, type CustomerLinkHandler, CustomerLinkHandlers, IdGenerator, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { newOpaqueToken, sha256 } from '../../../../shared/infrastructure/crypto';
import { type CustomerLink, toCustomerLinkDto } from '../../domain/customer-link';
import { CustomerLinkRepository } from '../ports/customer-link.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The subject's handler, or 404 when no module serves that subject yet. */
function handlerFor(handlers: CustomerLinkHandlers, subjectType: CustomerLink['subjectType']): Result<CustomerLinkHandler, DomainError> {
    const handler = handlers.handlerOf(subjectType);
    return handler === undefined ? err(DomainError.notFound('Document')) : ok(handler);
}

/** POST /workspaces/:workspaceId/customer-links → `{url, token, link}`; the raw token is never shown again. */
@Injectable()
export class CreateCustomerLinkUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly handlers: CustomerLinkHandlers,
        private readonly repo: CustomerLinkRepository,
        private readonly links: AppLinks,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; workspaceId: WorkspaceId; body: CreateCustomerLinkRequest }): Promise<Result<CreateCustomerLinkResponse, DomainError>> {
        const handler = handlerFor(this.handlers, input.body.subjectType);
        if (!handler.ok) return handler;
        const grant = await this.access.inWorkspace(input.userId, input.workspaceId, 'project-hub', handler.value.permission);
        if (!grant.ok) return grant;
        const subjectId = input.body.subjectId.toLowerCase();
        const subject = await handler.value.view(input.workspaceId, subjectId);
        if (subject === undefined) return err(DomainError.notFound('Document'));

        const token = newOpaqueToken();
        const now = this.clock.now();
        const link: CustomerLink = {
            id: this.ids.newId(),
            workspaceId: input.workspaceId,
            projectId: subject.projectId,
            tokenHash: sha256(token),
            subjectType: input.body.subjectType,
            subjectId,
            createdBy: input.userId,
            createdAt: now,
            expiresAt: new Date(now.getTime() + (input.body.expiresInDays ?? CUSTOMER_LINK_DEFAULT_DAYS) * DAY_MS),
            revokedAt: null,
            lastViewedAt: null,
            viewCount: 0,
            respondedAt: null,
            response: null,
        };
        await this.uow.run(async () => {
            await this.repo.save(link);
            await this.audit.record({
                workspaceId: link.workspaceId, projectId: link.projectId, actor: input.userId, entityType: 'customer_link', entityId: link.id,
                action: 'share', data: { subjectType: link.subjectType, subjectId: link.subjectId, expiresAt: link.expiresAt.toISOString() },
            });
        });
        return ok({ url: this.links.url(`/c/${token}`), token, link: toCustomerLinkDto(link, now) });
    }
}

/** GET /workspaces/:workspaceId/customer-links?subjectType=&subjectId= — newest first. */
@Injectable()
export class ListCustomerLinksUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly handlers: CustomerLinkHandlers,
        private readonly repo: CustomerLinkRepository,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, query: CustomerLinkListQuery): Promise<Result<CustomerLinkDto[], DomainError>> {
        const handler = handlerFor(this.handlers, query.subjectType);
        if (!handler.ok) return handler;
        const grant = await this.access.inWorkspace(userId, workspaceId, 'project-hub', handler.value.permission);
        if (!grant.ok) return grant;
        const rows = await this.repo.listForSubject(workspaceId, query.subjectType, query.subjectId.toLowerCase());
        const now = this.clock.now();
        return ok(rows.map(l => toCustomerLinkDto(l, now)));
    }
}

/** POST /customer-links/:linkId/revoke — idempotent; the link then answers 404 like a wrong token. */
@Injectable()
export class RevokeCustomerLinkUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly handlers: CustomerLinkHandlers,
        private readonly repo: CustomerLinkRepository,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, linkId: string): Promise<Result<CustomerLinkDto, DomainError>> {
        if (!isUuid(linkId)) return err(DomainError.notFound('Link'));
        const link = await this.repo.findById(linkId.toLowerCase());
        if (link === undefined) return err(DomainError.notFound('Link'));
        const handler = handlerFor(this.handlers, link.subjectType);
        if (!handler.ok) return err(DomainError.notFound('Link'));
        const grant = await this.access.inWorkspace(userId, link.workspaceId, 'project-hub', handler.value.permission);
        if (!grant.ok) return grant.error.code === 'not_found' ? err(DomainError.notFound('Link')) : grant;
        const now = this.clock.now();
        if (link.revokedAt !== null) return ok(toCustomerLinkDto(link, now));
        const revoked: CustomerLink = { ...link, revokedAt: now };
        await this.uow.run(async () => {
            await this.repo.save(revoked);
            await this.audit.record({
                workspaceId: link.workspaceId, projectId: link.projectId, actor: userId, entityType: 'customer_link', entityId: link.id,
                action: 'revoke', data: { subjectType: link.subjectType, subjectId: link.subjectId },
            });
        });
        return ok(toCustomerLinkDto(revoked, now));
    }
}
