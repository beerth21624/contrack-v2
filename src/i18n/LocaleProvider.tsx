'use client';

import React, { createContext, useContext } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { type Locale, defaultLocale } from './config';
import thMessages from './messages/th';

interface LocaleContextType {
  locale: Locale;
}

const LocaleContext = createContext<LocaleContextType>({ locale: defaultLocale });

export function useAppLocale() {
  return useContext(LocaleContext);
}

/**
 * The app is Thai only: most screens are written in Thai directly, so an English switch would give a half-translated
 * app. A locale an earlier version stored under `contrack-locale` is ignored.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  return (
    <LocaleContext.Provider value={{ locale: defaultLocale }}>
      <NextIntlClientProvider locale={defaultLocale} messages={thMessages} timeZone="Asia/Bangkok">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
