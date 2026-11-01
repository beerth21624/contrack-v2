// Domain values of the calculators (wall parts, kinds, items, units) as the screen shows them in the UI locale.
// Non-hook form for module-level helpers; the locale is the NEXT_LOCALE cookie (as notice-texts / journeyText).
import { domainText, domainUnit } from '@/domain/calculators/sections.en';
import { readLocaleCookie } from '@/i18n/locale-cookie';

/** Thai value → what to show (English overlay when the UI is English). */
export const dt = (th: string): string => domainText(th, readLocaleCookie());

/** Unit → what to show. */
export const du = (unit: string): string => domainUnit(unit, readLocaleCookie());
