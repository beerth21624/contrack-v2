// ─── Export / print texts for code without React (document builders), in the document's language ───
// The BOQ documents follow the UI language at the moment of printing (docs/erp/03-i18n.md §6): callers pass the
// locale; `th` is the default, so the Thai output of release 1 is unchanged.
import type { Locale } from '@/i18n/config';
import enExport from '@/i18n/messages/en/export.json';
import thExport from '@/i18n/messages/th/export.json';
import { BOQ_SECTION_TITLES_EN, boqLineEn } from '@/domain/boq/template.v5.en';
import { unitEn } from '@/domain/boq/units';

export type ExportMessages = typeof thExport;

export function exportMessages(locale: Locale = 'th'): ExportMessages {
    return locale === 'th' ? thExport : enExport;
}

/** Grouped number with fixed fraction digits in the locale's digits and separators. */
export function groupedNumber(v: number, locale: Locale, fractionDigits: number): string {
    return v.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', {
        minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
    });
}

/** BOQ line description in the document language (the English overlay when it has one, else as written). */
export function lineDesc(key: string, desc: string, locale: Locale): string {
    if (locale === 'th') return desc;
    const en = boqLineEn(key, desc);
    return en === '' ? desc : en;
}

export function unitText(unit: string, locale: Locale): string {
    return locale === 'th' ? unit : unitEn(unit);
}

export function sectionTitle(no: number, title: string, locale: Locale): string {
    if (locale === 'th') return title;
    return BOQ_SECTION_TITLES_EN[no] ?? title;
}
