// ─── Texts of store notices for code without React, in the UI locale (the NEXT_LOCALE cookie) ───
import { createTranslator } from 'next-intl';
import { readLocaleCookie } from '@/i18n/locale-cookie';
import enShell from '@/i18n/messages/en/shell.json';
import thShell from '@/i18n/messages/th/shell.json';

function shellText(key: 'readOnlyNotice' | 'cloudNewProjectNotice'): string {
    const locale = readLocaleCookie();
    const t = createTranslator({
        locale,
        messages: { shell: locale === 'th' ? thShell : enShell },
        namespace: 'shell',
        timeZone: 'Asia/Bangkok',
    });
    return t(key);
}

/** `shell.readOnlyNotice`: an edit refused because the user only views this cloud project. */
export function readOnlyText(): string {
    return shellText('readOnlyNotice');
}

/** `shell.cloudNewProjectNotice`: "start over" refused while a cloud project is open. */
export function cloudNewProjectText(): string {
    return shellText('cloudNewProjectNotice');
}
