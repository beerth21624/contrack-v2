// ─── Cloud texts for code without React (notices, API conflict messages), in a given locale ───
// `cloudText()` reads the UI locale from the NEXT_LOCALE cookie (like store/notice-texts.ts).
import { createTranslator, type useTranslations } from 'next-intl';
import { readLocaleCookie } from '@/i18n/locale-cookie';
import type { Locale } from '@/i18n/config';
import enCloud from '@/i18n/messages/en/cloud.json';
import enErrors from '@/i18n/messages/en/errors.json';
import thCloud from '@/i18n/messages/th/cloud.json';
import thErrors from '@/i18n/messages/th/errors.json';
import { errorMessage, type ErrorsTranslator } from './api/error-message';

export type CloudT = ReturnType<typeof useTranslations<'cloud'>>;

export function cloudTranslator(locale: Locale): CloudT {
    return createTranslator({
        locale,
        messages: { cloud: locale === 'th' ? thCloud : enCloud },
        namespace: 'cloud',
        timeZone: 'Asia/Bangkok',
    }) as unknown as CloudT;
}

/** The `cloud` translator in the UI locale (the cookie). */
export function cloudText(): CloudT {
    return cloudTranslator(readLocaleCookie());
}

/** Text of any thrown value in the UI locale, for code outside components (see `useErrorMessage`). */
export function errorText(e: unknown): string {
    const locale = readLocaleCookie();
    const t = createTranslator({
        locale,
        messages: { errors: locale === 'th' ? thErrors : enErrors },
        namespace: 'errors',
        timeZone: 'Asia/Bangkok',
    }) as unknown as ErrorsTranslator;
    return errorMessage(t, e);
}
