'use client';

import { useState } from 'react';

/** Excel-like cell colours: yellow = user input, green = formula. */
export const SHEET_COLORS = {
    input: '#fff2cc',
    calc: '#e2f0d9',
    header: '#e3ebf9',
    subtotal: '#f3f3f3',
} as const;

export function formatNumber(v: number | null | undefined, digits = 2): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return '';
    return v.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

interface NumberCellProps {
    value: number;
    onCommit: (v: number | undefined) => void;
    /** Shown in bold when the value differs from the template default. */
    edited?: boolean;
    digits?: number;
    /** Display/enter as a percentage (stored as a fraction). */
    percent?: boolean;
    ariaLabel?: string;
    /** 'calc' = value currently comes from a calculator (green) but can still be overridden. */
    tone?: 'input' | 'calc';
}

/**
 * A yellow input cell that edits like a spreadsheet: type, then Enter/Tab/blur commits.
 * Clearing the cell commits `undefined` (back to the template default).
 */
export function NumberCell({ value, onCommit, edited, digits = 2, percent, ariaLabel, tone = 'input' }: NumberCellProps) {
    const shown = percent ? value * 100 : value;
    // Draft text only while the cell is being edited; otherwise the formatted value is shown.
    const [text, setText] = useState<string | null>(null);
    // Text the cell started with on focus: leaving the cell without typing commits nothing, so a value that
    // comes from a calculator (green) is not frozen into an override just by clicking through it.
    const [initial, setInitial] = useState<string | null>(null);

    const commit = () => {
        if (text === null) return;
        if (text === initial) { setText(null); return; }
        const trimmed = text.replace(/,/g, '').trim();
        if (trimmed === '') onCommit(undefined);
        else {
            const n = Number(trimmed);
            if (Number.isFinite(n)) onCommit(percent ? n / 100 : n);
        }
        setText(null);
    };

    return (
        <input
            aria-label={ariaLabel}
            inputMode="decimal"
            value={text ?? (percent ? `${formatNumber(shown, 0)}%` : formatNumber(shown, digits))}
            onFocus={(e) => {
                const start = String(Number(shown.toFixed(6)));
                setText(start);
                setInitial(start);
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
                background: tone === 'calc' ? SHEET_COLORS.calc : SHEET_COLORS.input, padding: '2px 4px', borderRadius: 3,
                fontWeight: edited ? 700 : 400, font: 'inherit',
            }}
            className="focus:outline-none focus:border-orange-400"
        />
    );
}

interface TextCellProps {
    value: string;
    onCommit: (v: string | undefined) => void;
    edited?: boolean;
    placeholder?: string;
    ariaLabel?: string;
}

export function TextCell({ value, onCommit, edited, placeholder, ariaLabel }: TextCellProps) {
    // Draft text only exists once the user types (onChange), so focusing and leaving commits nothing.
    const [text, setText] = useState<string | null>(null);
    const commit = () => {
        if (text === null) return;
        if (text === value) { setText(null); return; }
        onCommit(text.trim() === '' ? undefined : text);
        setText(null);
    };
    return (
        <input
            aria-label={ariaLabel}
            value={text ?? value}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setText(null); (e.target as HTMLInputElement).blur(); }
            }}
            style={{
                width: '100%', minWidth: 0, border: '1px solid transparent', background: 'transparent',
                padding: '2px 4px', borderRadius: 3, fontWeight: edited ? 700 : 400, font: 'inherit',
            }}
            className="focus:outline-none focus:border-orange-400 focus:bg-white"
        />
    );
}
