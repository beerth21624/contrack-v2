'use client';

// ─── Quantity entry: antd InputNumber with up to four decimals and digit grouping from src/i18n/format.ts ───
// Positive by default; `allowNegative` for VO deductions (quantitySchema allows −1e9 … 1e9).
import { InputNumber, type InputNumberProps } from 'antd';
import { useNumberInputFormat } from './number-input';

const QTY_MAX = 1e9;

export type QtyInputProps = Omit<InputNumberProps<number>, 'precision' | 'formatter' | 'parser' | 'stringMode'> & {
    allowNegative?: boolean;
    /** Decimals kept (default 4, the stored precision). */
    precision?: number;
};

export function QtyInput({ allowNegative = false, precision = 4, min, max, className, style, ...rest }: QtyInputProps) {
    const { formatter, parser } = useNumberInputFormat(0, precision);
    return (
        <InputNumber<number>
            {...rest}
            min={min ?? (allowNegative ? -QTY_MAX : 0)}
            max={max ?? QTY_MAX}
            precision={precision}
            formatter={formatter}
            parser={parser}
            inputMode="decimal"
            className={`tabular-nums ${className ?? ''}`}
            style={{ width: '100%', ...style }}
        />
    );
}
