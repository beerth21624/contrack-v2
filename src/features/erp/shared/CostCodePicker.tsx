'use client';

// ─── Pick a cost code of a project (search by code, name or BOQ section); shows the budget with `cost.read` ───
// <CostCodePicker projectId={projectId} value={costCodeId} onChange={(id, code) => …} /> — works inside a Form.Item.
// Cost codes come from the baseline (WP-18): none until the BOQ is locked. Omitted codes are hidden unless asked for.
import { useMemo, useState } from 'react';
import { Select } from 'antd';
import { useTranslations } from 'next-intl';
import type { CostCodeDto } from '@/shared/contract';
import { useBaseline, useBoqVersion, useCostCodes } from '../boq-control/hooks';
import { MoneyText } from './MoneyText';

/** Lower-case, no spaces: "หมวด 3" and "หมวด3" match alike. */
const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

export function CostCodePicker({
    projectId, value, onChange, disabled, allowClear = true, includeOmitted = false, placeholder, className, status,
}: {
    projectId: string;
    value?: string | null;
    onChange?: (costCodeId: string | null, costCode: CostCodeDto | undefined) => void;
    disabled?: boolean;
    allowClear?: boolean;
    /** Also offer codes a VO omitted (default: active ones only; a selected omitted code still shows). */
    includeOmitted?: boolean;
    placeholder?: string;
    className?: string;
    status?: 'error' | 'warning';
}) {
    const t = useTranslations('boqControl.costCodePicker');
    const codes = useCostCodes(projectId);
    // Section titles of the locked version (cached for good: a version never changes).
    const baseline = useBaseline(projectId);
    const version = useBoqVersion(baseline.data?.baseline?.versionId);
    const [search, setSearch] = useState('');

    const sectionTitles = useMemo(
        () => new Map((version.data?.sections ?? []).map(s => [s.sectionNo, s.titleTh])),
        [version.data],
    );
    const all = codes.data ?? [];
    const shown = all.filter(c => includeOmitted || c.status === 'active' || c.id === value);
    const byId = new Map(all.map(c => [c.id, c]));

    const haystack = (c: CostCodeDto): string => {
        const title = sectionTitles.get(c.sectionNo) ?? '';
        return norm([c.code, c.descTh, c.descEn, t('section', { no: c.sectionNo }), String(c.sectionNo), title].join(' '));
    };
    const q = norm(search);
    const found = q === '' ? shown : shown.filter(c => haystack(c).includes(q));

    const options = found.map(c => ({ value: c.id, label: `${c.code} · ${c.descTh}`, code: c }));

    return (
        <Select
            className={className ?? 'w-full'}
            value={value ?? undefined}
            status={status}
            disabled={disabled}
            allowClear={allowClear}
            loading={codes.isLoading}
            placeholder={placeholder ?? t('placeholder')}
            showSearch={{ filterOption: false, searchValue: search, onSearch: setSearch }}
            notFoundContent={codes.isError ? t('loadFailed') : all.length === 0 ? t('empty') : t('noMatch')}
            options={options}
            popupMatchSelectWidth={false}
            styles={{ popup: { root: { maxWidth: 'calc(100vw - 32px)', minWidth: 'min(420px, calc(100vw - 32px))' } } }}
            optionRender={(o) => {
                const c = o.data.code;
                const title = sectionTitles.get(c.sectionNo);
                return (
                    <div className="flex min-w-0 items-start justify-between gap-3 py-0.5">
                        <div className="min-w-0 whitespace-normal break-words">
                            <div>
                                <span className="font-semibold tabular-nums">{c.code}</span>
                                {c.status === 'omitted' && <span className="ml-2 text-[12px] text-red-500">{t('omitted')}</span>}
                            </div>
                            <div className="text-[13px]">{c.descTh}</div>
                            <div className="text-[12px] text-gray-500">
                                {t('section', { no: c.sectionNo })}{title !== undefined && title !== '' ? ` · ${title}` : ''}{c.unit !== '' ? ` · ${c.unit}` : ''}
                            </div>
                        </div>
                        {c.budgetTotal !== null && (
                            <div className="shrink-0 text-right text-[12px] text-gray-500">
                                <div>{t('budget')}</div>
                                <MoneyText value={c.budgetTotal} className="font-semibold text-gray-900" />
                            </div>
                        )}
                    </div>
                );
            }}
            onChange={(id: string | undefined) => {
                setSearch('');
                onChange?.(id ?? null, id === undefined ? undefined : byId.get(id));
            }}
        />
    );
}
