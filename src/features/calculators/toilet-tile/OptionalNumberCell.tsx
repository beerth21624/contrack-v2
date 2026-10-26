'use client';

import { useState } from 'react';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

/**
 * A yellow number cell that may be left blank (Excel: an empty cell is skipped by PRODUCT and is not 0).
 * Clearing the cell commits `undefined`.
 */
export function OptionalNumberCell({ value, onCommit, ariaLabel }: {
    value: number | undefined; onCommit: (v: number | undefined) => void; ariaLabel?: string;
}) {
    const [text, setText] = useState<string | null>(null);
    const shown = value !== undefined && Number.isFinite(value) ? value : undefined;

    const commit = () => {
        if (text === null) return;
        const trimmed = text.replace(/,/g, '').trim();
        if (trimmed === '') onCommit(undefined);
        else {
            const n = Number(trimmed);
            if (Number.isFinite(n)) onCommit(n);
        }
        setText(null);
    };

    return (
        <input
            aria-label={ariaLabel}
            inputMode="decimal"
            value={text ?? (shown === undefined ? '' : formatNumber(shown))}
            onFocus={(e) => {
                setText(shown === undefined ? '' : String(Number(shown.toFixed(6))));
                requestAnimationFrame(() => e.target.select());
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setText(null); (e.target as HTMLInputElement).blur(); }
            }}
            style={{
                width: '100%', minWidth: 0, textAlign: 'right', border: '1px solid transparent',
                background: SHEET_COLORS.input, padding: '2px 4px', borderRadius: 3, font: 'inherit',
            }}
            className="focus:outline-none focus:border-orange-400"
        />
    );
}
