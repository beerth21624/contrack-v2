'use client';

import type { ReactNode } from 'react';
import { NumberCell } from '@/components/sheet/NumberCell';
import { FieldNote, PresetChips, outOfRange } from './Choices';

const labelCls = 'text-[12px] text-gray-600 leading-tight';
const hintCls = 'text-[11px] text-gray-400 leading-tight';

/**
 * A labelled field of a plan card around any control (choice buttons, a stepper …): label, the control, an
 * optional grey hint and plausibility note. While the card is half filled and this value is still empty
 * (`missing`) the label turns red; the card itself says what is missing.
 */
export function PlanField({ label, hint, note, missing, className, children }: {
    label: ReactNode;
    hint?: ReactNode;
    /** A value that looks wrong (still accepted): amber note under the field. */
    note?: ReactNode;
    /** This plan value is still empty on a started element. */
    missing?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={`flex flex-col gap-1 min-w-0 ${className ?? ''}`}>
            <span className={`${labelCls} ${missing ? 'text-red-600' : ''}`}>{label}</span>
            {children}
            {hint !== undefined && <span className={hintCls}>{hint}</span>}
            {note !== undefined && note !== '' && <FieldNote>{note}</FieldNote>}
        </div>
    );
}

/**
 * A plan number (yellow box + unit) with optional quick-pick chips of common values, a plausibility range
 * (`range` → `outOfRange` note; the value is still accepted) and the missing state. Accepts sums like "4+3.5".
 */
export function PlanNumber({
    label, value, onChange, unit, hint, digits = 2, presets, presetFormat, range, missing, placeholder, className,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    unit?: string;
    hint?: ReactNode;
    digits?: number;
    /** Common values offered as chips under the box. */
    presets?: readonly number[];
    presetFormat?: (v: number) => string;
    /** Usual [min, max] of this value: outside it a note asks to double-check (unit as `unit`). */
    range?: readonly [number, number];
    missing?: boolean;
    placeholder?: string;
    className?: string;
}) {
    const note = range === undefined ? undefined : outOfRange(value, range[0], range[1], unit ?? '');
    return (
        <PlanField label={label} hint={hint} note={note} missing={missing} className={className}>
            <span className="flex items-center gap-1.5">
                <span className={`flex-1 min-w-0 max-w-[120px] rounded ${missing ? 'ring-1 ring-red-400' : ''}`}>
                    <NumberCell value={value} digits={digits} ariaLabel={unit === undefined ? label : `${label} (${unit})`}
                        blankZero placeholder={placeholder} onCommit={v => onChange(v ?? 0)} />
                </span>
                {unit !== undefined && <span className="text-[12px] text-gray-500 whitespace-nowrap">{unit}</span>}
            </span>
            {presets !== undefined && presets.length > 0 && (
                <PresetChips values={presets} current={value} onPick={onChange} format={presetFormat} />
            )}
        </PlanField>
    );
}
