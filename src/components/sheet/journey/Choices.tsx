'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { journeyText } from './text';

/**
 * A small set of options as buttons (instead of a dropdown) — for 2–5 choices the user should see at once,
 * e.g. brick type, wall side, pipe size. Same value semantics as a select: `onChange(value)`.
 */
export function ChoiceButtons<T extends string | number>({ value, options, onChange, ariaLabel, size = 'middle' }: {
    value: T | undefined;
    options: readonly { value: T; label: ReactNode; hint?: string }[];
    onChange: (value: T) => void;
    ariaLabel: string;
    size?: 'small' | 'middle';
}) {
    const h = size === 'small' ? 'min-h-[30px] px-2.5 text-[12px]' : 'min-h-[36px] px-3.5 text-[13px]';
    return (
        <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
            {options.map(o => {
                const selected = o.value === value;
                return (
                    <button key={String(o.value)} type="button" role="radio" aria-checked={selected} title={o.hint}
                        onClick={() => onChange(o.value)}
                        className={`${h} rounded-md border font-medium transition cursor-pointer
                            ${selected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-orange-300'}`}>
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

/** Decimals of a value as typed ("0.15" → 2, "1" → 0). */
const decimalsOf = (v: number): number => (String(v).split('.')[1] ?? '').length;

/** Every chip with the same number of decimals, as the box shows them: 0.15 / 0.20 (not 0.15 / 0.2). */
const sameDecimals = (values: readonly number[]) => {
    const d = Math.max(0, ...values.map(decimalsOf));
    return (v: number) => v.toFixed(d);
};

/**
 * Quick-pick chips for common values next to a number input (e.g. slab thickness 0.10 / 0.12 / 0.15 m). The input
 * stays the source of truth; a chip only fills it.
 */
export function PresetChips({ values, current, onPick, format = sameDecimals(values), label }: {
    values: readonly number[];
    current: number;
    onPick: (v: number) => void;
    format?: (v: number) => string;
    label?: string;
}) {
    const t = useTranslations('journeyUi.choices');
    return (
        <div className="flex flex-wrap items-center gap-1" aria-label={label ?? t('commonValues')}>
            {label !== undefined && <span className="text-[12px] text-gray-400 mr-0.5">{label}</span>}
            {values.map(v => (
                <button key={v} type="button" onClick={() => onPick(v)}
                    className={`px-2 py-0.5 rounded-full border text-[12px] tabular-nums cursor-pointer transition
                        ${v === current ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300'}`}>
                    {format(v)}
                </button>
            ))}
        </div>
    );
}

/** An inline note under a field: `warn` for a value that looks wrong (it is still accepted), `info` for guidance. */
export function FieldNote({ tone = 'warn', children }: { tone?: 'warn' | 'info'; children: ReactNode }) {
    return (
        <div className={`flex items-start gap-1.5 text-[12px] mt-1 ${tone === 'warn' ? 'text-amber-700' : 'text-gray-500'}`}>
            {tone === 'warn' ? <ExclamationCircleOutlined className="mt-0.5" /> : <InfoCircleOutlined className="mt-0.5" />}
            <span>{children}</span>
        </div>
    );
}

/**
 * Plausibility check for a plan value: undefined when fine, else a short Thai reason. Values outside the range are
 * still accepted (the user may be right) — the note only asks them to double-check.
 */
export function outOfRange(value: number, min: number, max: number, unit: string): string | undefined {
    if (!Number.isFinite(value) || value === 0) return undefined;
    const t = journeyText();
    if (value < 0) return t('choices.range.negative');
    if (value < min) return t('choices.range.low', { min: String(min), max: String(max), unit });
    if (value > max) return t('choices.range.high', { min: String(min), max: String(max), unit });
    return undefined;
}
