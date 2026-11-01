'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { levelPlanHint, levelTitleIn, missingLabel, phaseTitle, type JourneyLevel, type JourneyPhase, type MissingValue } from '@/domain/journey';

/** Names of journey levels / phases and the required-value list in the UI locale (English overlay of the Thai domain text). */
export function useLevelText() {
    const locale = useLocale();
    return useMemo(() => ({
        locale,
        level: (l: JourneyLevel) => levelTitleIn(l, locale),
        hint: (l: JourneyLevel) => levelPlanHint(l, locale),
        phase: (p: JourneyPhase) => phaseTitle(p, locale),
        missing: (m: MissingValue) => missingLabel(m, locale),
    }), [locale]);
}
