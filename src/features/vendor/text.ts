// ─── Vendor (crew) texts for code without React (pure helpers), in the UI locale ───
// `vText()` reads the locale from the NEXT_LOCALE cookie (Thai when there is none, as on the server and in unit tests);
// components use `useTranslations('vendor')` and may pass their `t` where a helper takes one.
import { createTranslator, type useTranslations } from 'next-intl';
import { readLocaleCookie } from '@/i18n/locale-cookie';
import type { Locale } from '@/i18n/config';
import enVendor from '@/i18n/messages/en/vendor.json';
import thVendor from '@/i18n/messages/th/vendor.json';

/** The `vendor` translator, for helpers that live outside a component. */
export type VT = ReturnType<typeof useTranslations<'vendor'>>;

const cache = new Map<Locale, VT>();

export function vendorTranslator(locale: Locale): VT {
    const hit = cache.get(locale);
    if (hit !== undefined) return hit;
    const made = createTranslator({
        locale,
        messages: { vendor: locale === 'th' ? thVendor : enVendor },
        namespace: 'vendor',
        timeZone: 'Asia/Bangkok',
    }) as unknown as VT;
    cache.set(locale, made);
    return made;
}

/** The UI locale as the cookie says (Thai on the server and in tests). */
export const vLocale = (): Locale => readLocaleCookie();

/** The translator in the UI locale (the cookie). */
export const vText = (): VT => vendorTranslator(vLocale());
