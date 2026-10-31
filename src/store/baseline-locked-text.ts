// ─── Text of the "BOQ locked by a baseline" notice, for code without React (store, sync controller) ───
import { createTranslator } from 'next-intl';
import { readLocaleCookie } from '@/i18n/locale-cookie';
import enBoqControl from '@/i18n/messages/en/boqControl.json';
import thBoqControl from '@/i18n/messages/th/boqControl.json';

/** `boqControl.lockedNotice` in the UI locale (the NEXT_LOCALE cookie). */
export function baselineLockedText(): string {
    const locale = readLocaleCookie();
    const t = createTranslator({
        locale,
        messages: { boqControl: locale === 'th' ? thBoqControl : enBoqControl },
        namespace: 'boqControl',
        timeZone: 'Asia/Bangkok',
    });
    return t('lockedNotice');
}
