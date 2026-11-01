'use client';

// Labelled fields and element cards of the card-style journey pages (one card per element type read off the
// plan: F1, C1, GB1 …): plain labels above yellow inputs, a short result line per card.
import type { ReactNode } from 'react';
import { Button, Popconfirm, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { useNegativeValueWarning, NumberCell, TextCell, SHEET_COLORS } from '@/components/sheet/NumberCell';
import { fieldHintCls as hintCls, fieldLabelCls as labelCls, missingRing, numberBoxCls } from './PlanField';
import { RequiredMark, useRequiredField } from './RequiredContext';

/** Labelled yellow number box (label above, unit after). ieldKey: see PlanField. */
export function JNumber({ label, value, onChange, unit, hint, digits = 2, blankZero = true, placeholder, fieldKey }: {
    label: string; value: number; onChange: (v: number) => void; unit?: string; hint?: ReactNode; digits?: number;
    /** Empty box instead of "0.00" while 0 (a plan value not filled yet). Default on: journey fields are plan values. */
    blankZero?: boolean; placeholder?: string; fieldKey?: string;
}) {
    const negativeWarning = useNegativeValueWarning();
    const req = useRequiredField(fieldKey);
    return (
        <label className="flex flex-col gap-1 min-w-0" data-req-field={req.targetId}>
            <span className={labelCls}>{label}<RequiredMark required={req.required} /></span>
            <span className="flex items-center gap-1.5">
                <span className={`${numberBoxCls} rounded ${req.highlighted ? missingRing : ''}`}>
                    <NumberCell value={value} digits={digits} ariaLabel={label} blankZero={blankZero} placeholder={placeholder}
                        onCommit={v => onChange(v ?? 0)} />
                </span>
                {unit && <span className="text-[12px] text-gray-500 whitespace-nowrap">{unit}</span>}
            </span>
            {hint && <span className={hintCls}>{hint}</span>}
            {value < 0 && <span className="text-[12px] text-orange-600">{negativeWarning}</span>}
        </label>
    );
}

/** Labelled yellow text box. */
export function JText({ label, value, onChange, placeholder, wide, fieldKey }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean; fieldKey?: string;
}) {
    const req = useRequiredField(fieldKey);
    return (
        <label className={`flex flex-col gap-1 min-w-0 ${wide ? 'col-span-2' : ''}`} data-req-field={req.targetId}>
            <span className={labelCls}>{label}<RequiredMark required={req.required} /></span>
            <span className={`rounded ${wide ? 'max-w-[420px]' : 'max-w-[120px]'} ${req.highlighted ? missingRing : ''}`}
                style={{ background: SHEET_COLORS.input }}>
                <TextCell value={value} placeholder={placeholder} ariaLabel={label} onCommit={v => onChange(v ?? '')} />
            </span>
        </label>
    );
}

/** Labelled yellow dropdown. */
export function JSelect<V extends string | number>({ label, value, onChange, options, placeholder, hint, width = 180, fieldKey }: {
    label: string; value: V | undefined; onChange: (v: V | undefined) => void; placeholder?: string; hint?: ReactNode;
    options: { value: V; label?: string }[] | { label: string; options: { value: V; label?: string }[] }[];
    width?: number; fieldKey?: string;
}) {
    const req = useRequiredField(fieldKey);
    return (
        <div className="flex flex-col gap-1 min-w-0" data-req-field={req.targetId}>
            <span className={labelCls}>{label}<RequiredMark required={req.required} /></span>
            <div className={`rounded ${req.highlighted ? missingRing : ''}`} style={{ background: SHEET_COLORS.input, maxWidth: width }}>
                <Select<V> size="small" variant="borderless" style={{ width: '100%' }} aria-label={label} allowClear
                    placeholder={placeholder} value={value} options={options} onChange={v => onChange(v)} />
            </div>
            {hint && <span className={hintCls}>{hint}</span>}
        </div>
    );
}

const sizeOptions = REBAR_SIZES.map(s => ({ value: s as string }));

/** A bar group as written on a detail drawing: count and size (e.g. 5 เส้น DB12), or size and spacing. */
export function JBar({ label, size, onSize, amount, onAmount, amountUnit = 'เส้น', amountDigits = 0, hint }: {
    label: string; size: string; onSize: (v: string) => void; amount: number; onAmount: (v: number) => void;
    amountUnit?: string; amountDigits?: number; hint?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <span className={labelCls}>{label}</span>
            <span className="flex items-center gap-1.5">
                <span className="w-[84px] shrink-0" style={{ background: SHEET_COLORS.input, borderRadius: 3 }}>
                    <Select<string> size="small" variant="borderless" style={{ width: '100%' }} aria-label={`${label} ขนาด`}
                        placeholder="ขนาด" value={size === '' ? undefined : size} options={sizeOptions} onChange={v => onSize(v)} />
                </span>
                <span className="w-[64px] shrink-0">
                    <NumberCell value={amount} digits={amountDigits} ariaLabel={`${label} ${amountUnit}`} blankZero
                        onCommit={v => onAmount(v ?? 0)} />
                </span>
                <span className="text-[12px] text-gray-500 whitespace-nowrap">{amountUnit}</span>
            </span>
            {hint && <span className={hintCls}>{hint}</span>}
        </div>
    );
}

/** Section title inside an element card. */
export function JGroup({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="mt-3 first:mt-0">
            {title !== '' && <div className="text-[12px] font-semibold text-gray-500 mb-1.5">{title}</div>}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">{children}</div>
        </div>
    );
}

/** One element type of the plan (F1, C1, GB1 …): title, delete, the fields, then its result line. */
export function ElementCard({ title, onDelete, deleteTitle, result, warning, children }: {
    title: ReactNode; onDelete?: () => void; deleteTitle?: string; result?: ReactNode; warning?: ReactNode; children: ReactNode;
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-card shadow-card">
            <div className="flex items-center gap-2 min-h-[44px] px-4 sm:px-5 py-2 border-b border-gray-100">
                <span className="font-semibold text-[14px] leading-snug text-gray-800">{title}</span>
                {onDelete && (
                    <Popconfirm title={deleteTitle ?? 'ลบรายการนี้?'} okText="ลบ" cancelText="ยกเลิก" onConfirm={onDelete}>
                        <Button className="ml-auto" type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบ" />
                    </Popconfirm>
                )}
            </div>
            <div className="p-4 sm:p-5">
                {children}
                {warning && <div className="mt-3 text-[12px] text-orange-600">{warning}</div>}
                {result && (
                    <div className="mt-3 px-3 py-1.5 rounded text-[13px] text-gray-800 tabular-nums" style={{ background: SHEET_COLORS.calc }}>
                        {result}
                    </div>
                )}
            </div>
        </div>
    );
}

/** "Add one more" button under a list of element cards or table rows. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <Button data-req-add="" type="dashed" size="large" block icon={<PlusOutlined />} onClick={onClick} className="scroll-mt-24">{label}</Button>
    );
}
