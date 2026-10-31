'use client';

// ─── A rate (fraction in the data, 0.15) typed as a percent (15) ───
import { InputNumber } from 'antd';
import { percentOfRate, rateFromPercent } from './logic';

export function PercentInput({ value, onChange, disabled, max = 900, allowEmpty = false, placeholder, className, 'aria-label': ariaLabel }: {
    /** Fraction, or null (empty) when `allowEmpty`. */
    value: number | null;
    onChange: (rate: number | null) => void;
    disabled?: boolean;
    /** Largest percent. */
    max?: number;
    allowEmpty?: boolean;
    placeholder?: string;
    className?: string;
    'aria-label'?: string;
}) {
    return (
        <InputNumber<number>
            aria-label={ariaLabel}
            className={`tabular-nums ${className ?? '!w-[90px]'}`}
            min={0} max={max} step={1} precision={2} suffix="%" disabled={disabled} placeholder={placeholder}
            value={value === null ? null : percentOfRate(value)}
            onChange={v => {
                if (v === null) { if (allowEmpty) onChange(null); return; }
                onChange(rateFromPercent(v));
            }}
        />
    );
}
