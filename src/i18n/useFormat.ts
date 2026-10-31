'use client';

// ─── The formatters of src/i18n/format.ts bound to the current UI locale ───
import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
    type NumberFormatOptions, formatBaht, formatDate, formatDateLong, formatDateTime, formatMoney, formatNumber,
    formatNumberInput, formatPercent, formatQty, parseNumberInput,
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
        /** Digit grouping of a number input's text while typing (antd InputNumber `formatter`). */
        numberInput: (text: string) => formatNumberInput(text, locale),
        /** The inverse of `numberInput` (antd InputNumber `parser`). */
        parseNumberInput: (text: string | undefined) => parseNumberInput(text, locale),
    }), [locale]);
}

export type Formatters = ReturnType<typeof useFormat>;
