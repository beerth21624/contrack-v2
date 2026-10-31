// ─── The NEXT_LOCALE cookie in the browser (the server reads it in src/i18n/request.ts) ───
import { LOCALE_COOKIE, type Locale, resolveLocale } from './config';

/** The locale the cookie asks for (Thai when the cookie is missing or holds an unknown value). */
export function readLocaleCookie(): Locale {
  if (typeof document === 'undefined') return resolveLocale(undefined);
  const prefix = `${LOCALE_COOKIE}=`;
  const raw = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(prefix));
  return resolveLocale(raw === undefined ? undefined : decodeURIComponent(raw.slice(prefix.length)));
}

/** Remembers the locale for a year on this browser. */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
