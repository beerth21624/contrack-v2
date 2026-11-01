// ─── Workforce texts for code without React (pure helpers), in the UI locale ───
// `workforceText()` reads the locale from the NEXT_LOCALE cookie (Thai when there is none, as on the server and in
// unit tests); components use `useTranslations('workforce')` and pass `t` where a helper takes one.
import { createTranslator, type useTranslations } from 'next-intl';
import { readLocaleCookie } from '@/i18n/locale-cookie';
import type { Locale } from '@/i18n/config';
import enWorkforce from '@/i18n/messages/en/workforce.json';
import thWorkforce from '@/i18n/messages/th/workforce.json';
import type { EmploymentType, PersonRole, WorkforceTradeId } from '@/shared/contract';

/** The `workforce` translator, for helpers that live outside a component. */
export type WorkforceT = ReturnType<typeof useTranslations<'workforce'>>;

const cache = new Map<Locale, WorkforceT>();

export function workforceTranslator(locale: Locale): WorkforceT {
    const hit = cache.get(locale);
    if (hit !== undefined) return hit;
    const made = createTranslator({
        locale,
        messages: { workforce: locale === 'th' ? thWorkforce : enWorkforce },
        namespace: 'workforce',
        timeZone: 'Asia/Bangkok',
    }) as unknown as WorkforceT;
    cache.set(locale, made);
    return made;
}

/** The translator in the UI locale (the cookie). */
export function workforceText(): WorkforceT {
    return workforceTranslator(readLocaleCookie());
}

/** The UI locale as the cookie says. */
export const workforceLocale = (): Locale => readLocaleCookie();

// ─── Names of the contract enums (trade, person role, employment) ───

export const tradeNameOf = (t: WorkforceT, id: WorkforceTradeId): string => t(`labels.trades.${id}`);
export const roleNameOf = (t: WorkforceT, role: PersonRole): string => t(`labels.roles.${role}`);
export const employmentNameOf = (t: WorkforceT, e: EmploymentType): string => t(`labels.employment.${e}`);
