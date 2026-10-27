'use client';

import type { ReactNode } from 'react';
import { NumberCell, TextCell, SHEET_COLORS, formatNumber } from './NumberCell';
import { RequiredMark, useRequiredField } from './journey/RequiredContext';

/** Labelled yellow number input (an Excel input cell). */
export function InputNumberField({ label, value, onChange, unit, hint, digits = 2, percent }: {
    label: string; value: number; onChange: (v: number) => void; unit?: string; hint?: ReactNode;
    digits?: number; percent?: boolean;
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 py-1">
            <span className="text-[13px] text-gray-700">{label}</span>
            <NumberCell value={value} digits={digits} percent={percent} ariaLabel={label}
                onCommit={v => onChange(v ?? 0)} />
            <span className="text-[12px] text-gray-500 min-w-[48px]">{unit}{hint ? <span className="ml-2 text-gray-400">{hint}</span> : null}</span>
        </div>
    );
}

/** Labelled yellow text input. */
export function InputTextField({ label, value, onChange, placeholder, fieldKey }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
    /** Key of the input field on a journey step: `*` when required, ring when still missing on confirm. */
    fieldKey?: string;
}) {
    const req = useRequiredField(fieldKey);
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 py-1" data-req-field={req.targetId}>
            <span className="text-[13px] text-gray-700">{label}<RequiredMark required={req.required} /></span>
            <div className={`rounded ${req.highlighted ? 'ring-1 ring-red-300' : ''}`} style={{ background: SHEET_COLORS.input }}>
                <TextCell value={value} placeholder={placeholder} ariaLabel={label} onCommit={v => onChange(v ?? '')} />
            </div>
        </div>
    );
}

/** Labelled green computed value (an Excel formula cell). */
export function CalcField({ label, value, unit, digits = 2, strong }: {
    label: string; value: number | null | undefined; unit?: string; digits?: number; strong?: boolean;
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 py-1">
            <span className={`text-[13px] ${strong ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{label}</span>
            <span className="text-right tabular-nums px-1 py-0.5 rounded-sm"
                style={{ background: SHEET_COLORS.calc, fontWeight: strong ? 700 : 400 }}>{formatNumber(value, digits)}</span>
            <span className="text-[12px] text-gray-500 min-w-[48px]">{unit}</span>
        </div>
    );
}

/** White card used to group a calculator's blocks. */
export function SheetCard({ title, extra, children, className = '' }: {
    title?: ReactNode; extra?: ReactNode; children: ReactNode;
    /** Extra classes on the card itself, e.g. `h-full` to fill a grid row. */
    className?: string;
}) {
    return (
        <div className={`bg-white border border-gray-200 rounded-card shadow-card ${className}`}>
            {(title !== undefined || extra !== undefined) && (
                <div className="flex items-center gap-2 min-h-[44px] px-4 sm:px-5 py-2 border-b border-gray-100">
                    <span className="font-semibold text-[14px] leading-snug text-gray-800">{title}</span>
                    {extra !== undefined && <span className="ml-auto flex items-center">{extra}</span>}
                </div>
            )}
            <div className="p-4 sm:p-5">{children}</div>
        </div>
    );
}
