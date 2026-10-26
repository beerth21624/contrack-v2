// ─── Progress claim (ใบเบิกงวด): requested → inspected (pass | pass_with_fixes | fail) → approved → paid ───
// fail → requested again (the vendor fixes and claims again) · requested / inspected → rejected. One non-rejected claim
// per installment (plan §6 rule 9, §7).
import type { ClaimStatus, InspectionResult } from '@contrack/contract';
import type { ClaimAmountsResult } from '@contrack/domain/subcontracting/claims';
import { DomainError, type Result, type UserId, type WorkspaceId, err, ok, okVoid } from '../../../../../shared/domain';
import type { ClaimId, SubcontractId } from '../../../shared/ids';

export type Side = 'buyer' | 'vendor';

export interface Inspection {
    result: InspectionResult;
    checklist: { item: string; ok: boolean }[];
    fixes: { text: string; done: boolean }[];
    note: string;
    byUserId: UserId;
    byName: string;
    at: Date;
}

export interface ClaimProps {
    id: ClaimId;
    subcontractId: SubcontractId;
    buyerWorkspaceId: WorkspaceId;
    installmentNo: number;
    condition: string;
    status: ClaimStatus;
    requestedBy: Side;
    requestedByUser: UserId;
    requestedAt: Date;
    photoFileIds: string[];
    note: string;
    inspection: Inspection | null;
    amounts: ClaimAmountsResult;
    approvedBy: UserId | null;
    approvedAt: Date | null;
    /** YYYY-MM-DD. */
    paidAt: string | null;
    paidAmount: number | null;
    paidChannel: string | null;
    paidRef: string | null;
    paidBy: UserId | null;
    rejectedReason: string | null;
    rejectedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface NewClaim {
    id: ClaimId;
    subcontractId: SubcontractId;
    buyerWorkspaceId: WorkspaceId;
    installmentNo: number;
    condition: string;
    requestedBy: Side;
    requestedByUser: UserId;
    photoFileIds: string[];
    note: string;
    amounts: ClaimAmountsResult;
    now: Date;
}

function wrongState(action: string, status: ClaimStatus, extra?: Record<string, unknown>): DomainError {
    return DomainError.conflict(`Cannot ${action} a claim that is ${status}`, { status, ...extra });
}

export class Claim {
    private constructor(private props: ClaimProps) {}

    static request(input: NewClaim): Claim {
        return new Claim({
            id: input.id,
            subcontractId: input.subcontractId,
            buyerWorkspaceId: input.buyerWorkspaceId,
            installmentNo: input.installmentNo,
            condition: input.condition,
            status: 'requested',
            requestedBy: input.requestedBy,
            requestedByUser: input.requestedByUser,
            requestedAt: input.now,
            photoFileIds: [...input.photoFileIds],
            note: input.note,
            inspection: null,
            amounts: input.amounts,
            approvedBy: null,
            approvedAt: null,
            paidAt: null,
            paidAmount: null,
            paidChannel: null,
            paidRef: null,
            paidBy: null,
            rejectedReason: null,
            rejectedAt: null,
            createdAt: input.now,
            updatedAt: input.now,
        });
    }

    static rehydrate(props: ClaimProps): Claim {
        return new Claim(structuredClone(props));
    }

    toProps(): ClaimProps {
        return structuredClone(this.props);
    }

    get id(): ClaimId { return this.props.id; }
    get subcontractId(): SubcontractId { return this.props.subcontractId; }
    get installmentNo(): number { return this.props.installmentNo; }
    get status(): ClaimStatus { return this.props.status; }
    get inspection(): Inspection | null { return this.props.inspection; }
    get amounts(): ClaimAmountsResult { return this.props.amounts; }
    get requestedAt(): Date { return this.props.requestedAt; }
    get state(): Readonly<ClaimProps> { return this.props; }

    /** A failed inspection may be claimed again (same claim back to requested). */
    canBeRequestedAgain(): boolean {
        return this.props.status === 'inspected' && this.props.inspection?.result === 'fail';
    }

    hasOpenFixes(): boolean {
        return this.props.inspection?.fixes.some(f => !f.done) ?? false;
    }

    requestAgain(input: { requestedBy: Side; requestedByUser: UserId; photoFileIds: string[]; note: string; amounts: ClaimAmountsResult; now: Date }): Result<undefined, DomainError> {
        if (!this.canBeRequestedAgain()) return err(wrongState('claim again', this.props.status));
        Object.assign(this.props, {
            status: 'requested', requestedBy: input.requestedBy, requestedByUser: input.requestedByUser, requestedAt: input.now,
            photoFileIds: [...input.photoFileIds], note: input.note, inspection: null, amounts: input.amounts, updatedAt: input.now,
        });
        return okVoid();
    }

    /**
     * requested / inspected → inspected with the (new) result. On an approved or paid claim it is a follow-up (that is
     * how open fixes get closed): checklist, fixes and note are updated, while the result, status and amounts stay.
     * Returns whether it was a follow-up.
     */
    inspect(inspection: Inspection): Result<{ followUp: boolean }, DomainError> {
        const s = this.props.status;
        if (s === 'requested' || s === 'inspected') {
            Object.assign(this.props, { status: 'inspected', inspection, updatedAt: inspection.at });
            return ok({ followUp: false });
        }
        const before = this.props.inspection;
        if ((s === 'approved' || s === 'paid') && before !== null) {
            this.props.inspection = { ...inspection, result: before.result };
            this.props.updatedAt = inspection.at;
            return ok({ followUp: true });
        }
        return err(wrongState('inspect', s));
    }

    approve(amounts: ClaimAmountsResult, by: UserId, now: Date): Result<undefined, DomainError> {
        if (this.props.status !== 'inspected') return err(wrongState('approve', this.props.status, { reason: 'not_inspected' }));
        if (this.props.inspection?.result === 'fail') return err(wrongState('approve', this.props.status, { reason: 'inspection_failed' }));
        Object.assign(this.props, { status: 'approved', amounts, approvedBy: by, approvedAt: now, updatedAt: now });
        return okVoid();
    }

    pay(input: { paidAt: string; amount: number; channel: string; ref: string; by: UserId; now: Date }): Result<undefined, DomainError> {
        if (this.props.status !== 'approved') return err(wrongState('record the payment of', this.props.status));
        Object.assign(this.props, {
            status: 'paid', paidAt: input.paidAt, paidAmount: input.amount, paidChannel: input.channel, paidRef: input.ref,
            paidBy: input.by, updatedAt: input.now,
        });
        return okVoid();
    }

    reject(reason: string, now: Date): Result<undefined, DomainError> {
        if (this.props.status !== 'requested' && this.props.status !== 'inspected') return err(wrongState('reject', this.props.status));
        Object.assign(this.props, { status: 'rejected', rejectedReason: reason, rejectedAt: now, updatedAt: now });
        return okVoid();
    }
}
