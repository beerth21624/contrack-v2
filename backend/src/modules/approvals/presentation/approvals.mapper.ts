import type { ApprovalPolicyDto, ApprovalRequestDto } from '@contrack/contract';
import { APPROVAL_SUBJECT_DEFAULTS } from '@contrack/contract';
import type { ApprovalRequestView } from '../application/approval-views';
import type { ApprovalPolicyView } from '../application/use-cases/approval-policies.use-cases';

export function approvalRequestToDto(v: ApprovalRequestView): ApprovalRequestDto {
    return {
        id: v.id,
        workspaceId: v.workspaceId,
        projectId: v.projectId,
        subject: v.subject,
        subjectId: v.subjectId,
        title: v.title,
        amount: v.amount,
        status: v.status,
        auto: v.auto,
        autoReason: v.autoReason,
        approverRoles: v.approverRoles,
        requestedBy: v.requestedBy,
        requestedByName: v.requestedByName,
        requestedAt: v.requestedAt.toISOString(),
        decidedBy: v.decidedBy,
        decidedByName: v.decidedByName,
        decidedAt: v.decidedAt === null ? null : v.decidedAt.toISOString(),
        decisionNote: v.decisionNote,
        canDecide: v.canDecide,
    };
}

export function approvalPolicyToDto(v: ApprovalPolicyView): ApprovalPolicyDto {
    return {
        subject: v.subject,
        module: APPROVAL_SUBJECT_DEFAULTS[v.subject].module,
        enabled: v.enabled,
        minAmount: v.minAmount,
        approverRoles: v.approverRoles,
        selfApprove: v.selfApprove,
        isDefault: v.isDefault,
        updatedBy: v.updatedBy,
        updatedAt: v.updatedAt === null ? null : v.updatedAt.toISOString(),
    };
}
