// ─── Small rules and formatting shared by the bidding use cases ───
import type { SnapshotLine } from '@contrack/domain/subcontracting';
import type { BidPricing } from '@contrack/domain/subcontracting/leveling';
import { DomainError, type Result, err, okVoid } from '../../../../shared/domain';
import type { InvitationView, PackageDirectory, PackageView } from '../../shared/ports';
import type { Bid } from '../domain/entities/bid.entity';

/** Bids can be drafted / submitted / withdrawn: package open and the deadline not reached. */
export function biddingOpen(pkg: PackageView, now: Date): Result<undefined, DomainError> {
    if (pkg.status !== 'open') return err(DomainError.conflict('The package is not taking bids', { reason: 'package_not_open', status: pkg.status }));
    if (now.getTime() >= pkg.bidDeadline.getTime()) return err(DomainError.conflict('The bid deadline has passed', { reason: 'deadline_passed' }));
    return okVoid();
}

const DECIDED_OR_GONE = new Set<InvitationView['status']>(['withdrawn', 'won', 'lost', 'closed']);

/** The invitation still takes a bid (not withdrawn by the buyer, not decided). */
export function invitationActive(invitation: InvitationView): Result<undefined, DomainError> {
    return DECIDED_OR_GONE.has(invitation.status)
        ? err(DomainError.conflict('The invitation is no longer open', { reason: 'invitation_closed', status: invitation.status }))
        : okVoid();
}

/**
 * The crew's own routes (save draft, submit): an invitation the buyer withdrew no longer exists for the crew, so it
 * answers 404 like GET /vendor/invitations/:id (API-module1.md), not 409.
 */
export function vendorInvitationActive(invitation: InvitationView): Result<undefined, DomainError> {
    return invitation.status === 'withdrawn' ? err(DomainError.notFound('invitation')) : invitationActive(invitation);
}

/** Packages a buyer can still enter a price for: sent and not yet decided. */
export function acceptsManualBid(pkg: PackageView): Result<undefined, DomainError> {
    return pkg.status === 'open' || pkg.status === 'reviewing' || pkg.status === 'expired'
        ? okVoid()
        : err(DomainError.conflict('The package is not taking bids', { reason: 'package_not_open', status: pkg.status }));
}

/** The lines a bid's prices refer to (the version it was made for). */
export async function linesOfBidVersion(packages: PackageDirectory, pkg: PackageView, version: number): Promise<SnapshotLine[]> {
    if (version === pkg.version) return pkg.lines;
    return (await packages.linesOfVersion(pkg.id, version)) ?? [];
}

/** Money for Thai readers in notifications: `125,000 บาท`, `1,250.50 บาท`. */
export function formatBaht(amount: number): string {
    const hasSatang = Math.round(amount * 100) % 100 !== 0;
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: hasSatang ? 2 : 0, maximumFractionDigits: 2 })} บาท`;
}

/** Today's date (YYYY-MM-DD) in Thailand (UTC+7, no daylight saving). */
export function bangkokToday(now: Date): string {
    return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * A bid's prices, on the lines of the package version it was made for. Never moved onto another version's lines: an
 * outdated bid is shown as it was (leveling) and cannot be awarded.
 */
export function pricingOf(bid: Bid): BidPricing {
    const c = bid.content;
    return { mode: c.mode, lines: c.lines, lumpTotal: c.lumpTotal, adjustment: c.adjustment };
}

/** The bid was made for an older version of the package (an addendum since). */
export function isOutdated(bid: Bid, pkg: PackageView): boolean {
    return bid.packageVersion !== pkg.version;
}
