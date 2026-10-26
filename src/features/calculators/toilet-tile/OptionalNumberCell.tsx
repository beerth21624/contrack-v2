'use client';

import { useState } from 'react';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { evaluateNumber } from '@/components/sheet/evaluate';

/**
 * A yellow number cell that may be left blank (Excel: an empty cell is skipped by PRODUCT and is not 0).
 * Clearing the cell commits `undefined`.
 */
export function OptionalNumberCell({ value, onCommit, ariaLabel, placeholder }: {
    value: number | undefined; onCommit: (v: number | undefined) => void; ariaLabel?: string; placeholder?: string;
}) {
    const [text, setText] = useState<string | null>(null);
    const shown = value !== undefined && Number.isFinite(value) ? value : undefined;
    const start = shown === undefined ? '' : String(Number(shown.toFixed(6)));

    const commit = () => {
        if (text === null) return;
        // Leaving the cell without typing commits nothing (the input stays untouched).
        if (text === start) { setText(null); return; }
        const trimmed = text.replace(/,/g, '').trim();
        if (trimmed === '') onCommit(undefined);
        else {
            // Plain numbers or Excel-style arithmetic as the sheet types them ("2*(2.3+3)", "=(0.7*2)+(0.5*1.8)").
            const n = evaluateNumber(trimmed);
            if (n !== undefined) onCommit(n);
        }
        setText(null);
    };

    return (
        <input
            aria-label={ariaLabel}
            placeholder={placeholder}
            inputMode="decimal"
            value={text ?? (shown === undefined ? '' : formatNumber(shown))}
            onFocus={(e) => {
                setText(start);
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
