// ─── Subcontracting texts for code without React (pure helpers), in the UI locale ───
// `scText()` reads the locale from the NEXT_LOCALE cookie (Thai when there is none, as on the server and in unit tests);
// components use `useTranslations('subcontracting')` and may pass their `t` where a helper takes one.
import { createTranslator, type useTranslations } from 'next-intl';
import { readLocaleCookie } from '@/i18n/locale-cookie';
import type { Locale } from '@/i18n/config';
import enSubcontracting from '@/i18n/messages/en/subcontracting.json';
import thSubcontracting from '@/i18n/messages/th/subcontracting.json';

/** The `subcontracting` translator, for helpers that live outside a component. */
export type ScT = ReturnType<typeof useTranslations<'subcontracting'>>;

const cache = new Map<Locale, ScT>();

export function scTranslator(locale: Locale): ScT {
    const hit = cache.get(locale);
    if (hit !== undefined) return hit;
    const made = createTranslator({
        locale,
        messages: { subcontracting: locale === 'th' ? thSubcontracting : enSubcontracting },
        namespace: 'subcontracting',
        timeZone: 'Asia/Bangkok',
    }) as unknown as ScT;
    cache.set(locale, made);
    return made;
}

/** The UI locale as the cookie says (Thai on the server and in tests). */
export const scLocale = (): Locale => readLocaleCookie();

/** The translator in the UI locale (the cookie). */
export const scText = (): ScT => scTranslator(scLocale());
