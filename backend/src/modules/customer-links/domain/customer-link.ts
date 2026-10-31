// ─── A public link to one document (docs/erp/02-domain-model.md §1.8) ───
import type { CustomerLinkAction, CustomerLinkDto, CustomerLinkStatus, CustomerLinkSubject } from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../shared/domain/ids';

/** Rate limit of the public routes: per token + IP. */
export const PUBLIC_LINK_RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 } as const;

export interface CustomerLinkAnswer {
    action: CustomerLinkAction;
    name: string;
    note: string;
    ip: string;
    userAgent: string;
    at: Date;
}

export interface CustomerLink {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    tokenHash: string;
    subjectType: CustomerLinkSubject;
    subjectId: string;
    createdBy: UserId | null;
    createdAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    lastViewedAt: Date | null;
    viewCount: number;
    respondedAt: Date | null;
    response: CustomerLinkAnswer | null;
}

/** Revoked or past its expiry: the public routes answer 404 as for a wrong token. */
export const isLinkUsable = (link: CustomerLink, now: Date): boolean =>
    link.revokedAt === null && link.expiresAt.getTime() > now.getTime();

export function linkStatus(link: CustomerLink, now: Date): CustomerLinkStatus {
    if (link.revokedAt !== null) return 'revoked';
    if (link.respondedAt !== null) return 'responded';
    return link.expiresAt.getTime() > now.getTime() ? 'active' : 'expired';
}

export const toCustomerLinkDto = (link: CustomerLink, now: Date): CustomerLinkDto => ({
    id: link.id,
    workspaceId: link.workspaceId,
    projectId: link.projectId,
    subjectType: link.subjectType,
    subjectId: link.subjectId,
    status: linkStatus(link, now),
    createdBy: link.createdBy,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt.toISOString(),
    revokedAt: link.revokedAt?.toISOString() ?? null,
    lastViewedAt: link.lastViewedAt?.toISOString() ?? null,
    viewCount: link.viewCount,
    respondedAt: link.respondedAt?.toISOString() ?? null,
    response: link.response === null ? null : {
        action: link.response.action, name: link.response.name, note: link.response.note, at: link.response.at.toISOString(),
    },
});
