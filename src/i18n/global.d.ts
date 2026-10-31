import type th from './messages/th';
import type { Locale } from './config';

// Typed keys: a misspelt message key (or a key missing from the Thai messages) fails `tsc`.
declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof th;
    Locale: Locale;
  }
}
