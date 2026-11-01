'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { BOQ_SECTION_TITLES_EN, boqLineEn } from '@/domain/boq/template.v5.en';
import { unitEn } from '@/domain/boq/units';
import type { CalculatorDef } from '@/domain/calculators/types';

/**
 * BOQ page content (section titles, line descriptions, units, calculator names) in the UI locale: the English overlay
 * of the v5 template (docs/erp/03-i18n.md §6) when the locale is English; Thai text, or text with no translation,
 * shows as it is.
 */
export function useBoqText() {
    const locale = useLocale();
    return useMemo(() => {
        const en = locale === 'en';
        return {
            locale,
            section: (no: number, titleTh: string): string => (en ? BOQ_SECTION_TITLES_EN[no] ?? titleTh : titleTh),
            line: (key: string, descTh: string): string => (en ? (boqLineEn(key, descTh) || descTh) : descTh),
            unit: (unit: string): string => (en ? unitEn(unit) : unit),
            calc: (def: Pick<CalculatorDef, 'title' | 'titleEn'>): string => (en ? def.titleEn : def.title),
        };
    }, [locale]);
}
