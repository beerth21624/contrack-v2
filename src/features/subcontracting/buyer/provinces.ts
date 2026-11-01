// ─── Province choices of the buyer screens: the list and the matching live in the domain; this adds the display names ───
import type { Locale } from '@/i18n/config';
import { PROVINCE_NAMES_EN, THAI_PROVINCES } from '@/domain/subcontracting/provinces';

export { THAI_PROVINCES, normalizeProvince, provinceInAddress } from '@/domain/subcontracting/provinces';

/** Display name of a stored province (Thai text): the English name in the English interface, else the text itself. */
export function provinceLabel(province: string, locale: Locale): string {
    return locale === 'en' ? PROVINCE_NAMES_EN[province] ?? province : province;
}

/** Select options for the provinces; the value stays the Thai name the server stores. */
export function provinceOptions(locale: Locale): { value: string; label: string }[] {
    return THAI_PROVINCES.map(p => ({ value: p, label: provinceLabel(p, locale) }));
}
