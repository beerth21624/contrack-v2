'use client';

import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { NumberCell } from '@/components/sheet/NumberCell';

const finite = (v: number) => (Number.isFinite(v) ? v : 0);

/**
 * A count read off the plan with − / + buttons around the yellow box (the box still takes any typed number).
 * Empty while 0. Does not go below `min`.
 */
export function CountStepper({ value, onChange, ariaLabel, min = 0, step = 1, digits = 0, unit, missing }: {
    value: number;
    onChange: (v: number) => void;
    ariaLabel: string;
    min?: number;
    step?: number;
    digits?: number;
    unit?: string;
    missing?: boolean;
}) {
    const v = finite(value);
    const btn = 'w-7 h-7 shrink-0 flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 '
        + 'text-[11px] cursor-pointer hover:border-orange-300 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed';
    return (
        <span className="inline-flex items-center gap-1">
            <button type="button" className={btn} aria-label={`ลด ${ariaLabel}`} disabled={v <= min}
                onClick={() => onChange(Math.max(min, Number((v - step).toFixed(6))))}>
                <MinusOutlined />
            </button>
            <span className={`w-[56px] rounded ${missing ? 'ring-1 ring-red-400' : ''}`}>
                <NumberCell value={v} digits={Number.isInteger(v) ? digits : 2} blankZero placeholder="0" ariaLabel={ariaLabel}
                    onCommit={n => onChange(n ?? 0)} />
            </span>
            <button type="button" className={btn} aria-label={`เพิ่ม ${ariaLabel}`}
                onClick={() => onChange(Number((v + step).toFixed(6)))}>
                <PlusOutlined />
            </button>
            {unit !== undefined && <span className="text-[12px] text-gray-500 whitespace-nowrap ml-0.5">{unit}</span>}
        </span>
    );
}
