// ─── Amount in Thai words (like Excel BAHTTEXT) ──────────────────────────────

const DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
const digit = (d: number): string => DIGITS[d] ?? '';
const place = (p: number): string => PLACES[p] ?? '';

/** Words for 1 ≤ n < 1,000,000; `hasHigher` = digits above this group exist (1 in the units then reads เอ็ด). */
function group(n: number, hasHigher: boolean): string {
    const digits = String(n).split('').map(Number);
    const len = digits.length;
    let out = '';
    digits.forEach((d, i) => {
        const p = len - 1 - i;
        if (d === 0) return;
        if (p === 1) {
            out += d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : `${digit(d)}สิบ`;
        } else if (p === 0) {
            out += d === 1 && (len > 1 || hasHigher) ? 'เอ็ด' : digit(d);
        } else {
            out += `${digit(d)}${place(p)}`;
        }
    });
    return out;
}

/** Words for a non-negative integer. */
function integerWords(n: number): string {
    if (n === 0) return digit(0);
    const parts: number[] = [];
    let rest = n;
    while (rest > 0) {
        parts.unshift(rest % 1_000_000);
        rest = Math.floor(rest / 1_000_000);
    }
    return parts.map((p, i) => (p === 0 ? '' : group(p, i > 0)) + (i < parts.length - 1 ? 'ล้าน' : '')).join('');
}

/** e.g. 1,850,317.34 → "หนึ่งล้านแปดแสนห้าหมื่นสามร้อยสิบเจ็ดบาทสามสิบสี่สตางค์"; 21 → "ยี่สิบเอ็ดบาทถ้วน". */
export function bahtText(amount: number): string {
    if (!Number.isFinite(amount)) return '';
    // ×100 in binary floating point turns 1.005 into 100.49999…; 15 significant digits (Excel's precision) restore
    // the decimal value, so half a satang rounds up like Excel's BAHTTEXT.
    const satangTotal = Math.round(Number((Math.abs(amount) * 100).toPrecision(15)));
    const baht = Math.floor(satangTotal / 100);
    const satang = satangTotal % 100;
    const sign = amount < 0 && satangTotal > 0 ? 'ลบ' : '';
    if (satang === 0) return `${sign}${integerWords(baht)}บาทถ้วน`;
    const bahtPart = baht > 0 ? `${integerWords(baht)}บาท` : '';
    return `${sign}${bahtPart}${integerWords(satang)}สตางค์`;
}
