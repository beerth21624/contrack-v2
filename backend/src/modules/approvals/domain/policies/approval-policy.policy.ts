// ─── The policy that applies to a subject: the workspace's saved row, else APPROVAL_SUBJECT_DEFAULTS (§6.1) ───
import { APPROVAL_SUBJECT_DEFAULTS, type ApprovalPolicy, type ApprovalSubject, ROLES, type Role } from '@contrack/contract';
import { round2 } from '@contrack/domain/money';

/** Owner always approves; no duplicates; ROLES order (so a saved policy compares equal to the same choice). */
export function normalizeApproverRoles(roles: readonly Role[]): Role[] {
    const chosen = new Set<Role>([...roles, 'owner']);
    return ROLES.filter(r => chosen.has(r));
}

/** A policy as stored: roles normalized, `minAmount` rounded to satang (null stays null). */
export function normalizePolicy(p: ApprovalPolicy): ApprovalPolicy {
    return {
        enabled: p.enabled,
        minAmount: p.minAmount === null ? null : round2(p.minAmount),
        approverRoles: normalizeApproverRoles(p.approverRoles),
        selfApprove: p.selfApprove,
    };
}

export function defaultPolicy(subject: ApprovalSubject): ApprovalPolicy {
    const d = APPROVAL_SUBJECT_DEFAULTS[subject].policy;
    return { ...d, approverRoles: [...d.approverRoles] };
}

export function effectivePolicy(subject: ApprovalSubject, saved: ApprovalPolicy | undefined): ApprovalPolicy {
    return saved === undefined ? defaultPolicy(subject) : { ...saved, approverRoles: [...saved.approverRoles] };
}
