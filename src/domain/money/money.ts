// ─── Money: rounding and splitting (docs/erp/01-architecture.md §12) ───
// Amounts are plain numbers in baht (D-04). Every amount that is stored goes through round2 first; quantities through
// roundQty. Pure: shared by the web previews and the server so both compute the same satang.

/** Largest amount the ERP accepts (numeric(14,2) and float64 stay exact to the satang below this). */
export const MONEY_MAX = 1e11;

/**
 * Rounds money to satang, half away from zero, on the decimal value people see (512.565 → 512.57): the 1e-7 nudge
 * absorbs binary representation error (512.565 is stored as 512.56499…). Used by the server and every preview.
 */
export function round2(v: number): number {
    const sign = v < 0 ? -1 : 1;
    return (sign * Math.round(Math.abs(v) * 100 + 1e-7)) / 100;
}

/**
 * Rounds a quantity to 4 decimals, half away from zero. ×10⁴ in binary floating point can land just below the half
 * (1.00005 → 10000.4999…); 15 significant digits restore the decimal value before rounding, whatever the magnitude.
 */
export function roundQty(v: number): number {
    if (!Number.isFinite(v)) return v;
    const sign = v < 0 ? -1 : 1;
    const scaled = Math.abs(v) * 10_000;
    // From 1e15 up a float64 has no fraction digits left to correct, and 15 significant digits would drop real ones.
    return (sign * Math.round(scaled < 1e15 ? Number(scaled.toPrecision(15)) : scaled)) / 10_000;
}

/** Total of amounts: each one rounded to satang, then the sum rounded (no float drift such as 0.1 + 0.2). */
export function sumMoney(values: Iterable<number>): number {
    let total = 0;
    for (const v of values) total = round2(total + round2(v));
    return total;
}

/** `rate` (a fraction: 0.05 = 5 %) of an amount, rounded to satang. */
export function pctOf(amount: number, rate: number): number {
    return round2(amount * rate);
}

/**
 * Splits `total` (rounded to satang first; may be negative) by `weights` (each ≥ 0) so the parts add up to it exactly:
 * part i = round2(total × wᵢ / Σw) for all but the last, the last takes the remainder (like installmentAmounts).
 * All weights 0 → equal parts. No weights → []. A negative or non-finite weight is a programming error and throws.
 * When rounding the earlier parts up would leave the last part with the opposite sign (0.02 over 4 equal weights →
 * 0.01 × 3 and −0.01), the parts are taken from the rounded running total instead, so no part has the wrong sign (D-62).
 */
export function allocate(total: number, weights: readonly number[]): number[] {
    if (weights.length === 0) return [];
    if (weights.some(w => !Number.isFinite(w) || w < 0)) throw new RangeError('allocate: weights must be finite and ≥ 0');
    const amount = round2(total);
    // Scale by the largest weight so Σw stays finite (weights near Number.MAX_VALUE would sum to Infinity).
    const maxW = Math.max(...weights);
    const shares = maxW > 0 ? weights.map(w => w / maxW) : weights.map(() => 1);
    const divisor = shares.reduce((s, w) => s + w, 0);
    const parts: number[] = [];
    let earlier = 0;
    shares.forEach((w, i) => {
        if (i === shares.length - 1) {
            parts.push(round2(amount - earlier));
            return;
        }
        const part = round2((amount * w) / divisor);
        parts.push(part);
        earlier = round2(earlier + part);
    });
    const last = parts[parts.length - 1] ?? 0;
    if (last * amount >= 0) return parts;
    // Cumulative split: part i = round2(total × cumᵢ / Σw) − round2(total × cumᵢ₋₁ / Σw); monotone, so every part has
    // the sign of the total, and the last still makes the sum exact.
    const cumulative: number[] = [];
    let cumW = 0;
    let before = 0;
    shares.forEach((w, i) => {
        cumW += w;
        const upTo = i === shares.length - 1 ? amount : round2((amount * cumW) / divisor);
        cumulative.push(round2(upTo - before));
        before = upTo;
    });
    return cumulative;
}
