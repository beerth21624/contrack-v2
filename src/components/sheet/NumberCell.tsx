'use client';

import { useRef, useState } from 'react';
import { evaluateNumber } from './evaluate';

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
    /** Shown while the cell is empty (see `blankZero`). */
    placeholder?: string;
    /** Show an empty cell (and the placeholder) instead of "0.00" while the value is 0, e.g. an unfilled plan value. */
    blankZero?: boolean;
}

interface CellFormat { digits?: number; percent?: boolean; blankZero?: boolean }

/**
 * Inputs take the surrounding font (as `font: inherit` would), spelled out per property: React warns when the
 * `font` shorthand is mixed with `fontWeight` in one style object.
 */
const INHERIT_FONT = {
    fontFamily: 'inherit', fontSize: 'inherit', fontStyle: 'inherit', lineHeight: 'inherit', letterSpacing: 'inherit',
} as const;

/** What a number cell shows while it is not being edited. */
export function numberCellText(value: number, { digits = 2, percent, blankZero }: CellFormat = {}): string {
    const shown = percent ? value * 100 : value;
    if (blankZero && shown === 0) return '';
    return percent ? `${formatNumber(shown, 0)}%` : formatNumber(shown, digits);
}

/** The text a number cell starts editing with (plain digits, no grouping). */
export function numberCellEditText(value: number, { percent, blankZero }: CellFormat = {}): string {
    const shown = percent ? value * 100 : value;
    if (blankZero && shown === 0) return '';
    return String(Number(shown.toFixed(6)));
}

/**
 * A yellow input cell that edits like a spreadsheet: type, then Enter/Tab/blur commits.
 * Clearing the cell commits `undefined` (back to the template default).
 */
export function NumberCell({
    value, onCommit, edited, digits = 2, percent, ariaLabel, tone = 'input', placeholder, blankZero,
}: NumberCellProps) {
    // Draft text only while the cell is being edited; otherwise the formatted value is shown.
    const [text, setText] = useState<string | null>(null);
    // Text the cell started with on focus: leaving the cell without typing commits nothing, so a value that
    // comes from a calculator (green) is not frozen into an override just by clicking through it.
    const [initial, setInitial] = useState<string | null>(null);
    // Escape blurs the cell in the same event, before the cleared draft renders: this flag stops that blur committing.
    const cancelled = useRef(false);

    const commit = () => {
        if (cancelled.current) { cancelled.current = false; setText(null); return; }
        if (text === null) return;
        if (text === initial) { setText(null); return; }
        const trimmed = text.replace(/,/g, '').replace(/%$/, '').trim();
        if (trimmed === '') onCommit(undefined);
        else {
            // Plain numbers or Excel-style arithmetic ("7*2.3", "=12+3.5"); anything unreadable keeps the old value.
            const n = evaluateNumber(trimmed);
            if (n !== undefined) onCommit(percent ? n / 100 : n);
        }
        setText(null);
    };

    return (
        <input
            aria-label={ariaLabel}
            inputMode="decimal"
            placeholder={placeholder}
            value={text ?? numberCellText(value, { digits, percent, blankZero })}
            onFocus={(e) => {
                const start = numberCellEditText(value, { percent, blankZero });
                setText(start);
                setInitial(start);
                requestAnimationFrame(() => e.target.select());
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { cancelled.current = true; setText(null); (e.target as HTMLInputElement).blur(); }
            }}
            style={{
                width: '100%', minWidth: 0, textAlign: 'right', border: '1px solid transparent',
                background: tone === 'calc' ? SHEET_COLORS.calc : SHEET_COLORS.input, padding: '2px 4px', borderRadius: 3,
                ...INHERIT_FONT, fontWeight: edited ? 700 : 400,
            }}
            className="sheet-cell focus:outline-none focus:border-orange-400"
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
    const cancelled = useRef(false);
    const commit = () => {
        if (cancelled.current) { cancelled.current = false; setText(null); return; }
        if (text === null) return;
        if (text === value) { setText(null); return; }
        onCommit(text.trim() === '' ? undefined : text);
        setText(null);
    };
    // A one-line textarea that grows with its text (`.sheet-text` → field-sizing: content), so a long item name
    // wraps inside its cell instead of being cut off. It still edits like a one-line input: Enter commits, and
    // pasted line breaks become spaces.
    return (
        <textarea
            rows={1}
            aria-label={ariaLabel}
            value={text ?? value}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value.replace(/\r?\n/g, ' '))}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                if (e.key === 'Escape') { cancelled.current = true; setText(null); e.currentTarget.blur(); }
            }}
            style={{
                width: '100%', minWidth: 0, border: '1px solid transparent', background: 'transparent',
                padding: '2px 4px', borderRadius: 3, ...INHERIT_FONT, fontWeight: edited ? 700 : 400,
            }}
            className="sheet-text focus:outline-none focus:border-orange-400 focus:bg-white"
        />
    );
}
