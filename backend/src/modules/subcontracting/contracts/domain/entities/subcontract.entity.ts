// ─── Subcontract (สัญญาจ้างช่วง): pending_acceptance → active → completed → closed · pending → cancelled · active → terminated ───
// Plan §7. The value changes only through accepted variations (rule 8): total = baseTotal + variationsTotal.
import type {
    InstallmentDto, LocationDto, MaterialBy, ScheduleDto, SubcontractStatus, SubcontractTerms, TradeId,
} from '@contrack/contract';
import { type InstallmentAmount, installmentAmounts } from '@contrack/domain/subcontracting/claims';
import { round2 } from '@contrack/domain/subcontracting/snapshot';
import {
    DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, err, ok, okVoid,
} from '../../../../../shared/domain';
import type { BidId, PackageId, ScInvitationId, SubcontractId, VendorListEntryId } from '../../../shared/ids';

export interface SubcontractLine {
    idx: number;
    /** BOQ line key of the package line (null for a typed line). */
    lineKey: string | null;
    desc: string;
    unit: string;
    qty: number;
    unitPrice: number | null;
    matUnitPrice: number | null;
    total: number;
    materialBy: MaterialBy;
}

export interface SubcontractProps {
    id: SubcontractId;
    buyerWorkspaceId: WorkspaceId;
    projectId: ProjectId;
    packageId: PackageId;
    bidId: BidId;
    invitationId: ScInvitationId;
    vendorListEntryId: VendorListEntryId;
    vendorWorkspaceId: WorkspaceId | null;
    vendorName: string;
    buyerName: string;
    projectName: string;
    contractNo: string;
    year: number;
    seq: number;
    title: string;
    trade: TradeId;
    location: LocationDto;
    lines: SubcontractLine[];
    baseTotal: number;
    variationsTotal: number;
    total: number;
    terms: SubcontractTerms;
    schedule: ScheduleDto;
    installments: InstallmentDto[];
    documentVersion: number;
    signedScanFileId: string | null;
    status: SubcontractStatus;
    acceptedBy: UserId | null;
    acceptedAt: Date | null;
    acceptedIp: string | null;
    activatedAt: Date | null;
    completedAt: Date | null;
    closedAt: Date | null;
    cancelledAt: Date | null;
    terminatedAt: Date | null;
    endReason: string | null;
    retentionReminders: string[];
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

export type NewSubcontract = Omit<SubcontractProps,
    'status' | 'variationsTotal' | 'total' | 'documentVersion' | 'signedScanFileId' | 'acceptedBy' | 'acceptedAt'
    | 'acceptedIp' | 'activatedAt' | 'completedAt' | 'closedAt' | 'cancelledAt' | 'terminatedAt' | 'endReason'
    | 'retentionReminders' | 'updatedAt'>;

/** Formats the contract number: SC-2026-0001. */
export function contractNumber(year: number, seq: number): string {
    return `SC-${year}-${String(seq).padStart(4, '0')}`;
}

/** Subcontract statuses that still hold work or money (not cancelled). */
export const LIVE_STATUSES: readonly SubcontractStatus[] = ['pending_acceptance', 'active', 'completed', 'closed', 'terminated'];

function wrongState(action: string, status: SubcontractStatus): DomainError {
    return DomainError.conflict(`Cannot ${action} a subcontract that is ${status}`, { status });
}

export class Subcontract {
    private constructor(private props: SubcontractProps) {}

    static create(input: NewSubcontract): Subcontract {
        return new Subcontract({
            ...input,
            status: 'pending_acceptance',
            variationsTotal: 0,
            total: round2(input.baseTotal),
            documentVersion: 1,
            signedScanFileId: null,
            acceptedBy: null,
            acceptedAt: null,
            acceptedIp: null,
            activatedAt: null,
            completedAt: null,
            closedAt: null,
            cancelledAt: null,
            terminatedAt: null,
            endReason: null,
            retentionReminders: [],
            updatedAt: input.createdAt,
        });
    }

    static rehydrate(props: SubcontractProps): Subcontract {
        return new Subcontract(structuredClone(props));
    }

    toProps(): SubcontractProps {
        return structuredClone(this.props);
    }

    get id(): SubcontractId { return this.props.id; }
    get buyerWorkspaceId(): WorkspaceId { return this.props.buyerWorkspaceId; }
    get vendorWorkspaceId(): WorkspaceId | null { return this.props.vendorWorkspaceId; }
    get projectId(): ProjectId { return this.props.projectId; }
    get packageId(): PackageId { return this.props.packageId; }
    get status(): SubcontractStatus { return this.props.status; }
    get title(): string { return this.props.title; }
    get vendorName(): string { return this.props.vendorName; }
    get buyerName(): string { return this.props.buyerName; }
    get total(): number { return this.props.total; }
    get documentVersion(): number { return this.props.documentVersion; }
    get terms(): SubcontractTerms { return this.props.terms; }
    get completedAt(): Date | null { return this.props.completedAt; }
    get retentionReminders(): readonly string[] { return this.props.retentionReminders; }
    get state(): Readonly<SubcontractProps> { return this.props; }

    /** Amount of each installment (the last absorbs rounding and accepted variations). */
    installmentAmounts(): InstallmentAmount[] {
        return installmentAmounts(this.props.installments, this.props.baseTotal, this.props.variationsTotal);
    }

    installmentAmount(no: number): InstallmentAmount | undefined {
        return this.installmentAmounts().find(i => i.no === no);
    }

    lastInstallmentNo(): number {
        return Math.max(...this.props.installments.map(i => i.no));
    }

    /** The vendor accepts the CURRENT document version → active. */
    accept(documentVersion: number, by: UserId, ip: string | null, now: Date): Result<undefined, DomainError> {
        if (this.props.status !== 'pending_acceptance') return err(wrongState('accept', this.props.status));
        if (documentVersion !== this.props.documentVersion) {
            return err(DomainError.conflict('The contract document changed: read the current version first', { currentVersion: this.props.documentVersion }));
        }
        Object.assign(this.props, { status: 'active', acceptedBy: by, acceptedAt: now, acceptedIp: ip, activatedAt: now, updatedAt: now });
        return okVoid();
    }

    /** Only before acceptance. */
    canEditDocument(): boolean {
        return this.props.status === 'pending_acceptance';
    }

    newDocumentVersion(now: Date): Result<number, DomainError> {
        if (!this.canEditDocument()) return err(wrongState('edit the document of', this.props.status));
        this.props.documentVersion += 1;
        this.props.updatedAt = now;
        return ok(this.props.documentVersion);
    }

    requireStatus(action: string, ...allowed: SubcontractStatus[]): Result<undefined, DomainError> {
        return allowed.includes(this.props.status) ? okVoid() : err(wrongState(action, this.props.status));
    }

    cancel(reason: string, now: Date): Result<undefined, DomainError> {
        if (this.props.status !== 'pending_acceptance') return err(wrongState('cancel', this.props.status));
        Object.assign(this.props, { status: 'cancelled', cancelledAt: now, endReason: reason, updatedAt: now });
        return okVoid();
    }

    terminate(reason: string, now: Date): Result<undefined, DomainError> {
        if (this.props.status !== 'active') return err(wrongState('terminate', this.props.status));
        Object.assign(this.props, { status: 'terminated', terminatedAt: now, endReason: reason, updatedAt: now });
        return okVoid();
    }

    /** Caller checks that every installment is paid. */
    complete(now: Date): Result<undefined, DomainError> {
        if (this.props.status !== 'active') return err(wrongState('complete', this.props.status));
        Object.assign(this.props, { status: 'completed', completedAt: now, updatedAt: now });
        return okVoid();
    }

    /** Caller checks that the retention balance is 0. */
    close(now: Date): Result<undefined, DomainError> {
        if (this.props.status !== 'completed') return err(wrongState('close', this.props.status));
        Object.assign(this.props, { status: 'closed', closedAt: now, updatedAt: now });
        return okVoid();
    }

    /** An accepted variation changes the value; the last installment takes the difference. */
    applyVariation(amount: number, now: Date): Result<undefined, DomainError> {
        if (this.props.status !== 'active') return err(wrongState('change the value of', this.props.status));
        const variationsTotal = round2(this.props.variationsTotal + amount);
        const total = round2(this.props.baseTotal + variationsTotal);
        const last = installmentAmounts(this.props.installments, this.props.baseTotal, variationsTotal).at(-1);
        if (total < 0 || (last?.amount ?? 0) < 0) {
            return err(DomainError.unprocessable('The variation would make the last installment negative', { total, lastInstallment: last?.amount }));
        }
        Object.assign(this.props, { variationsTotal, total, updatedAt: now });
        return okVoid();
    }

    attachSignedScan(fileId: string, now: Date): Result<undefined, DomainError> {
        if (this.props.status === 'cancelled') return err(wrongState('attach a scan to', this.props.status));
        Object.assign(this.props, { signedScanFileId: fileId, updatedAt: now });
        return okVoid();
    }

    /** The winner signed up after the award: the contract now belongs to that crew too. */
    linkVendor(vendorWorkspaceId: WorkspaceId, vendorName: string | undefined, now: Date): boolean {
        if (this.props.vendorWorkspaceId !== null) return false;
        Object.assign(this.props, { vendorWorkspaceId, vendorName: vendorName ?? this.props.vendorName, updatedAt: now });
        return true;
    }

    markRetentionReminded(key: string): void {
        if (!this.props.retentionReminders.includes(key)) this.props.retentionReminders.push(key);
    }
}
