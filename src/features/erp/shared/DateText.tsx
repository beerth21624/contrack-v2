'use client';

// ─── A date in the UI locale, always the Christian-era year: `31 ต.ค. 2026` / `31 Oct 2026` ───
// A business date `YYYY-MM-DD` is shown as that calendar day; an ISO timestamp in Bangkok time.
import { useFormat } from '@/i18n/useFormat';

export type DateTextStyle = 'short' | 'long' | 'dateTime';

export function DateText({ value, style = 'short', className, emptyText = '–' }: {
    value: string | Date | null | undefined;
    /** short `31 ต.ค. 2026`, long `31 ตุลาคม 2026`, dateTime `31 ต.ค. 2026 14:05`. */
    style?: DateTextStyle;
    className?: string;
    emptyText?: string;
}) {
    const fmt = useFormat();
    let text = '';
    if (value !== null && value !== undefined) {
        text = style === 'long' ? fmt.dateLong(value) : style === 'dateTime' ? fmt.dateTime(value) : fmt.date(value);
    }
    return <span className={`whitespace-nowrap ${className ?? ''}`}>{text === '' ? emptyText : text}</span>;
}
