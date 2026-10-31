import {
    type ApprovalListDto, type ApprovalListQuery, type ApprovalPolicyDto, type ApprovalRequestDto, type ApprovalSubject,
    type AuditListDto, type DecideApprovalRequest, type PutApprovalPolicyRequest,
    approvalListDtoSchema, approvalPoliciesDtoSchema, approvalPolicyDtoSchema, approvalRequestDtoSchema, auditListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, workspacePath } from '../shared/apiPaths';

export interface AuditQuery {
    entityType?: string;
    entityId?: string;
    before?: string;
    limit?: number;
}

export const approvalsApi = {
    list: (workspaceId: string, query: Pick<ApprovalListQuery, 'status' | 'mine' | 'before'> & { limit: number }): Promise<ApprovalListDto> =>
        apiClient.request('GET', workspacePath(workspaceId, 'approvals'), {
            schema: approvalListDtoSchema,
            query: { status: query.status, mine: query.mine, before: query.before, limit: query.limit },
        }),
    decide: (requestId: string, body: DecideApprovalRequest): Promise<ApprovalRequestDto> =>
        apiClient.request('POST', apiPath('approvals', requestId, 'decide'), { body, schema: approvalRequestDtoSchema }),
    policies: (workspaceId: string): Promise<ApprovalPolicyDto[]> =>
        apiClient.request('GET', workspacePath(workspaceId, 'approval-policies'), { schema: approvalPoliciesDtoSchema }),
    putPolicy: (workspaceId: string, subject: ApprovalSubject, body: PutApprovalPolicyRequest): Promise<ApprovalPolicyDto> =>
        apiClient.request('PUT', workspacePath(workspaceId, 'approval-policies', subject), { body, schema: approvalPolicyDtoSchema }),
    audit: (workspaceId: string, query: AuditQuery): Promise<AuditListDto> =>
        apiClient.request('GET', workspacePath(workspaceId, 'audit'), {
            schema: auditListDtoSchema,
            query: { entityType: query.entityType, entityId: query.entityId, before: query.before, limit: query.limit ?? 20 },
        }),
};
