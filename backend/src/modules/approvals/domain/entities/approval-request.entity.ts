// ─── ApprovalRequest: one send-for-approval of a document (docs/erp/02-domain-model.md §1.4) ───
// Automatic approvals are stored too (status approved, auto=true, autoReason) for the audit trail. v1 has one step.
import type { ApprovalAutoReason, ApprovalDecision, ApprovalStatus, ApprovalStepStatus, ApprovalSubject, Role } from '@contrack/contract';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, okVoid } from '../../../../shared/domain/result';
import type { ApprovalRequestId, ApprovalStepId } from '../approvals-ids';
import { requireStatus } from '../approvals-state';

export interface ApprovalStepProps {
    id: ApprovalStepId;
    seq: number;
    approverRoles: Role[];
    status: ApprovalStepStatus;
    decidedBy: UserId | null;
    decidedAt: Date | null;
    note: string;
}

export interface ApprovalRequestProps {
    id: ApprovalRequestId;
    workspaceId: WorkspaceId;
    projectId: ProjectId | null;
    subject: ApprovalSubject;
    subjectId: string;
    title: string;
    amount: number | null;
    status: ApprovalStatus;
    auto: boolean;
    autoReason: ApprovalAutoReason | null;
    requestedBy: UserId;
    requestedAt: Date;
    decidedBy: UserId | null;
    decidedAt: Date | null;
    decisionNote: string;
    steps: ApprovalStepProps[];
}

export interface NewApprovalRequest {
    id: ApprovalRequestId;
    workspaceId: WorkspaceId;
    projectId: ProjectId | null;
    subject: ApprovalSubject;
    subjectId: string;
    title: string;
    amount: number | null;
    requestedBy: UserId;
    now: Date;
}

const copyDate = (d: Date | null): Date | null => (d === null ? null : new Date(d.getTime()));

export class ApprovalRequest {
    private constructor(private props: ApprovalRequestProps) {}

    static rehydrate(props: ApprovalRequestProps): ApprovalRequest {
        return new ApprovalRequest(ApprovalRequest.copy(props));
    }

    /** Approved at once by an auto-skip rule (no step). */
    static autoApproved(n: NewApprovalRequest, reason: ApprovalAutoReason): ApprovalRequest {
        return new ApprovalRequest({
            ...ApprovalRequest.base(n), status: 'approved', auto: true, autoReason: reason, decidedAt: new Date(n.now.getTime()), steps: [],
        });
    }

    /** Waiting for one of `approverRoles` (step 1). */
    static pending(n: NewApprovalRequest, stepId: ApprovalStepId, approverRoles: readonly Role[]): ApprovalRequest {
        return new ApprovalRequest({
            ...ApprovalRequest.base(n),
            status: 'pending',
            auto: false,
            autoReason: null,
            decidedAt: null,
            steps: [{ id: stepId, seq: 1, approverRoles: [...approverRoles], status: 'pending', decidedBy: null, decidedAt: null, note: '' }],
        });
    }

    private static base(n: NewApprovalRequest): Omit<ApprovalRequestProps, 'status' | 'auto' | 'autoReason' | 'decidedAt' | 'steps'> {
        return {
            id: n.id, workspaceId: n.workspaceId, projectId: n.projectId, subject: n.subject, subjectId: n.subjectId, title: n.title,
            amount: n.amount, requestedBy: n.requestedBy, requestedAt: new Date(n.now.getTime()), decidedBy: null, decisionNote: '',
        };
    }

    private static copy(p: ApprovalRequestProps): ApprovalRequestProps {
        return {
            ...p,
            requestedAt: new Date(p.requestedAt.getTime()),
            decidedAt: copyDate(p.decidedAt),
            steps: p.steps.map(s => ({ ...s, approverRoles: [...s.approverRoles], decidedAt: copyDate(s.decidedAt) })),
        };
    }

    get id(): ApprovalRequestId { return this.props.id; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get projectId(): ProjectId | null { return this.props.projectId; }
    get subject(): ApprovalSubject { return this.props.subject; }
    get subjectId(): string { return this.props.subjectId; }
    get status(): ApprovalStatus { return this.props.status; }
    get auto(): boolean { return this.props.auto; }
    get autoReason(): ApprovalAutoReason | null { return this.props.autoReason; }
    get requestedBy(): UserId { return this.props.requestedBy; }
    get amount(): number | null { return this.props.amount; }

    /** Roles of the current (or last) step; empty for an automatic approval. */
    get approverRoles(): Role[] {
        const step = this.currentStep() ?? this.props.steps.at(-1);
        return step === undefined ? [] : [...step.approverRoles];
    }

    /** One of the approver roles decides; conflict `invalid_transition` unless pending. */
    decide(decision: ApprovalDecision, by: UserId, note: string, now: Date): Result<void, DomainError> {
        const allowed = requireStatus(this.props.status, ['pending']);
        if (!allowed.ok) return allowed;
        this.props.status = decision;
        this.props.decidedBy = by;
        this.props.decidedAt = new Date(now.getTime());
        this.props.decisionNote = note;
        const step = this.currentStep();
        if (step !== undefined) {
            step.status = decision;
            step.decidedBy = by;
            step.decidedAt = new Date(now.getTime());
            step.note = note;
        }
        return okVoid();
    }

    /** The document was withdrawn; conflict `invalid_transition` unless pending. */
    cancel(by: UserId, now: Date): Result<void, DomainError> {
        const allowed = requireStatus(this.props.status, ['pending']);
        if (!allowed.ok) return allowed;
        this.props.status = 'cancelled';
        this.props.decidedBy = by;
        this.props.decidedAt = new Date(now.getTime());
        for (const step of this.props.steps) {
            if (step.status === 'pending') step.status = 'skipped';
        }
        return okVoid();
    }

    private currentStep(): ApprovalStepProps | undefined {
        return this.props.steps.find(s => s.status === 'pending');
    }

    toProps(): ApprovalRequestProps {
        return ApprovalRequest.copy(this.props);
    }
}
