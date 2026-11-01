import type { useTranslations } from 'next-intl';

/** The `calculators` translator, for helpers that live outside a component. */
export type CalcT = ReturnType<typeof useTranslations<'calculators'>>;
