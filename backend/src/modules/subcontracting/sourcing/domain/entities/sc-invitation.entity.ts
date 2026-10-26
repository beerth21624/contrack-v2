// ─── Invitation (คำเชิญ): one package sent to one crew of the buyer's vendor list, reached by a secret link ───
// sent → viewed → (declined | submitted) · submitted → won | lost (award) · the rest → closed (award) ·
// sent/viewed/declined → withdrawn (by the buyer, before award). The link is valid until `expiresAt`
// (bid deadline + 30 days; renewed by resend / extend).
import type { DeclineReason, InvitationStatus, InviteChannel } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, ok, okVoid } from '../../../../../shared/domain/result';
import type { PackageId, ScInvitationId, VendorListEntryId } from '../../../shared/ids';
import { SourcingErrors } from '../sourcing.errors';

export const LINK_DAYS_AFTER_DEADLINE = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function linkExpiry(bidDeadline: Date): Date {
    return new Date(bidDeadline.getTime() + LINK_DAYS_AFTER_DEADLINE * DAY_MS);
}

export interface ScInvitationProps {
    id: ScInvitationId;
    packageId: PackageId;
    buyerWorkspaceId: WorkspaceId;
    vendorListEntryId: VendorListEntryId;
    vendorWorkspaceId: WorkspaceId | null;
    /** Name and phone from the vendor list when invited. */
    displayName: string;
    phone: string;
    channel: InviteChannel;
    status: InvitationStatus;
    sentAt: Date;
    viewedAt: Date | null;
    declinedAt: Date | null;
    declineReason: DeclineReason | null;
    declineNote: string | null;
    withdrawnAt: Date | null;
    expiresAt: Date;
    resentCount: number;
    /** When the "deadline soon" reminder went out (once per deadline). */
    deadlineSoonAt: Date | null;
}

export class ScInvitation {
    private constructor(private p: ScInvitationProps) {}

    static create(input: {
        id: ScInvitationId; packageId: PackageId; buyerWorkspaceId: WorkspaceId; vendorListEntryId: VendorListEntryId;
        vendorWorkspaceId: WorkspaceId | null; displayName: string; phone: string; channel: InviteChannel; bidDeadline: Date; now: Date;
    }): ScInvitation {
        return new ScInvitation({
            id: input.id,
            packageId: input.packageId,
            buyerWorkspaceId: input.buyerWorkspaceId,
            vendorListEntryId: input.vendorListEntryId,
            vendorWorkspaceId: input.vendorWorkspaceId,
            displayName: input.displayName,
            phone: input.phone,
            channel: input.channel,
            status: 'sent',
            sentAt: input.now,
            viewedAt: null,
            declinedAt: null,
            declineReason: null,
            declineNote: null,
            withdrawnAt: null,
            expiresAt: linkExpiry(input.bidDeadline),
            resentCount: 0,
            deadlineSoonAt: null,
        });
    }

    static rehydrate(props: ScInvitationProps): ScInvitation {
        return new ScInvitation({ ...props });
    }

    get props(): Readonly<ScInvitationProps> {
        return this.p;
    }

    get id(): ScInvitationId {
        return this.p.id;
    }

    get packageId(): PackageId {
        return this.p.packageId;
    }

    get status(): InvitationStatus {
        return this.p.status;
    }

    get vendorWorkspaceId(): WorkspaceId | null {
        return this.p.vendorWorkspaceId;
    }

    /** Counts as an invitee (not withdrawn by the buyer). */
    get isCurrent(): boolean {
        return this.p.status !== 'withdrawn';
    }

    /** Still in the running (not withdrawn, not declined). */
    get isInRunning(): boolean {
        return this.p.status !== 'withdrawn' && this.p.status !== 'declined';
    }

    /** The link works: not withdrawn and not expired. */
    linkValid(now: Date): boolean {
        return this.p.status !== 'withdrawn' && now.getTime() < this.p.expiresAt.getTime();
    }

    /** First view only. True when it changed. */
    markViewed(now: Date): boolean {
        if (this.p.viewedAt !== null) return false;
        this.p = { ...this.p, viewedAt: now, status: this.p.status === 'sent' ? 'viewed' : this.p.status };
        return true;
    }

    decline(reason: DeclineReason, note: string, now: Date): Result<undefined, DomainError> {
        if (this.p.status !== 'sent' && this.p.status !== 'viewed') return err(SourcingErrors.invitationClosed());
        this.p = { ...this.p, status: 'declined', declinedAt: now, declineReason: reason, declineNote: note.trim() };
        return okVoid();
    }

    withdraw(now: Date): Result<undefined, DomainError> {
        if (this.p.status !== 'sent' && this.p.status !== 'viewed' && this.p.status !== 'declined') {
            return err(SourcingErrors.invitationClosed());
        }
        this.p = { ...this.p, status: 'withdrawn', withdrawnAt: now };
        return okVoid();
    }

    /** A fresh link: expiry renewed to at least deadline + 30 days. */
    resend(bidDeadline: Date): Result<undefined, DomainError> {
        if (this.p.status === 'withdrawn') return err(SourcingErrors.invitationClosed());
        this.p = { ...this.p, resentCount: this.p.resentCount + 1 };
        this.renewExpiry(bidDeadline);
        return okVoid();
    }

    /** Never shortens the link; a new deadline also re-arms the "deadline soon" reminder. */
    renewExpiry(bidDeadline: Date): void {
        const next = linkExpiry(bidDeadline);
        if (next.getTime() > this.p.expiresAt.getTime()) this.p = { ...this.p, expiresAt: next };
    }

    rearmReminder(): void {
        this.p = { ...this.p, deadlineSoonAt: null };
    }

    markReminded(now: Date): void {
        this.p = { ...this.p, deadlineSoonAt: now };
    }

    /** Links the invitation to a vendor workspace. ok(true) when it changed, conflict when linked to another. */
    linkTo(vendorWorkspaceId: WorkspaceId): Result<boolean, DomainError> {
        if (this.p.vendorWorkspaceId === vendorWorkspaceId) return ok(false);
        if (this.p.vendorWorkspaceId !== null) return err(SourcingErrors.linkedElsewhere());
        this.p = { ...this.p, vendorWorkspaceId };
        return ok(true);
    }

    // ── changes driven by bidding / contracts (through PackageDirectory) ──

    markSubmitted(at: Date): void {
        if (this.p.status === 'withdrawn') return;
        this.p = { ...this.p, status: 'submitted', viewedAt: this.p.viewedAt ?? at };
    }

    markBidWithdrawn(): void {
        if (this.p.status === 'submitted') this.p = { ...this.p, status: 'viewed' };
    }

    settleAward(won: boolean): void {
        if (won) this.p = { ...this.p, status: 'won' };
        else if (this.p.status === 'submitted') this.p = { ...this.p, status: 'lost' };
        else if (this.p.status === 'sent' || this.p.status === 'viewed') this.p = { ...this.p, status: 'closed' };
    }

    /** The award was undone (every subcontract cancelled before it started). */
    reopenAward(): void {
        if (this.p.status === 'won' || this.p.status === 'lost') this.p = { ...this.p, status: 'submitted' };
        else if (this.p.status === 'closed') this.p = { ...this.p, status: this.p.viewedAt === null ? 'sent' : 'viewed' };
    }

    toProps(): ScInvitationProps {
        return structuredClone(this.p);
    }
}
