'use client';

// ─── UI locale on the client: switching it (cookie + profile), and the antd / dayjs locale that goes with it ───
// The messages themselves come from the server (src/app/layout.tsx → NextIntlClientProvider, src/i18n/request.ts).
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { ConfigProviderProps } from 'antd';
import enUS from 'antd/locale/en_US';
import thTH from 'antd/locale/th_TH';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/th';
import { api } from '@/features/cloud/api/routes';
import { useSession } from '@/features/cloud/auth/session';
import type { Locale } from './config';
import { writeLocaleCookie } from './locale-cookie';

type AntdLocale = NonNullable<ConfigProviderProps['locale']>;

interface LocaleContextType {
  locale: Locale;
  /**
   * Remembers the locale on this browser (cookie), saves it to the profile when signed in, and renders again.
   * Resolves false when the profile could not be saved (the cookie still applies on this browser).
   */
  setLocale: (locale: Locale) => Promise<boolean>;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

export function useAppLocale(): LocaleContextType {
  const ctx = useContext(LocaleContext);
  const locale = useLocale();
  // Outside the provider (should not happen: the root layout renders it) the locale still reads right.
  return ctx ?? { locale, setLocale: () => Promise.resolve(false) };
}

/**
 * The antd locale for the current UI locale (date picker, Empty, Popconfirm, pagination texts). Also switches dayjs
 * (month and weekday names) during render, so the server render and the client agree. Dates are still shown with
 * explicit formats (Christian-era year).
 */
export function useAntdLocale(): AntdLocale {
  const locale = useLocale();
  if (dayjs.locale() !== locale) dayjs.locale(locale);
  return locale === 'en' ? enUS : thTH;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const router = useRouter();

  const setLocale = useCallback(async (next: Locale): Promise<boolean> => {
    writeLocaleCookie(next);
    let saved = true;
    if (useSession.getState().status === 'signed-in') {
      try {
        await api.mePreferences.update({ locale: next });
      } catch {
        saved = false;
      }
    }
    router.refresh();
    return saved;
  }, [router]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
