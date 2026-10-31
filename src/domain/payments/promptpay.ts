// ─── Thai QR / PromptPay payload (EMVCo merchant-presented QR; docs/erp/02-domain-model.md §4.5) ───
// 00 "01" · 01 "11" static / "12" with an amount · 29 { 00 AID A000000677010111 · 01 phone 0066… | 02 tax id |
// 03 e-wallet } · 53 "764" (THB) · 54 amount (2 decimals) · 58 "TH" · 63 CRC16-CCITT (poly 0x1021, init 0xFFFF)
// over the whole string including "6304".
import { round2 } from '../money/money';

const PROMPTPAY_AID = 'A000000677010111';

/** CRC16-CCITT (FALSE): poly 0x1021, init 0xFFFF, no reflection, no final xor. "123456789" → 0x29B1. */
export function crc16Ccitt(data: string): number {
    let crc = 0xffff;
    for (let i = 0; i < data.length; i++) {
        crc ^= (data.charCodeAt(i) & 0xff) << 8;
        for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc;
}

function tlv(tag: string, value: string): string {
    return `${tag}${value.length.toString().padStart(2, '0')}${value}`;
}

export type PromptPayIdKind = 'phone' | 'tax_id' | 'ewallet';

/** Kind of a PromptPay id (digits only after removing spaces/dashes): 10-digit phone 0…, 13-digit tax id, 15 e-wallet. */
export function promptPayIdKind(id: string): PromptPayIdKind | null {
    const digits = id.replace(/[\s-]/g, '');
    if (!/^\d+$/.test(digits)) return null;
    if (digits.length === 10 && digits.startsWith('0')) return 'phone';
    if (digits.length === 13) return 'tax_id';
    if (digits.length === 15) return 'ewallet';
    return null;
}

export interface PromptPayInput {
    /** Mobile number, national / tax id, or e-wallet id. */
    id: string;
    /** Amount in baht; omitted or ≤ 0 → static QR (the payer types the amount). */
    amount?: number | null;
}

/** PromptPay QR payload string. Throws RangeError on an id that is not a PromptPay id or an amount out of range. */
export function promptPayPayload(input: PromptPayInput): string {
    const kind = promptPayIdKind(input.id);
    if (kind === null) throw new RangeError('promptPayPayload: invalid PromptPay id');
    const digits = input.id.replace(/[\s-]/g, '');
    const account =
        kind === 'phone' ? tlv('01', `0066${digits.slice(1)}`) : kind === 'tax_id' ? tlv('02', digits) : tlv('03', digits);
    const amount = input.amount == null ? 0 : round2(input.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 9_999_999_999.99) {
        throw new RangeError('promptPayPayload: amount out of range');
    }
    const body =
        tlv('00', '01') +
        tlv('01', amount > 0 ? '12' : '11') +
        tlv('29', tlv('00', PROMPTPAY_AID) + account) +
        tlv('53', '764') +
        (amount > 0 ? tlv('54', amount.toFixed(2)) : '') +
        tlv('58', 'TH') +
        '6304';
    return body + crc16Ccitt(body).toString(16).toUpperCase().padStart(4, '0');
}
