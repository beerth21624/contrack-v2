'use client';

// ─── Money entry: antd InputNumber with two decimals and digit grouping from src/i18n/format.ts ───
// Positive by default (amountSchema); `allowNegative` for VO deductions / credit notes (signedAmountSchema).
import { InputNumber, type InputNumberProps } from 'antd';
import { MONEY_MAX } from '@/domain/money/money';
import { useNumberInputFormat } from './number-input';

export type MoneyInputProps = Omit<InputNumberProps<number>, 'precision' | 'formatter' | 'parser' | 'stringMode'> & {
    allowNegative?: boolean;
};

export function MoneyInput({ allowNegative = false, min, max, className, style, ...rest }: MoneyInputProps) {
    const { formatter, parser } = useNumberInputFormat(2, 2);
    return (
        <InputNumber<number>
            {...rest}
            min={min ?? (allowNegative ? -MONEY_MAX : 0)}
            max={max ?? MONEY_MAX}
            precision={2}
            formatter={formatter}
            parser={parser}
            // The phone decimal pad (iOS) has no minus key.
            inputMode={allowNegative ? 'text' : 'decimal'}
            className={`tabular-nums ${className ?? ''}`}
            style={{ width: '100%', ...style }}
        />
    );
}
