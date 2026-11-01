// Journey texts for code without React (pure helpers), in the UI locale (the NEXT_LOCALE cookie).
import { createTranslator } from 'next-intl';
import { readLocaleCookie } from '@/i18n/locale-cookie';
import enJourney from '@/i18n/messages/en/journeyUi.json';
import thJourney from '@/i18n/messages/th/journeyUi.json';

export function journeyText() {
    const locale = readLocaleCookie();
    return createTranslator({
        locale,
        messages: { journeyUi: locale === 'th' ? thJourney : enJourney },
        namespace: 'journeyUi',
        timeZone: 'Asia/Bangkok',
    });
}
