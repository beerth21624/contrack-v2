// ─── What the approval screens get: the request, the names of the people on it, whether the caller may decide ───
import type { ApprovalSubject, Role } from '@contrack/contract';
import type { UserDirectory } from '../../../shared/application/ports';
import type { UserId } from '../../../shared/domain/ids';
import type { ApprovalRequest, ApprovalRequestProps } from '../domain/entities/approval-request.entity';
import { mayDecide } from '../domain/policies/auto-skip.policy';

export interface ApprovalRequestView extends ApprovalRequestProps {
    approverRoles: Role[];
    requestedByName: string | null;
    decidedByName: string | null;
    canDecide: boolean;
}

export interface Viewer {
    userId: UserId;
    role: Role;
    /** selfApprove of the subject's current policy. */
    selfApprove: (subject: ApprovalSubject) => boolean;
}

export function canDecide(request: ApprovalRequest, viewer: Viewer): boolean {
    return request.status === 'pending' && mayDecide({
        userId: viewer.userId,
        role: viewer.role,
        approverRoles: request.approverRoles,
        requestedBy: request.requestedBy,
        selfApprove: viewer.selfApprove(request.subject),
    });
}

export async function toApprovalViews(
    users: UserDirectory, requests: readonly ApprovalRequest[], viewer: Viewer,
): Promise<ApprovalRequestView[]> {
    const ids = new Set<UserId>();
    for (const r of requests) {
        const p = r.toProps();
        ids.add(p.requestedBy);
        if (p.decidedBy !== null) ids.add(p.decidedBy);
    }
    const names = ids.size === 0 ? new Map<UserId, { displayName: string }>() : await users.findMany([...ids]);
    return requests.map(r => {
        const p = r.toProps();
        return {
            ...p,
            approverRoles: r.approverRoles,
            requestedByName: names.get(p.requestedBy)?.displayName ?? null,
            decidedByName: p.decidedBy === null ? null : (names.get(p.decidedBy)?.displayName ?? null),
            canDecide: canDecide(r, viewer),
        };
    });
}
