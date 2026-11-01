'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { journeyText } from './text';
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

/** A computed cell of a journey table: empty instead of "0.00" while the row is not filled yet. */
export const blankIfZero = (v: number | null | undefined): number | null =>
    (v === null || v === undefined || v === 0 ? null : v);

/** A result value: plain "0" (not "0.00") while nothing is filled yet. */
const shown = (value: number | null | undefined, digits = 2): string =>
    formatNumber(value ?? 0, (value ?? 0) === 0 ? 0 : digits);

const hasValue = (i: SummaryItem): boolean => (i.value ?? 0) !== 0;

/** "คอนกรีต 3.25 ลบ.ม. · เหล็ก 412.00 กก." — results still at 0 are left out ('' when nothing is computed yet). */
export function resultText(items: SummaryItem[]): string {
    return items.filter(hasValue).map(i => `${i.label} ${shown(i.value, i.digits)} ${i.unit}`).join(' · ');
}

/**
 * The green "what this level comes to" box at the end of every journey level: the 1–6 results that matter as
 * big numbers, optional smaller results (`minor`) and a note. While every result is still 0, the `empty` text
 * (what to fill first) is shown instead of a row of zeros. Money belongs in the bottom bar, not here.
 */
export function ResultSummary({ items, minor, note, empty }: {
    items: SummaryItem[];
    minor?: SummaryItem[];
    note?: ReactNode;
    empty?: ReactNode;
}) {
    const t = useTranslations('journeyUi.summary');
    const nothingYet = !items.some(hasValue);
    return (
        <div className="rounded-card border border-green-200 bg-green-50 px-4 py-3 sm:px-5">
            <div className="text-[12px] font-semibold text-green-800 mb-2">{t('title')}</div>
            {nothingYet
                ? <div className="text-[13px] text-gray-600">{empty ?? t('empty')}</div>
                : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                        {items.map((it, i) => (
                            <div key={`${i}-${it.label}`} className="min-w-0">
                                <div className="text-[12px] text-gray-600 leading-snug [overflow-wrap:anywhere]">{it.label}</div>
                                <div className="text-[18px] font-bold tabular-nums text-gray-900 leading-tight">
                                    {shown(it.value, it.digits)}{' '}
                                    <span className="text-[12px] font-normal text-gray-500">{it.unit}</span>
                                </div>
                                {it.detail !== undefined && <div className="text-[12px] text-gray-500 tabular-nums">{it.detail}</div>}
                            </div>
                        ))}
                    </div>
                )}
            {minor !== undefined && minor.some(hasValue) && (
                <div className="mt-2 text-[12px] text-gray-600 tabular-nums">{resultText(minor)}</div>
            )}
            {note !== undefined && <div className="mt-2 text-[12px] text-gray-600">{note}</div>}
        </div>
    );
}

/** Rebar kg of a structural level (outputs `rebar.<size>`), with the sizes used as its detail. */
export function rebarSummaryItem(outputs: Record<string, number>, label?: string): SummaryItem {
    const t = journeyText();
    const kg = (size: string) => outputs[`rebar.${size}`] ?? 0;
    const used = REBAR_SIZES.filter(s => kg(s) > 0);
    const total = REBAR_SIZES.reduce((s, size) => s + kg(size), 0);
    return {
        label: label ?? t('summary.rebar'), value: total, unit: t('summary.kg'), digits: 1,
        detail: used.length > 1 ? used.map(s => `${s} ${formatNumber(kg(s), 1)}`).join(', ') : used[0],
    };
}
