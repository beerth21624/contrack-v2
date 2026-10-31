// ─── Translator for printed documents: follows the document's own language, not the UI locale (03-i18n.md §6) ───
import { createTranslator } from 'next-intl';
import type { Locale } from './config';
import enDocuments from './messages/en/documents.json';
import thDocuments from './messages/th/documents.json';

export function documentTranslator(locale: Locale) {
    return createTranslator({
        locale,
        messages: { documents: locale === 'th' ? thDocuments : enDocuments },
        namespace: 'documents',
        timeZone: 'Asia/Bangkok',
    });
}

export type DocumentTranslator = ReturnType<typeof documentTranslator>;
