// ─── The crew's view of a contract: expected net per installment and which installment can be claimed. Pure. ───
import type { ClaimDto, SubcontractDto, SubcontractLineDto, SubcontractTerms } from '@/shared/contract';
import { contractClaimAmounts } from '@/domain/subcontracting/claims';

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

export const CLAIM_STATUS_TEXT = {
    requested: 'ขอเบิกแล้ว รอผู้ว่าจ้างตรวจงาน',
    inspected: 'ตรวจงานแล้ว',
    approved: 'อนุมัติแล้ว รอจ่ายเงิน',
    paid: 'จ่ายเงินแล้ว',
    rejected: 'ผู้ว่าจ้างไม่รับใบเบิกนี้',
} as const;

export const INSPECTION_TEXT = {
    pass: 'ผ่าน',
    pass_with_fixes: 'ผ่าน มีจุดต้องแก้',
    fail: 'ยังไม่ผ่าน แก้แล้วขอเบิกใหม่ได้',
} as const;

export const INSTALLMENT_STATE_TEXT = {
    not_started: 'ยังไม่เบิก',
    requested: 'รอตรวจงาน',
    inspected: 'ตรวจแล้ว',
    approved: 'รอจ่ายเงิน',
    paid: 'ได้รับเงินแล้ว',
} as const;
