'use client';

// ─── An amount in baht: `1,234.50` (two decimals, tabular figures) in both languages ───
import { useFormat } from '@/i18n/useFormat';

export function MoneyText({ value, currency = false, muted = false, className, emptyText = '–' }: {
    value: number | null | undefined;
    /** `1,234.50 บาท` / `THB 1,234.50` instead of the bare amount. */
    currency?: boolean;
    muted?: boolean;
    className?: string;
    /** Shown for null / undefined / a non-finite value. */
    emptyText?: string;
}) {
    const fmt = useFormat();
    const text = value === null || value === undefined ? '' : currency ? fmt.baht(value) : fmt.money(value);
    return (
        <span className={`tabular-nums whitespace-nowrap ${muted ? 'text-gray-500' : ''} ${className ?? ''}`}>
            {text === '' ? emptyText : text}
        </span>
    );
}
