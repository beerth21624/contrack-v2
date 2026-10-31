import { Injectable } from '@nestjs/common';
import type { ApprovalStatus, ApprovalSubject } from '@contrack/contract';
import { ModuleAccess } from '../../../../shared/application/module-access';
import { UserDirectory } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, isUuid } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { effectivePolicy } from '../../domain/policies/approval-policy.policy';
import { type ApprovalRequestView, canDecide, toApprovalViews } from '../approval-views';
import { ApprovalPolicyRepository } from '../ports/approval-policy.repository';
import { type ApprovalCursor, type ApprovalListFilter, ApprovalRequestRepository } from '../ports/approval-request.repository';

export interface ListApprovalsInput {
    userId: UserId;
    workspaceId: WorkspaceId;
    status?: ApprovalStatus;
    /** Only pending requests the caller may decide now. */
    mine: boolean;
    /** Cursor `<requestedAt ISO>_<id>` from a previous page. */
    before?: string;
    limit: number;
}

export interface ApprovalPage {
    items: ApprovalRequestView[];
    nextBefore: string | null;
}

const encodeCursor = (c: ApprovalCursor): string => `${c.requestedAt.toISOString()}_${c.id}`;

function decodeCursor(raw: string): ApprovalCursor | undefined {
    const at = raw.lastIndexOf('_');
    if (at <= 0) return undefined;
    const requestedAt = new Date(raw.slice(0, at));
    const id = raw.slice(at + 1);
    // Outside years 1–9999 toISOString() has a sign/extended year that PostgreSQL cannot read back (500).
    const year = requestedAt.getUTCFullYear();
    if (Number.isNaN(requestedAt.getTime()) || year < 1 || year > 9999 || !isUuid(id)) return undefined;
    return { requestedAt, id: id.toLowerCase() };
}

/**
 * GET /workspaces/:workspaceId/approvals: any member while `project-hub` is active. `mine` = pending requests the caller
 * may decide; otherwise every request for `audit.read` holders, else the ones the caller asked for or may decide.
 */
@Injectable()
export class ListApprovalsUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly requests: ApprovalRequestRepository,
        private readonly policies: ApprovalPolicyRepository,
        private readonly users: UserDirectory,
    ) {}

    async execute(input: ListApprovalsInput): Promise<Result<ApprovalPage, DomainError>> {
        const grant = await this.access.inWorkspace(input.userId, input.workspaceId, 'project-hub');
        if (!grant.ok) return grant;
        const { role } = grant.value;
        const before = input.before === undefined ? undefined : decodeCursor(input.before);
        if (input.before !== undefined && before === undefined) return err(DomainError.validation('Invalid cursor'));
        const limit = Math.max(1, Math.min(200, Math.trunc(input.limit)));

        const filter: ApprovalListFilter = { status: input.status, before, limit: limit + 1 };
        if (input.mine) filter.pendingForRole = role;
        else if (!can(role, 'audit.read')) filter.visibleTo = { userId: input.userId, role };
        const rows = await this.requests.list(input.workspaceId, filter);

        const saved = new Map((await this.policies.listByWorkspace(input.workspaceId)).map(p => [p.subject, p]));
        const viewer = {
            userId: input.userId,
            role,
            selfApprove: (s: ApprovalSubject): boolean => effectivePolicy(s, saved.get(s)).selfApprove,
        };
        const page = rows.slice(0, limit);
        const shown = input.mine ? page.filter(r => canDecide(r, viewer)) : page;
        const last = page.at(-1);
        return ok({
            items: await toApprovalViews(this.users, shown, viewer),
            nextBefore: rows.length > limit && last !== undefined ? encodeCursor(last.toProps()) : null,
        });
    }
}
