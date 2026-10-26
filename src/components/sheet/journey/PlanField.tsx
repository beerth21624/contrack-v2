'use client';

import type { ReactNode } from 'react';
import { NumberCell } from '@/components/sheet/NumberCell';
import { FieldNote, PresetChips, outOfRange } from './Choices';
import { RequiredMark, useRequiredField } from './RequiredContext';

export const fieldLabelCls = 'text-[12px] text-gray-600 leading-tight';
export const fieldHintCls = 'text-[12px] text-gray-400 leading-tight';
/** The thin ring of a value still missing (on the box itself, never a red wash). */
export const missingRing = 'ring-1 ring-red-300';
/** Width of a plan number box (the unit follows at a constant gap). */
export const numberBoxCls = 'flex-1 min-w-0 max-w-[120px]';

/**
 * A labelled field of a plan card around any control (choice buttons, a stepper …): label, the control, an
 * optional grey hint and plausibility note. The label stays grey when the value is missing: the card's
 * "ยังขาด: …" line names it, and the empty box itself (`PlanNumber`, `CountStepper`) gets a thin red ring.
 * `fieldKey` (the input's key) marks a required field with `*` and, after a failed confirm, rings the control.
 */
export function PlanField({ label, hint, note, className, fieldKey, ringControl = true, children }: {
    label: ReactNode;
    hint?: ReactNode;
    /** A value that looks wrong (still accepted): amber note under the field. */
    note?: ReactNode;
    className?: string;
    /** Key of the input field (`requiredFields`): `*` when required, ring when still missing on confirm. */
    fieldKey?: string;
    /** Ring the whole control when missing (off when the control rings its own box, as `PlanNumber`). */
    ringControl?: boolean;
    children: ReactNode;
}) {
    const req = useRequiredField(fieldKey);
    return (
        <div className={`flex flex-col gap-1 min-w-0 ${className ?? ''}`} data-req-field={req.targetId}>
            <span className={fieldLabelCls}>{label}<RequiredMark required={req.required} /></span>
            {req.highlighted && ringControl
                ? <div className={`flex flex-col gap-1 self-start max-w-full rounded-md ring-offset-2 ${missingRing}`}>{children}</div>
                : children}
            {hint !== undefined && <span className={fieldHintCls}>{hint}</span>}
            {note !== undefined && note !== '' && <FieldNote>{note}</FieldNote>}
        </div>
    );
}

/**
 * The box of a custom control (a sum input, a stepper …) with the thin missing ring after a failed confirm, when
 * `fieldKey` is still missing. Pair with `PlanField ringControl={false}`.
 */
export function MissingRing({ fieldKey, missing, className, children }: {
    fieldKey?: string;
    missing?: boolean;
    className?: string;
    children: ReactNode;
}) {
    const req = useRequiredField(fieldKey);
    // The ring shows only after a failed confirm (nothing turns red while the user is still typing); `missing`
    // stays in the props for callers but no longer rings by itself.
    void missing;
    return <span className={`rounded ${className ?? ''} ${req.highlighted ? missingRing : ''}`}>{children}</span>;
}

/**
 * A plan number (yellow box + unit) with optional quick-pick chips of common values, a plausibility range
 * (`range` → `outOfRange` note; the value is still accepted) and the missing state. Accepts sums like "4+3.5".
 */
export function PlanNumber({
    label, value, onChange, unit, hint, digits = 2, presets, presetFormat, range, missing, placeholder, className, fieldKey,
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
    /** Key of the input field (see `PlanField`). */
    fieldKey?: string;
}) {
    const req = useRequiredField(fieldKey);
    void missing; // only rings after a failed confirm (see MissingRing)
    const note = range === undefined ? undefined : outOfRange(value, range[0], range[1], unit ?? '');
    return (
        <PlanField label={label} hint={hint} note={note} className={className} fieldKey={fieldKey} ringControl={false}>
            <span className="flex items-center gap-1.5">
                <span className={`${numberBoxCls} rounded ${req.highlighted ? missingRing : ''}`}>
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
