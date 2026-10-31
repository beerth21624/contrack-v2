'use client';

// ─── formatter / parser of MoneyInput and QtyInput (antd InputNumber), bound to the UI locale ───
import { useMemo } from 'react';
import { useFormat } from '@/i18n/useFormat';

type Formatter = (value: number | string | undefined, info: { userTyping: boolean; input: string }) => string;

/**
 * Stable callbacks on purpose: InputNumber re-formats its text whenever `formatter` changes identity, which would
 * turn a half-typed `1.` into `1.00` on every render.
 * - typing: the typed text regrouped (`12345.` → `12,345.`), decimals left as typed;
 * - otherwise (blur, a new value): the value with `min`…`max` decimals (`1,234.50`).
 */
export function useNumberInputFormat(min: number, max: number): { formatter: Formatter; parser: (text: string | undefined) => number } {
    const fmt = useFormat();
    return useMemo(() => ({
        formatter: (value, info) => {
            if (info.userTyping) return fmt.numberInput(fmt.parseNumberInput(info.input));
            if (value === undefined || String(value) === '') return '';
            return fmt.number(Number(value), { min, max });
        },
        // A string on purpose (as antd's own parser does): '' clears the field (null) instead of becoming 0.
        parser: text => fmt.parseNumberInput(text) as unknown as number,
    }), [fmt, min, max]);
}
