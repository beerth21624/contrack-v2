'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
    installmentLabelIn, monthLabelIn, sampleTextIn, taskNameIn, taskTitleIn,
    type WageSet, type WeekBucket,
} from '@/domain/planning';

/**
 * The `planning` translator plus the English overlay of the planning data labels (task names, month
 * abbreviations, installment labels, wage set names) in the UI locale. Thai (the stored text) is the fallback.
 */
export function usePlanningText() {
    const t = useTranslations('planning');
    const locale = useLocale();
    return useMemo(() => ({
        t,
        locale,
        /** "ม.ค.-26" / "W3 มี.ค.-26" → the locale's month abbreviation. */
        month: (label: string) => monthLabelIn(label, locale),
        /** "W3 มี.ค.-26". */
        bucket: (b: WeekBucket | undefined) => (b ? `${b.weekLabel} ${monthLabelIn(b.monthLabel, locale)}` : ''),
        task: (id: string, name: string) => taskNameIn(id, name, locale),
        title: (id: string, title: string) => taskTitleIn(id, title, locale),
        installment: (label: string) => installmentLabelIn(label, locale),
        sample: (text: string) => sampleTextIn(text, locale),
        /** "A · งานทั่วไป" (the id alone, "Set A", when the set has no name). */
        wageSet: (set: WageSet) => {
            const name = set.name.trim();
            return name === '' ? t('wageSets.unnamed', { id: set.id }) : `${set.id} · ${sampleTextIn(name, locale)}`;
        },
    }), [t, locale]);
}

export type PlanningText = ReturnType<typeof usePlanningText>;
