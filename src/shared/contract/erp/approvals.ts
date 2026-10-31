// ─── Approval workflow (docs/erp/01-architecture.md §6, 02-domain-model.md §1.4): one generic flow for every ERP module ───
// A module asks `Approvals.request` (backend port) inside its own transaction; a solo workspace is approved at once
// (auto-skip, §6.3). Pending requests are decided through POST /approvals/:requestId/decide.
import { z } from 'zod';
import { type Role, isoDateTimeSchema, roleSchema, uuidSchema } from '../common';
import type { ModuleId } from '../modules';
import { amountSchema, cursorQuerySchema, signedAmountSchema } from './common';

/** What can be sent for approval (§6.1). */
export const APPROVAL_SUBJECTS = [
    'quotation.issue',
    'claim.submit',
    'variation.submit',
    'purchase_request.approve',
    'purchase_order.issue',
    'supplier_bill.approve',
    'payment_run.approve',
    'timesheet.approve',
    'pay_period.approve',
] as const;
export const approvalSubjectSchema = z.enum(APPROVAL_SUBJECTS);
export type ApprovalSubject = z.infer<typeof approvalSubjectSchema>;

/** pending → approved | rejected | cancelled (every end state is final). */
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export const approvalStatusSchema = z.enum(APPROVAL_STATUSES);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

/** Why a request was approved without anyone deciding (§6.3). */
export const APPROVAL_AUTO_REASONS = ['policy_off', 'below_threshold', 'self_approve', 'solo', 'no_approver'] as const;
export const approvalAutoReasonSchema = z.enum(APPROVAL_AUTO_REASONS);
export type ApprovalAutoReason = z.infer<typeof approvalAutoReasonSchema>;

export const APPROVAL_STEP_STATUSES = ['pending', 'approved', 'rejected', 'skipped'] as const;
export type ApprovalStepStatus = (typeof APPROVAL_STEP_STATUSES)[number];

export const APPROVAL_DECISIONS = ['approved', 'rejected'] as const;
export const approvalDecisionSchema = z.enum(APPROVAL_DECISIONS);
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

/** The rule of one subject in one workspace. */
export interface ApprovalPolicy {
    enabled: boolean;
    /** Amounts below it need no approval; null = every amount. */
    minAmount: number | null;
    /** Roles that may decide. The owner is always one of them. */
    approverRoles: Role[];
    /** An approver may approve their own request. */
    selfApprove: boolean;
}

export interface ApprovalSubjectDefault {
    /** The module that asks for this approval. */
    module: ModuleId;
    policy: ApprovalPolicy;
}

const policy = (enabled: boolean, approverRoles: Role[], minAmount: number | null = null): ApprovalPolicy => ({
    enabled, minAmount, approverRoles, selfApprove: true,
});

/** The policy of a subject while the workspace has not saved its own (§6.1). */
export const APPROVAL_SUBJECT_DEFAULTS: Readonly<Record<ApprovalSubject, ApprovalSubjectDefault>> = {
    'quotation.issue': { module: 'quotations', policy: policy(false, ['owner', 'admin']) },
    'claim.submit': { module: 'billing', policy: policy(false, ['owner', 'admin', 'pm']) },
    'variation.submit': { module: 'variations', policy: policy(false, ['owner', 'admin', 'pm']) },
    'purchase_request.approve': { module: 'procurement', policy: policy(true, ['owner', 'admin', 'pm', 'purchasing']) },
    'purchase_order.issue': { module: 'procurement', policy: policy(true, ['owner', 'admin', 'pm'], 50_000) },
    'supplier_bill.approve': { module: 'payables', policy: policy(false, ['owner', 'admin', 'accounting']) },
    'payment_run.approve': { module: 'payables', policy: policy(true, ['owner', 'admin']) },
    'timesheet.approve': { module: 'labour', policy: policy(false, ['owner', 'admin', 'pm']) },
    'pay_period.approve': { module: 'labour', policy: policy(true, ['owner', 'admin', 'accounting']) },
};

// ── policies ──

/** GET /workspaces/:workspaceId/approval-policies → one per subject (APPROVAL_SUBJECTS order). */
export const approvalPolicyDtoSchema = z.object({
    subject: approvalSubjectSchema,
    module: z.string(),
    enabled: z.boolean(),
    minAmount: amountSchema.nullable(),
    approverRoles: z.array(roleSchema),
    selfApprove: z.boolean(),
    /** true while the workspace uses APPROVAL_SUBJECT_DEFAULTS (no saved row). */
    isDefault: z.boolean(),
    updatedBy: uuidSchema.nullable(),
    updatedAt: isoDateTimeSchema.nullable(),
});
export type ApprovalPolicyDto = z.infer<typeof approvalPolicyDtoSchema>;
export const approvalPoliciesDtoSchema = z.array(approvalPolicyDtoSchema);

/** PUT /workspaces/:workspaceId/approval-policies/:subject (`company.manage`). The server always adds `owner` to the roles. */
export const putApprovalPolicyRequestSchema = z.object({
    enabled: z.boolean(),
    minAmount: amountSchema.nullable(),
    approverRoles: z.array(roleSchema).max(20),
    selfApprove: z.boolean(),
});
export type PutApprovalPolicyRequest = z.infer<typeof putApprovalPolicyRequestSchema>;

// ── requests ──

export const approvalRequestDtoSchema = z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    projectId: uuidSchema.nullable(),
    subject: approvalSubjectSchema,
    subjectId: uuidSchema,
    title: z.string(),
    /** May be negative (a variation that removes work). */
    amount: signedAmountSchema.nullable(),
    status: approvalStatusSchema,
    auto: z.boolean(),
    autoReason: approvalAutoReasonSchema.nullable(),
    /** Roles that may decide (of the pending step; empty for a request approved automatically). */
    approverRoles: z.array(roleSchema),
    requestedBy: uuidSchema,
    requestedByName: z.string().nullable(),
    requestedAt: isoDateTimeSchema,
    decidedBy: uuidSchema.nullable(),
    decidedByName: z.string().nullable(),
    decidedAt: isoDateTimeSchema.nullable(),
    decisionNote: z.string(),
    /** The caller may decide it now. */
    canDecide: z.boolean(),
});
export type ApprovalRequestDto = z.infer<typeof approvalRequestDtoSchema>;

/**
 * GET /workspaces/:workspaceId/approvals?status=&mine=&limit=&before= — newest first. `mine=true`: pending requests the
 * caller may decide. Otherwise every request (callers without `audit.read` see the ones they asked or may decide).
 */
export const approvalListQuerySchema = cursorQuerySchema.extend({
    status: approvalStatusSchema.optional(),
    mine: z.enum(['true', 'false']).optional(),
});
export type ApprovalListQuery = z.infer<typeof approvalListQuerySchema>;

export const approvalListDtoSchema = z.object({
    items: z.array(approvalRequestDtoSchema),
    /** Pass as `before` for the next (older) page; null on the last page. */
    nextBefore: z.string().nullable(),
});
export type ApprovalListDto = z.infer<typeof approvalListDtoSchema>;

/** POST /approvals/:requestId/decide → ApprovalRequestDto. */
export const decideApprovalRequestSchema = z.object({
    decision: approvalDecisionSchema,
    note: z.string().trim().max(1000).default(''),
});
export type DecideApprovalRequest = z.infer<typeof decideApprovalRequestSchema>;
