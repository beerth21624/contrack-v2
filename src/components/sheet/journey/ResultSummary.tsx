'use client';

import type { ReactNode } from 'react';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { formatNumber } from '@/components/sheet/NumberCell';

export interface SummaryItem {
    label: string;
    value: number | null | undefined;
    unit: string;
    digits?: number;
    /** Small grey line under the value (e.g. the bar sizes of a rebar total). */
    detail?: ReactNode;
}

/** "คอนกรีต 3.25 ลบ.ม. · เหล็ก 412.00 กก." */
export function resultText(items: SummaryItem[]): string {
    return items.map(i => `${i.label} ${formatNumber(i.value ?? 0, i.digits ?? 2)} ${i.unit}`).join(' · ');
}

/**
 * The green "what this level comes to" box at the end of every journey level: the 1–6 results that matter as
 * big numbers, optional smaller results (`minor`) and a note. With `empty` and no items, the empty text is shown
 * instead (what to fill first).
 */
export function ResultSummary({ items, minor, note, empty }: {
    items: SummaryItem[];
    minor?: SummaryItem[];
    note?: ReactNode;
    empty?: ReactNode;
}) {
    return (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <div className="text-[12px] font-semibold text-green-800 mb-2">ผลลัพธ์ของด่านนี้</div>
            {items.length === 0 && empty !== undefined
                ? <div className="text-[13px] text-gray-600">{empty}</div>
                : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                        {items.map((it, i) => (
                            <div key={`${i}-${it.label}`} className="min-w-0">
                                <div className="text-[12px] text-gray-600 truncate" title={it.label}>{it.label}</div>
                                <div className="text-[18px] font-bold tabular-nums text-gray-900 leading-tight">
                                    {formatNumber(it.value ?? 0, it.digits ?? 2)}{' '}
                                    <span className="text-[12px] font-normal text-gray-500">{it.unit}</span>
                                </div>
                                {it.detail !== undefined && <div className="text-[11px] text-gray-500 tabular-nums">{it.detail}</div>}
                            </div>
                        ))}
                    </div>
                )}
            {minor !== undefined && minor.length > 0 && (
                <div className="mt-2 text-[12px] text-gray-600 tabular-nums">{resultText(minor)}</div>
            )}
            {note !== undefined && <div className="mt-2 text-[12px] text-gray-600">{note}</div>}
        </div>
    );
}

/** Rebar kg of a structural level (outputs `rebar.<size>`), with the sizes used as its detail. */
export function rebarSummaryItem(outputs: Record<string, number>, label = 'เหล็กเสริม'): SummaryItem {
    const kg = (size: string) => outputs[`rebar.${size}`] ?? 0;
    const used = REBAR_SIZES.filter(s => kg(s) > 0);
    const total = REBAR_SIZES.reduce((s, size) => s + kg(size), 0);
    return {
        label, value: total, unit: 'กก.', digits: 1,
        detail: used.length > 1 ? used.map(s => `${s} ${formatNumber(kg(s), 1)}`).join(', ') : used[0],
    };
}
