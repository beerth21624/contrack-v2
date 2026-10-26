'use client';

import { NumberCell } from '@/components/sheet/NumberCell';

/**
 * A plan length or area typed as a sum of segments ("9.5+7+2"), stored as the sum (the field holds one number).
 * Empty while 0, with an example as placeholder; clearing it stores 0.
 */
export function SumInput({ value, onChange, ariaLabel, placeholder = 'เช่น 9.5+7+2' }: {
    value: number; onChange: (v: number) => void; ariaLabel: string; placeholder?: string;
}) {
    return (
        <NumberCell value={value} blankZero placeholder={placeholder} ariaLabel={ariaLabel}
            onCommit={v => onChange(v ?? 0)} />
    );
}
