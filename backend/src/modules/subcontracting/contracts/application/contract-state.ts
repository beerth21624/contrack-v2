// ─── What a subcontract's claims, variations and retention entries say about it (pure, used by views and rules) ───
import type { RetentionSummary, SubcontractSummaryDto } from '@contrack/contract';
import { retentionSummary } from '@contrack/domain/subcontracting/claims';
import { round2 } from '@contrack/domain/subcontracting/snapshot';
import type { ClaimId } from '../../shared/ids';
import type { Claim, Side } from '../domain/entities/claim.entity';
import type { RetentionEntry } from '../domain/entities/contract-records.entity';
import type { Subcontract } from '../domain/entities/subcontract.entity';
import type { Variation } from '../domain/entities/variation.entity';
import { bangkokDate } from './thai-format';

export type InstallmentStateName = 'not_started' | 'requested' | 'inspected' | 'approved' | 'paid';

export interface InstallmentState {
    no: number;
    pct: number;
    condition: string;
    amount: number;
    claimId: ClaimId | null;
    state: InstallmentStateName;
}

/** The latest non-rejected claim of an installment (there is at most one). */
export function openClaimOf(claims: readonly Claim[], installmentNo: number): Claim | undefined {
    return claims.filter(c => c.installmentNo === installmentNo && c.status !== 'rejected')
        .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())[0];
}

export function installmentStates(sc: Subcontract, claims: readonly Claim[]): InstallmentState[] {
    return sc.installmentAmounts().map(i => {
        const claim = openClaimOf(claims, i.no);
        const state: InstallmentStateName = claim === undefined || claim.status === 'rejected' ? 'not_started' : claim.status;
        return { no: i.no, pct: i.pct, condition: i.condition, amount: i.amount, claimId: claim?.id ?? null, state };
    });
}

export function allInstallmentsPaid(sc: Subcontract, claims: readonly Claim[]): boolean {
    return installmentStates(sc, claims).every(i => i.state === 'paid');
}

/** Value of the work paid for: Σ (gross + adjustments) of the paid claims (what the report and 'contracted' compare). */
export function paidValue(claims: readonly Claim[]): number {
    return round2(claims.filter(c => c.status === 'paid')
        .reduce((s, c) => s + c.amounts.gross + c.amounts.adjustments.reduce((a, x) => a + x.amount, 0), 0));
}

/** Cash recorded as paid to the crew (net of retention / WHT, plus VAT). */
export function paidTotal(claims: readonly Claim[]): number {
    return round2(claims.filter(c => c.status === 'paid').reduce((s, c) => s + (c.state.paidAmount ?? 0), 0));
}

export function retentionOf(sc: Subcontract, entries: readonly RetentionEntry[]): RetentionSummary {
    return retentionSummary(entries, {
        completedAt: sc.completedAt === null ? null : bangkokDate(sc.completedAt),
        warrantyMonths: sc.terms.warrantyMonths,
    });
}

/** What the contract waits for, seen by the viewer: a proposed variation is only for the side that did NOT propose it. */
export function pendingActionOf(
    sc: Subcontract, claims: readonly Claim[], variations: readonly Variation[], viewer: Side,
): SubcontractSummaryDto['pendingAction'] {
    if (sc.status === 'pending_acceptance') return 'vendor_accept';
    if (sc.status !== 'active') return 'none';
    const open = claims.filter(c => c.status !== 'rejected');
    if (open.some(c => c.status === 'requested')) return 'buyer_inspect';
    if (open.some(c => c.status === 'inspected' && c.inspection?.result !== 'fail')) return 'buyer_approve';
    if (open.some(c => c.status === 'approved')) return 'buyer_pay';
    if (variations.some(v => v.status === 'proposed' && v.proposedBy !== viewer)) return 'variation_response';
    return 'none';
}

export function nextInstallmentOf(sc: Subcontract, claims: readonly Claim[]): number | null {
    return installmentStates(sc, claims).find(i => i.state !== 'paid')?.no ?? null;
}
