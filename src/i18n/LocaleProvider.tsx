'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { type Locale, defaultLocale } from './config';
import thMessages from './messages/th';
import enMessages from './messages/en';

const messages: Record<Locale, typeof thMessages> = {
  th: thMessages,
  en: enMessages,
};

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: defaultLocale,
  setLocale: () => undefined,
});

export function useAppLocale() {
  return useContext(LocaleContext);
}

const STORAGE_KEY = 'contrack-locale';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'th' || stored === 'en') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(stored);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  // Avoid hydration mismatch — render with default until mounted
  const activeLocale = mounted ? locale : defaultLocale;

  return (
    <LocaleContext.Provider value={{ locale: activeLocale, setLocale }}>
      <NextIntlClientProvider locale={activeLocale} messages={messages[activeLocale]} timeZone="Asia/Bangkok">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
