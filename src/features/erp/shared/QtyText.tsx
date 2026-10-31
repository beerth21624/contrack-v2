'use client';

// ─── A quantity: up to four decimals, trailing zeros dropped (`12.5`), with an optional unit ───
import { useFormat } from '@/i18n/useFormat';

export function QtyText({ value, unit, className, emptyText = '–' }: {
    value: number | null | undefined;
    /** Shown after the number (`12.5 ตร.ม.`); user / BOQ data, not translated here. */
    unit?: string;
    className?: string;
    emptyText?: string;
}) {
    const fmt = useFormat();
    const text = value === null || value === undefined ? '' : fmt.qty(value);
    if (text === '') return <span className={className}>{emptyText}</span>;
    return (
        <span className={`tabular-nums whitespace-nowrap ${className ?? ''}`}>
            {text}{unit !== undefined && unit !== '' ? <span className="text-gray-500"> {unit}</span> : null}
        </span>
    );
}
