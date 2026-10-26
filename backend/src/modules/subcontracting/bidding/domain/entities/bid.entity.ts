// ─── Bid: a draft (version 0, autosaved) or a submitted version (1, 2, …) of one invitee's price ───
// Submitted versions never change their prices; only their status moves (plan §7):
// submitted → superseded (a newer version) | withdrawn | selected | not_selected.
import type { BidMode, BidStatus, InstallmentDto } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../../shared/domain';
import type { BidId, PackageId, ScInvitationId } from '../../../shared/ids';
import type { BidLineView, BidView } from '../../../shared/ports';

/** What the bidder wrote, priced (line totals, total, normalised total). */
export interface BidContent {
    mode: BidMode;
    lines: BidLineView[];
    lumpTotal: number | null;
    adjustment: number;
    adjustmentNote: string;
    inclusions: string;
    total: number;
    normalizedTotal: number;
    days: number | null;
    earliestStart: string | null;
    crewSkilled: number | null;
    crewLabourers: number | null;
    validUntil: string | null;
    installmentsProposal: InstallmentDto[] | null;
    answers: string[];
    note: string;
    photoFileIds: string[];
}

export interface BidProps extends BidContent {
    id: BidId;
    buyerWorkspaceId: WorkspaceId;
    packageId: PackageId;
    invitationId: ScInvitationId;
    vendorWorkspaceId: WorkspaceId | null;
    packageVersion: number;
    /** 0 = draft. */
    version: number;
    status: BidStatus;
    enteredByBuyer: boolean;
    submittedBy: UserId | null;
    submittedAt: Date | null;
    withdrawnAt: Date | null;
    decidedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

interface Owner {
    id: BidId;
    buyerWorkspaceId: WorkspaceId;
    packageId: PackageId;
    invitationId: ScInvitationId;
    vendorWorkspaceId: WorkspaceId | null;
    packageVersion: number;
}

export class Bid {
    private constructor(private props: BidProps) {}

    static draft(owner: Owner, content: BidContent, at: Date): Bid {
        return new Bid({
            ...owner, ...content, version: 0, status: 'draft', enteredByBuyer: false, submittedBy: null, submittedAt: null,
            withdrawnAt: null, decidedAt: null, createdAt: at, updatedAt: at,
        });
    }

    static submitted(owner: Owner & { version: number; enteredByBuyer: boolean; submittedBy: UserId }, content: BidContent, at: Date): Bid {
        if (owner.version < 1) throw new Error('a submitted bid has version ≥ 1');
        return new Bid({
            ...owner, ...content, status: 'submitted', submittedAt: at, withdrawnAt: null, decidedAt: null, createdAt: at, updatedAt: at,
        });
    }

    static rehydrate(props: BidProps): Bid {
        return new Bid({ ...props });
    }

    get id(): BidId { return this.props.id; }
    get invitationId(): ScInvitationId { return this.props.invitationId; }
    get packageId(): PackageId { return this.props.packageId; }
    get buyerWorkspaceId(): WorkspaceId { return this.props.buyerWorkspaceId; }
    get vendorWorkspaceId(): WorkspaceId | null { return this.props.vendorWorkspaceId; }
    get status(): BidStatus { return this.props.status; }
    get version(): number { return this.props.version; }
    get packageVersion(): number { return this.props.packageVersion; }
    get isDraft(): boolean { return this.props.status === 'draft'; }
    get total(): number { return this.props.total; }
    get content(): BidContent { return pickContent(this.props); }

    /** Plain copy (repositories, DTO mapping). */
    toProps(): BidProps {
        return structuredClone(this.props);
    }

    toView(): BidView {
        const p = this.props;
        return {
            id: p.id, invitationId: p.invitationId, packageId: p.packageId, packageVersion: p.packageVersion, version: p.version,
            status: p.status, mode: p.mode, lines: p.lines.map(l => ({ ...l })), lumpTotal: p.lumpTotal, adjustment: p.adjustment,
            total: p.total, days: p.days, earliestStart: p.earliestStart, validUntil: p.validUntil,
            installmentsProposal: p.installmentsProposal === null ? null : p.installmentsProposal.map(i => ({ ...i })),
            enteredByBuyer: p.enteredByBuyer, submittedAt: p.submittedAt,
        };
    }

    /** Autosave of a draft (replaces the content, follows the current package version). */
    revise(content: BidContent, packageVersion: number, at: Date): void {
        if (!this.isDraft) throw new Error('only a draft can be revised');
        this.props = { ...this.props, ...content, packageVersion, updatedAt: at };
    }

    /** A newer version was submitted. Returns false when there was nothing to change. */
    supersede(at: Date): boolean {
        if (this.props.status !== 'submitted') return false;
        this.props = { ...this.props, status: 'superseded', updatedAt: at };
        return true;
    }

    withdraw(at: Date): boolean {
        if (this.props.status !== 'submitted') return false;
        this.props = { ...this.props, status: 'withdrawn', withdrawnAt: at, updatedAt: at };
        return true;
    }

    /** Award decision on a latest submitted version. */
    decide(selected: boolean, at: Date): boolean {
        if (this.props.status !== 'submitted') return false;
        this.props = { ...this.props, status: selected ? 'selected' : 'not_selected', decidedAt: at, updatedAt: at };
        return true;
    }
}

function pickContent(p: BidContent): BidContent {
    return structuredClone({
        mode: p.mode, lines: p.lines, lumpTotal: p.lumpTotal, adjustment: p.adjustment, adjustmentNote: p.adjustmentNote,
        inclusions: p.inclusions, total: p.total, normalizedTotal: p.normalizedTotal, days: p.days, earliestStart: p.earliestStart,
        crewSkilled: p.crewSkilled, crewLabourers: p.crewLabourers, validUntil: p.validUntil,
        installmentsProposal: p.installmentsProposal, answers: p.answers, note: p.note, photoFileIds: p.photoFileIds,
    });
}
