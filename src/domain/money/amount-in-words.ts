// ─── Amount in English words for printed documents ───
// The Thai text is the existing bahtText (src/features/export/baht-text.ts); both are reached through
// amountInWords(value, locale) in src/i18n/format.ts.
import { round2 } from './money';

const ONES = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];

/** Words for 1 ≤ n < 1000 ("two hundred fifty", "twenty-one"). */
function belowThousand(n: number): string {
    const words: string[] = [];
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    if (hundreds > 0) words.push(`${ONES[hundreds]} hundred`);
    if (rest > 0 && rest < 20) words.push(ONES[rest] ?? '');
    else if (rest >= 20) {
        const unit = rest % 10;
        words.push(unit === 0 ? (TENS[Math.floor(rest / 10)] ?? '') : `${TENS[Math.floor(rest / 10)]}-${ONES[unit]}`);
    }
    return words.join(' ');
}

/** Words for a non-negative safe integer. */
function integerWords(n: number): string {
    if (n === 0) return 'zero';
    const groups: string[] = [];
    let rest = n;
    let scale = 0;
    while (rest > 0) {
        const g = rest % 1000;
        if (g > 0) groups.unshift(SCALES[scale] ? `${belowThousand(g)} ${SCALES[scale]}` : belowThousand(g));
        rest = Math.floor(rest / 1000);
        scale += 1;
    }
    return groups.join(' ');
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * e.g. 1250.5 → "One thousand two hundred fifty baht and fifty satang only"; 0 → "Zero baht only";
 * 0.25 → "Twenty-five satang only"; −100 → "Minus one hundred baht only". Rounded to satang first (round2).
 * Not a finite number → empty text.
 */
export function amountInWordsEn(amount: number): string {
    if (!Number.isFinite(amount)) return '';
    const rounded = round2(amount);
    const satangTotal = Math.round(Math.abs(rounded) * 100);
    const baht = Math.floor(satangTotal / 100);
    const satang = satangTotal % 100;
    let text: string;
    if (satang === 0) text = `${integerWords(baht)} baht only`;
    else if (baht === 0) text = `${integerWords(satang)} satang only`;
    else text = `${integerWords(baht)} baht and ${integerWords(satang)} satang only`;
    return rounded < 0 && satangTotal > 0 ? `Minus ${text}` : capitalize(text);
}
