'use client';

// ─── The formatters of src/i18n/format.ts bound to the current UI locale ───
import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
    type NumberFormatOptions, formatBaht, formatDate, formatDateLong, formatDateTime, formatMoney, formatNumber,
    formatPercent, formatQty,
} from './format';

export function useFormat() {
    const locale = useLocale();
    return useMemo(() => ({
        locale,
        number: (value: number, options?: NumberFormatOptions) => formatNumber(value, locale, options),
        money: (value: number) => formatMoney(value, locale),
        baht: (value: number) => formatBaht(value, locale),
        qty: (value: number) => formatQty(value, locale),
        percent: (rate: number, digits?: number) => formatPercent(rate, locale, digits),
        date: (value: string | Date) => formatDate(value, locale),
        dateLong: (value: string | Date) => formatDateLong(value, locale),
        dateTime: (value: string | Date) => formatDateTime(value, locale),
    }), [locale]);
}

export type Formatters = ReturnType<typeof useFormat>;
