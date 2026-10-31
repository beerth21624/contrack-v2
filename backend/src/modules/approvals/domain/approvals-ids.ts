import type { Brand } from '../../../shared/domain/ids';

export type ApprovalRequestId = Brand<string, 'ApprovalRequestId'>;
export type ApprovalStepId = Brand<string, 'ApprovalStepId'>;

export const asApprovalRequestId = (v: string): ApprovalRequestId => v as ApprovalRequestId;
export const asApprovalStepId = (v: string): ApprovalStepId => v as ApprovalStepId;
