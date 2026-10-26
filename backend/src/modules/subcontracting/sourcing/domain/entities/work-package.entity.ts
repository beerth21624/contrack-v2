// ─── Work package (แพ็กเกจงาน): lines frozen from the BOQ + terms, sent to crews for prices (plan §4.3, §6, §7) ───
// draft → open → (reviewing) → awarded → closed · open/reviewing/expired → cancelled · open → expired (deadline passed
// without a bid; extending reopens it) · addendum = version + 1 (status unchanged).
// While draft everything may change and the snapshot is re-taken; sending re-takes it once more (version stays 1).
// After sending, lines change only through an addendum; other edits: description and a later bid deadline.
import type {
    InstallmentDto, LocationDto, MaterialBy, PackageStatus, PackageTerms, PricingMode, ScheduleDto, SourcingMode,
    SupplyMode, TradeId,
} from '@contrack/contract';
import type { CustomLine, Snapshot, SnapshotLine } from '@contrack/domain/subcontracting';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { SourcingErrors } from '../sourcing.errors';

export interface PackageSelection {
    lineKeys: string[];
    customLines: CustomLine[];
    materialByLine: Record<string, MaterialBy>;
}

export interface PackageVersion {
    version: number;
    lines: SnapshotLine[];
    /** Lines that differ from the previous version (empty for version 1). */
    changedIdx: number[];
    note: string;
    createdBy: UserId;
    createdAt: Date;
}

export interface PackageFields {
    title: string;
    trade: TradeId;
    supplyMode: SupplyMode;
    pricingMode: PricingMode;
    sourcingMode: SourcingMode;
    terms: PackageTerms;
    schedule: ScheduleDto;
    installments: InstallmentDto[];
    location: LocationDto;
    hideOwnerIdentity: boolean;
    bidDeadline: Date;
    priceValidUntil: string;
    description: string;
}

export interface WorkPackageProps extends PackageFields {
    id: PackageId;
    buyerWorkspaceId: WorkspaceId;
    projectId: ProjectId;
    /** Project name when the package was created (for vendors after award, contracts, lists). */
    projectName: string;
    /** Stored status; reads use `effectiveStatus` (the deadline may have passed since). */
    status: PackageStatus;
    selection: PackageSelection;
    versions: PackageVersion[];
    estimateTotal: number;
    fileIds: string[];
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
    sentAt: Date | null;
    awardedAt: Date | null;
    closedAt: Date | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
}

/** Sent and still collecting / reviewing prices (not decided, not cancelled). */
const ACTIVE: readonly PackageStatus[] = ['open', 'reviewing', 'expired'];
/** Fields that may change after sending. */
const AFTER_SEND_FIELDS = new Set(['description', 'bidDeadline']);

export type PackagePatch = Partial<PackageFields>;

export class WorkPackage {
    private constructor(private p: WorkPackageProps) {}

    static create(input: {
        id: PackageId; buyerWorkspaceId: WorkspaceId; projectId: ProjectId; projectName: string; fields: PackageFields;
        selection: PackageSelection; snapshot: Snapshot; createdBy: UserId; now: Date;
    }): Result<WorkPackage, DomainError> {
        if (input.fields.sourcingMode === 'open') return err(SourcingErrors.openSourcingUnsupported());
        if (input.snapshot.lines.length === 0) return err(SourcingErrors.noLines());
        return ok(new WorkPackage({
            ...input.fields,
            title: input.fields.title.trim(),
            id: input.id,
            buyerWorkspaceId: input.buyerWorkspaceId,
            projectId: input.projectId,
            projectName: input.projectName,
            status: 'draft',
            selection: structuredClone(input.selection),
            versions: [{ version: 1, lines: input.snapshot.lines, changedIdx: [], note: '', createdBy: input.createdBy, createdAt: input.now }],
            estimateTotal: input.snapshot.estimateTotal,
            fileIds: [],
            createdBy: input.createdBy,
            createdAt: input.now,
            updatedAt: input.now,
            sentAt: null,
            awardedAt: null,
            closedAt: null,
            cancelledAt: null,
            cancelReason: null,
        }));
    }

    static rehydrate(props: WorkPackageProps): WorkPackage {
        return new WorkPackage({ ...props });
    }

    get props(): Readonly<WorkPackageProps> {
        return this.p;
    }

    get id(): PackageId {
        return this.p.id;
    }

    get buyerWorkspaceId(): WorkspaceId {
        return this.p.buyerWorkspaceId;
    }

    get status(): PackageStatus {
        return this.p.status;
    }

    get current(): PackageVersion {
        const v = this.p.versions[this.p.versions.length - 1];
        if (v === undefined) throw new Error(`Package ${this.p.id} has no version`);
        return v;
    }

    get version(): number {
        return this.current.version;
    }

    get lines(): SnapshotLine[] {
        return this.current.lines;
    }

    get isDraft(): boolean {
        return this.p.status === 'draft';
    }

    /** Sent, not decided, not cancelled. */
    get isActive(): boolean {
        return ACTIVE.includes(this.p.status);
    }

    versionLines(version: number): SnapshotLine[] | undefined {
        return this.p.versions.find(v => v.version === version)?.lines;
    }

    /** What a reader sees: an open package past its deadline is reviewing (with a bid) or expired (without). */
    effectiveStatus(now: Date, anySubmitted: boolean): PackageStatus {
        if (this.p.status !== 'open' || now.getTime() < this.p.bidDeadline.getTime()) return this.p.status;
        return anySubmitted ? 'reviewing' : 'expired';
    }

    /** Stores the effective status (before a write, or by the sweep). True when it changed. */
    settle(now: Date, anySubmitted: boolean): boolean {
        const status = this.effectiveStatus(now, anySubmitted);
        if (status === this.p.status) return false;
        this.p = { ...this.p, status, updatedAt: now };
        return true;
    }

    /** True while vendors can still bid / ask / decline. */
    acceptsResponses(now: Date): boolean {
        return this.p.status === 'open' && now.getTime() < this.p.bidDeadline.getTime();
    }

    /** Any field while draft; `snapshot` is the re-taken snapshot when lines or supply changed. */
    editDraft(patch: PackagePatch, selection: PackageSelection | undefined, snapshot: Snapshot | undefined, now: Date): Result<undefined, DomainError> {
        if (!this.isDraft) return err(SourcingErrors.notDraft());
        if (patch.sourcingMode === 'open') return err(SourcingErrors.openSourcingUnsupported());
        if (snapshot?.lines.length === 0) return err(SourcingErrors.noLines());
        const next: WorkPackageProps = { ...this.p, ...definedOnly(patch), updatedAt: now };
        if (patch.title !== undefined) next.title = patch.title.trim();
        if (selection !== undefined) next.selection = structuredClone(selection);
        if (snapshot !== undefined) {
            next.versions = [{ ...this.current, lines: snapshot.lines }];
            next.estimateTotal = snapshot.estimateTotal;
        }
        this.p = next;
        return okVoid();
    }

    /** After sending: only description and a later deadline (an expired package reopens). */
    editAfterSend(patch: PackagePatch, now: Date): Result<undefined, DomainError> {
        if (this.isDraft) return err(SourcingErrors.notSent());
        if (!this.isActive) return err(SourcingErrors.finished());
        const other = entriesOf(patch).filter(([k, v]) => v !== undefined && !AFTER_SEND_FIELDS.has(k)).map(([k]) => k);
        if (other.length > 0) return err(SourcingErrors.onlyDescriptionAndDeadline(other));
        if (patch.bidDeadline !== undefined) {
            const extended = this.extend(patch.bidDeadline, now);
            if (!extended.ok) return extended;
        }
        if (patch.description !== undefined) this.p = { ...this.p, description: patch.description, updatedAt: now };
        return okVoid();
    }

    /** Draft → open with the snapshot re-taken at send time (version stays 1). */
    send(snapshot: Snapshot, now: Date): Result<undefined, DomainError> {
        if (!this.isDraft) return err(SourcingErrors.notDraft());
        if (snapshot.lines.length === 0) return err(SourcingErrors.noLines());
        if (now.getTime() >= this.p.bidDeadline.getTime()) return err(SourcingErrors.deadlinePassed());
        this.p = {
            ...this.p, status: 'open', sentAt: now, updatedAt: now,
            versions: [{ ...this.current, lines: snapshot.lines, createdAt: now }], estimateTotal: snapshot.estimateTotal,
        };
        return okVoid();
    }

    /**
     * New version of the lines (sent, not decided, before the bid deadline: past it the deadline is extended first, so
     * crews get time to price the change). `changedIdx` from changedLines(previous, next).
     */
    addendum(input: { selection: PackageSelection; snapshot: Snapshot; changedIdx: number[]; note: string; by: UserId; now: Date }): Result<PackageVersion, DomainError> {
        if (this.isDraft) return err(SourcingErrors.notSent());
        if (!this.isActive) return err(SourcingErrors.finished());
        if (input.now.getTime() >= this.p.bidDeadline.getTime()) return err(SourcingErrors.addendumAfterDeadline());
        if (input.snapshot.lines.length === 0) return err(SourcingErrors.noLines());
        const version: PackageVersion = {
            version: this.version + 1, lines: input.snapshot.lines, changedIdx: input.changedIdx, note: input.note.trim(),
            createdBy: input.by, createdAt: input.now,
        };
        this.p = {
            ...this.p, versions: [...this.p.versions, version], selection: structuredClone(input.selection),
            estimateTotal: input.snapshot.estimateTotal, updatedAt: input.now,
        };
        return ok(version);
    }

    /** Later than now and than the current deadline; reviewing / expired → open. */
    extend(deadline: Date, now: Date): Result<undefined, DomainError> {
        if (this.isDraft) return err(SourcingErrors.notSent());
        if (!this.isActive) return err(SourcingErrors.finished());
        if (deadline.getTime() <= now.getTime() || deadline.getTime() <= this.p.bidDeadline.getTime()) {
            return err(SourcingErrors.deadlineNotLater());
        }
        this.p = { ...this.p, bidDeadline: deadline, status: 'open', updatedAt: now };
        return okVoid();
    }

    /** Any time before award. */
    cancel(reason: string, now: Date): Result<undefined, DomainError> {
        if (!this.isDraft && !this.isActive) return err(SourcingErrors.finished());
        this.p = { ...this.p, status: 'cancelled', cancelledAt: now, cancelReason: reason.trim(), updatedAt: now };
        return okVoid();
    }

    /** Attaches an uploaded file (idempotent). Not after the decision. */
    attachFile(fileId: string, now: Date): Result<boolean, DomainError> {
        if (!this.isDraft && !this.isActive) return err(SourcingErrors.finished());
        if (this.p.fileIds.includes(fileId)) return ok(false);
        this.p = { ...this.p, fileIds: [...this.p.fileIds, fileId], updatedAt: now };
        return ok(true);
    }

    /** Draft only (vendors may already have seen a file of a sent package). */
    removeFile(fileId: string, now: Date): Result<undefined, DomainError> {
        if (!this.isDraft) return err(SourcingErrors.notDraft());
        if (!this.p.fileIds.includes(fileId)) return err(SourcingErrors.fileNotAttached());
        this.p = { ...this.p, fileIds: this.p.fileIds.filter(f => f !== fileId), updatedAt: now };
        return okVoid();
    }

    markAwarded(at: Date): void {
        this.p = { ...this.p, status: 'awarded', awardedAt: at, updatedAt: at };
    }

    /** Every subcontract was cancelled before it started: back to reviewing (award again). */
    reopenAfterCancel(at: Date): void {
        this.p = { ...this.p, status: 'reviewing', awardedAt: null, updatedAt: at };
    }

    markClosed(at: Date): void {
        this.p = { ...this.p, status: 'closed', closedAt: at, updatedAt: at };
    }

    toProps(): WorkPackageProps {
        return structuredClone(this.p);
    }
}

function definedOnly(patch: PackagePatch): PackagePatch {
    return Object.fromEntries(entriesOf(patch).filter(([, v]) => v !== undefined));
}

/** Entries with possibly-undefined values (an optional field may be present with undefined). */
function entriesOf(patch: PackagePatch): [string, unknown][] {
    return Object.entries(patch as Record<string, unknown>);
}
