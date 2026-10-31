// ─── next-intl request config (without i18n routing): the locale comes from the NEXT_LOCALE cookie ───
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, resolveLocale } from './config';
import enMessages from './messages/en';
import thMessages from './messages/th';

export default getRequestConfig(async () => {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return {
    locale,
    messages: locale === 'en' ? enMessages : thMessages,
    timeZone: 'Asia/Bangkok',
  };
});
