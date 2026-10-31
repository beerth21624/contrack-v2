// ─── Text of the public link page: follows the document's language, not the browser (like documentTranslator) ───
import { createTranslator } from 'next-intl';
import type { DocLanguage } from '@/shared/contract';
import enCustomerLinks from '@/i18n/messages/en/customerLinks.json';
import thCustomerLinks from '@/i18n/messages/th/customerLinks.json';

export function customerLinkTranslator(language: DocLanguage) {
    return createTranslator({
        locale: language,
        messages: { customerLinks: language === 'th' ? thCustomerLinks : enCustomerLinks },
        namespace: 'customerLinks',
        timeZone: 'Asia/Bangkok',
    });
}

export type CustomerLinkTranslator = ReturnType<typeof customerLinkTranslator>;
