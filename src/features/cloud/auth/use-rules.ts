'use client';

// ─── The antd form rules in the UI language ───
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { buildRules } from './form-rules';

export function useRules() {
    const t = useTranslations('auth.rules');
    return useMemo(() => buildRules(t), [t]);
}
