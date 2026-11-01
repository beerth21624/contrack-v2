// ─── Planning texts for code without React (pure helpers, document builders), in a given locale ───
// `planningTranslator(locale)` is the `planning` namespace for a known locale (print models carry their own locale);
// `planningText()` reads the UI locale from the NEXT_LOCALE cookie (helpers called from stores / plain functions).
import { createTranslator, type useTranslations } from 'next-intl';
import { readLocaleCookie } from '@/i18n/locale-cookie';
import type { Locale } from '@/i18n/config';
import enPlanning from '@/i18n/messages/en/planning.json';
import thPlanning from '@/i18n/messages/th/planning.json';

/** The `planning` translator, for helpers that live outside a component. */
export type PlanningT = ReturnType<typeof useTranslations<'planning'>>;

const cache = new Map<Locale, PlanningT>();

export function planningTranslator(locale: Locale): PlanningT {
    const hit = cache.get(locale);
    if (hit !== undefined) return hit;
    const made = createTranslator({
        locale,
        messages: { planning: locale === 'th' ? thPlanning : enPlanning },
        namespace: 'planning',
        timeZone: 'Asia/Bangkok',
    }) as unknown as PlanningT;
    cache.set(locale, made);
    return made;
}

/** The translator in the UI locale (the cookie), for helpers that cannot use a hook. */
export function planningText(): PlanningT {
    return planningTranslator(readLocaleCookie());
}
