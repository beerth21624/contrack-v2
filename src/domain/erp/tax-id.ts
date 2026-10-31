// ─── Thai 13-digit tax identification number (citizen ID / juristic person ID) ───

/**
 * True when `id` is exactly 13 digits with a valid check digit: sum = Σ digit[i] × (13 − i) for i = 0..11,
 * check = (11 − sum mod 11) mod 10 must equal digit[12]. Anything else (spaces, dashes, letters, other lengths) → false.
 */
export function isThaiTaxId(id: string): boolean {
    if (!/^\d{13}$/.test(id)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i += 1) sum += Number(id[i]) * (13 - i);
    return (11 - (sum % 11)) % 10 === Number(id[12]);
}
