'use client';

// A bar group as written on a detail drawing ("6-DB12", "RB6 @0.15"): the bar size as buttons instead of a
// dropdown, then the count or the spacing (with chips only for the standard spacings).
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { NumberCell } from '@/components/sheet/NumberCell';
import { ChoiceButtons, PresetChips, outOfRange } from './Choices';
import { PlanField } from './PlanField';

export function BarField({
    label, sizes, size, onSize, amount, onAmount, amountLabel, amountUnit: amountUnitProp, amountDigits = 0, presets, range, hint, fieldKey,
}: {
    label: string;
    /** Bar sizes offered (the sheet's dropdown list). */
    sizes: readonly string[];
    size: string;
    onSize: (v: string) => void;
    amount: number;
    onAmount: (v: number) => void;
    /** Word before the amount box, e.g. "ระยะห่าง @". */
    amountLabel?: string;
    amountUnit?: string;
    amountDigits?: number;
    /** Standard amounts offered as chips (e.g. spacing 0.15 / 0.20). */
    presets?: readonly number[];
    /** Usual [min, max] of the amount: outside it a quiet note asks to check the unit. */
    range?: readonly [number, number];
    hint?: ReactNode;
    /** Key of the input field (see `PlanField`). */
    fieldKey?: string;
}) {
    const t = useTranslations('journeyUi.fields');
    const amountUnit = amountUnitProp ?? t('strand');
    const v = Number.isFinite(amount) ? amount : 0;
    const note = range === undefined ? undefined : outOfRange(v, range[0], range[1], amountUnit);
    return (
        <PlanField label={label} hint={hint} note={note} fieldKey={fieldKey}>
            <ChoiceButtons<string> size="small" ariaLabel={t('barSizeAria', { label })} value={size === '' ? undefined : size}
                options={sizes.map(s => ({ value: s, label: s }))} onChange={onSize} />
            <span className="flex items-center gap-1.5 mt-0.5">
                {amountLabel !== undefined && <span className="text-[12px] text-gray-500 whitespace-nowrap">{amountLabel}</span>}
                <span className="w-[72px] shrink-0">
                    <NumberCell value={amount} digits={amountDigits} blankZero
                        ariaLabel={`${label}${amountLabel === undefined ? '' : ` ${amountLabel}`} (${amountUnit})`}
                        onCommit={n => onAmount(n ?? 0)} />
                </span>
                <span className="text-[12px] text-gray-500 whitespace-nowrap">{amountUnit}</span>
            </span>
            {presets !== undefined && presets.length > 0 && <PresetChips values={presets} current={v} onPick={onAmount} />}
        </PlanField>
    );
}
