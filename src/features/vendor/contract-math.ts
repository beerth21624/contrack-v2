// ─── The crew's view of a contract: expected net per installment and which installment can be claimed. Pure. ───
import type { ClaimDto, SubcontractDto, SubcontractLineDto, SubcontractTerms } from '@/shared/contract';
import { contractClaimAmounts } from '@/domain/subcontracting/claims';
import { vText, type VT } from './text';

export interface ExpectedNet {
    gross: number;
    retention: number;
    wht: number;
    vat: number;
    net: number;
}

/**
 * What the crew can expect to receive for an installment before any adjustment the buyer adds on approval:
 * gross − retention − withholding tax + VAT, by the same domain rule the server stores (contractClaimAmounts: WHT only
 * on the labour share when the crew supplies material). A guide, not a tax document.
 */
export function expectedNet(
    gross: number,
    terms: Pick<SubcontractTerms, 'retentionPct' | 'whtPct' | 'vat'>,
    lines: readonly SubcontractLineDto[] = [],
): ExpectedNet {
    const a = contractClaimAmounts({ terms, lines }, gross, []);
    return { gross: a.gross, retention: a.retention, wht: a.wht, vat: a.vat, net: a.net };
}

/** Latest claim per installment (a rejected or failed claim can be followed by a new one). */
export function latestClaims(claims: readonly ClaimDto[]): Map<number, ClaimDto> {
    const out = new Map<number, ClaimDto>();
    for (const c of claims) {
        const prev = out.get(c.installmentNo);
        if (prev === undefined || new Date(c.requestedAt).getTime() >= new Date(prev.requestedAt).getTime()) out.set(c.installmentNo, c);
    }
    return out;
}

/** The claim needs a new request (rejected, or inspected and failed). */
export function needsNewClaim(c: ClaimDto): boolean {
    return c.status === 'rejected' || (c.status === 'inspected' && c.inspection?.result === 'fail');
}

/**
 * Installment the crew can ask to be paid for now: the first one with no live claim (never claimed, or its latest
 * claim was rejected / failed). null when none (all claimed, or the contract is not active).
 */
export function claimableInstallment(sc: Pick<SubcontractDto, 'status' | 'installments'>, claims: readonly ClaimDto[]): number | null {
    if (sc.status !== 'active') return null;
    const latest = latestClaims(claims);
    for (const inst of sc.installments) {
        if (inst.state === 'paid' || inst.state === 'approved') continue;
        const c = latest.get(inst.no);
        if (c === undefined) return inst.state === 'not_started' ? inst.no : null;
        if (needsNewClaim(c)) return inst.no;
        return null;
    }
    return null;
}

export const claimStatusText = (s: 'requested' | 'inspected' | 'approved' | 'paid' | 'rejected', t: VT = vText()): string => t(`contract.claimStatus.${s}`);

export const inspectionText = (r: 'pass' | 'pass_with_fixes' | 'fail', t: VT = vText()): string => t(`contract.inspection.${r}`);

export const installmentStateText = (s: 'not_started' | 'requested' | 'inspected' | 'approved' | 'paid', t: VT = vText()): string => t(`contract.installmentState.${s}`);
